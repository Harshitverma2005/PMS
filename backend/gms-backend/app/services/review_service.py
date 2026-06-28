from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta
from typing import List, Optional
from app.models.review import ReviewCycle, ReviewForm, ReviewPerformanceHistory
from app.models.user import User
from app.enums import ReviewCycleStatus, ReviewFormType, ReviewFormStatus, UserRole, ReviewCycleType
from app.schemas.review import ReviewCycleCreate, ReviewFormSubmit


class ReviewService:

    def create_cycle(self, db: Session, data: ReviewCycleCreate, created_by_id: int) -> ReviewCycle:
        cycle = ReviewCycle(
            cycle_name=data.cycle_name,
            cycle_type=data.cycle_type,
            start_date=data.start_date,
            end_date=data.end_date,
            self_review_deadline=data.self_review_deadline,
            manager_review_deadline=data.manager_review_deadline,
            created_by_id=created_by_id,
        )
        db.add(cycle)
        db.commit()
        db.refresh(cycle)
        return cycle

    def list_cycles(self, db: Session, skip: int = 0, limit: int = 100) -> List[ReviewCycle]:
        return db.query(ReviewCycle).offset(skip).limit(limit).all()

    def get_cycle(self, db: Session, cycle_id: int) -> Optional[ReviewCycle]:
        return db.query(ReviewCycle).filter(ReviewCycle.id == cycle_id).first()

    def trigger_cycle(self, db: Session, cycle_id: int, admin_id: int) -> ReviewCycle:
        from app.services.notification_service import notification_service

        cycle = self.get_cycle(db, cycle_id)
        if not cycle:
            raise ValueError("Cycle not found")
        if cycle.status != ReviewCycleStatus.PENDING:
            raise ValueError("Only PENDING cycles can be triggered")

        # Eligibility: joined > 60 days before cycle end_date
        cutoff = cycle.end_date - timedelta(days=60)
        eligible_employees = db.query(User).filter(
            User.is_active == True,
            User.role == UserRole.MEMBER,
            User.date_of_joining != None,
            User.date_of_joining <= cutoff
        ).all()
        
        # DUAL-TRACK DEDUPLICATION: Check for overlapping cycles
        overlapping_cycles = db.query(ReviewCycle).filter(
            ReviewCycle.id != cycle_id,
            ReviewCycle.status == ReviewCycleStatus.ACTIVE,
            ReviewCycle.start_date <= cycle.end_date,
            ReviewCycle.end_date >= cycle.start_date
        ).all()
        
        # If quarterly overlaps with bi-annual, skip bi-annual for those employees
        skip_employees = set()
        if cycle.cycle_type == ReviewCycleType.BI_ANNUAL:
            for other in overlapping_cycles:
                if other.cycle_type == ReviewCycleType.QUARTERLY:
                    # Get employees already in quarterly cycle
                    quarterly_forms = db.query(ReviewForm).filter(
                        ReviewForm.review_cycle_id == other.id
                    ).all()
                    skip_employees.update(f.employee_id for f in quarterly_forms)
                    print(f"[REVIEW] Skipping {len(skip_employees)} employees already in quarterly cycle")

        created_count = 0
        for employee in eligible_employees:
            if employee.id in skip_employees:
                continue
            
            # Self-assessment form
            db.add(ReviewForm(
                review_cycle_id=cycle_id,
                employee_id=employee.id,
                manager_id=employee.manager_id,
                form_type=ReviewFormType.SELF_ASSESSMENT,
            ))
            # Manager feedback form (only if manager exists)
            if employee.manager_id:
                db.add(ReviewForm(
                    review_cycle_id=cycle_id,
                    employee_id=employee.id,
                    manager_id=employee.manager_id,
                    form_type=ReviewFormType.MANAGER_FEEDBACK,
                ))
            created_count += 1

        cycle.status = ReviewCycleStatus.ACTIVE
        db.flush()  # Write active status before snapshot

        # Snapshot manager_of_record_id for all forms in this cycle
        from app.services.cycle_snapshot_service import snapshot_manager_of_record
        snapshot_manager_of_record(db, cycle_id)

        db.commit()
        db.refresh(cycle)

        # Notify
        notification_service.notify_review_cycle_started(db, cycle, [e for e in eligible_employees if e.id not in skip_employees])
        print(f"[REVIEW] Cycle '{cycle.cycle_name}' triggered for {created_count} employees ({len(skip_employees)} skipped due to dual-track)")
        return cycle

    def close_cycle(self, db: Session, cycle_id: int, admin_id: int) -> ReviewCycle:
        cycle = self.get_cycle(db, cycle_id)
        if not cycle:
            raise ValueError("Cycle not found")
        if cycle.status != ReviewCycleStatus.ACTIVE:
            raise ValueError("Only ACTIVE cycles can be closed")

        # Waive all unsubmitted forms
        unsubmitted = db.query(ReviewForm).filter(
            ReviewForm.review_cycle_id == cycle_id,
            ReviewForm.status.in_([ReviewFormStatus.PENDING, ReviewFormStatus.IN_PROGRESS])
        ).all()
        for form in unsubmitted:
            form.status = ReviewFormStatus.WAIVED

        cycle.status = ReviewCycleStatus.CLOSED
        db.commit()
        db.refresh(cycle)
        print(f"[REVIEW] Cycle '{cycle.cycle_name}' closed. {len(unsubmitted)} forms waived.")
        return cycle

    def get_my_forms(self, db: Session, user_id: int) -> List[ReviewForm]:
        user = db.query(User).filter(User.id == user_id).first()
        if user.role in [UserRole.MANAGER, UserRole.ADMIN]:
            # Manager sees forms they need to fill AND their own self-assessments
            return db.query(ReviewForm).filter(
                (ReviewForm.employee_id == user_id) |
                (ReviewForm.manager_id == user_id)
            ).all()
        return db.query(ReviewForm).filter(ReviewForm.employee_id == user_id).all()

    def get_form(self, db: Session, form_id: int) -> Optional[ReviewForm]:
        return db.query(ReviewForm).filter(ReviewForm.id == form_id).first()

    def submit_form(self, db: Session, form_id: int, user_id: int, data: ReviewFormSubmit) -> ReviewForm:
        from app.services.notification_service import notification_service
        from app.services.red_flag_engine import red_flag_engine
        from app.services.hierarchy_service import is_direct_manager

        form = self.get_form(db, form_id)
        if not form:
            raise ValueError("Form not found")
        if form.status == ReviewFormStatus.SUBMITTED:
            if form.form_type == ReviewFormType.SELF_ASSESSMENT:
                raise ValueError("Self-assessment is immutable after submission")
            raise ValueError("Form already submitted")
        if form.status == ReviewFormStatus.WAIVED:
            raise ValueError("Form has been waived")

        # Separate-record enforcement
        user = db.query(User).filter(User.id == user_id).first()
        role = user.role.value if user and hasattr(user.role, 'value') else str(user.role) if user else 'member'

        if form.form_type == ReviewFormType.MANAGER_FEEDBACK:
            if role == 'member':
                raise PermissionError("Members cannot submit manager feedback forms")
            # Must be direct manager of the employee
            if not is_direct_manager(db, user_id, form.employee_id):
                if role != 'admin':
                    raise PermissionError("Only the direct manager or admin can submit manager feedback")

        if form.form_type == ReviewFormType.SELF_ASSESSMENT and form.employee_id != user_id:
            raise ValueError("Only the employee can submit self-assessment")

        # Manager form validation
        if form.form_type == ReviewFormType.MANAGER_FEEDBACK:
            comment = data.form_data.get('comment', '') if data.form_data else ''
            if not comment or not str(comment).strip():
                raise ValueError("comment is required for manager feedback")
            if data.final_rating is None or not (1 <= data.final_rating <= 5):
                raise ValueError("final_rating must be between 1 and 5 for manager feedback")

        form.form_data = data.form_data
        form.final_rating = data.final_rating
        form.status = ReviewFormStatus.SUBMITTED
        form.submitted_at = datetime.utcnow()

        # Preserve citations on manager submission
        # (citations set by ai_draft_service are kept as-is)

        # RED FLAG ENGINE: Scan for issues
        flag_result = red_flag_engine.scan_feedback(db, form)
        form.is_flagged = flag_result["is_flagged"]
        form.flag_reason = flag_result["flag_reason"]

        db.commit()

        # Notify admin if red flag detected
        if form.is_flagged >= 2:
            notification_service.notify_flag(db, form)
            print(f"[RED FLAG] Detected in form {form_id}: {form.flag_reason}")

        # Check cross-share: if both forms for this employee in this cycle are submitted
        self._check_cross_share(db, form.review_cycle_id, form.employee_id, notification_service)

        db.refresh(form)
        return form

    def _check_cross_share(self, db, cycle_id, employee_id, notification_service):
        """Blind Cross-Share: Only reveal both forms after BOTH are submitted"""
        self_form = db.query(ReviewForm).filter(
            ReviewForm.review_cycle_id == cycle_id,
            ReviewForm.employee_id == employee_id,
            ReviewForm.form_type == ReviewFormType.SELF_ASSESSMENT,
            ReviewForm.status == ReviewFormStatus.SUBMITTED
        ).first()

        mgr_form = db.query(ReviewForm).filter(
            ReviewForm.review_cycle_id == cycle_id,
            ReviewForm.employee_id == employee_id,
            ReviewForm.form_type == ReviewFormType.MANAGER_FEEDBACK,
            ReviewForm.status == ReviewFormStatus.SUBMITTED
        ).first()

        if self_form and mgr_form:
            # CROSS-SHARE: Mark both forms as revealed
            cross_share_time = datetime.utcnow()
            self_form.cross_shared_at = cross_share_time
            mgr_form.cross_shared_at = cross_share_time
            
            # Create performance history record
            avg_rating = mgr_form.final_rating
            history = ReviewPerformanceHistory(
                employee_id=employee_id,
                review_cycle_id=cycle_id,
                performance_score=float(avg_rating) if avg_rating else None,
                rating=str(avg_rating) if avg_rating else None,
                feedback_summary=str(mgr_form.form_data) if mgr_form.form_data else None,
            )
            db.add(history)
            db.commit()
            
            # Notify both parties that feedback is now available
            employee = db.query(User).filter(User.id == employee_id).first()
            manager = db.query(User).filter(User.id == mgr_form.manager_id).first()
            
            if employee:
                notification_service.notify_cross_share_complete(db, employee, "employee")
            if manager:
                notification_service.notify_cross_share_complete(db, manager, "manager")
            
            print(f"[REVIEW] Cross-share complete for employee {employee_id} in cycle {cycle_id}")

    def get_compliance(self, db: Session, cycle_id: int) -> dict:
        forms = db.query(ReviewForm).filter(ReviewForm.review_cycle_id == cycle_id).all()
        employee_ids = list({f.employee_id for f in forms})
        total = len(employee_ids)

        self_submitted = sum(
            1 for eid in employee_ids
            if any(f.employee_id == eid and f.form_type == ReviewFormType.SELF_ASSESSMENT
                   and f.status == ReviewFormStatus.SUBMITTED for f in forms)
        )
        mgr_submitted = sum(
            1 for eid in employee_ids
            if any(f.employee_id == eid and f.form_type == ReviewFormType.MANAGER_FEEDBACK
                   and f.status == ReviewFormStatus.SUBMITTED for f in forms)
        )
        both = sum(
            1 for eid in employee_ids
            if (any(f.employee_id == eid and f.form_type == ReviewFormType.SELF_ASSESSMENT
                    and f.status == ReviewFormStatus.SUBMITTED for f in forms) and
                any(f.employee_id == eid and f.form_type == ReviewFormType.MANAGER_FEEDBACK
                    and f.status == ReviewFormStatus.SUBMITTED for f in forms))
        )
        return {
            "cycle_id": cycle_id,
            "total_employees": total,
            "self_submitted": self_submitted,
            "manager_submitted": mgr_submitted,
            "both_submitted": both,
            "pending": total - both,
        }

    def get_history(self, db: Session, employee_id: int) -> List[ReviewPerformanceHistory]:
        return db.query(ReviewPerformanceHistory).filter(
            ReviewPerformanceHistory.employee_id == employee_id
        ).order_by(ReviewPerformanceHistory.created_at.desc()).all()

    def send_reminders(self, db: Session) -> None:
        """Called every 24h by scheduler."""
        from app.services.notification_service import notification_service

        active_cycles = db.query(ReviewCycle).filter(
            ReviewCycle.status == ReviewCycleStatus.ACTIVE
        ).all()

        for cycle in active_cycles:
            days_since_trigger = (date.today() - cycle.created_at.date()).days
            pending_forms = db.query(ReviewForm).filter(
                ReviewForm.review_cycle_id == cycle.id,
                ReviewForm.status.in_([ReviewFormStatus.PENDING, ReviewFormStatus.IN_PROGRESS])
            ).all()

            for form in pending_forms:
                user_id = (
                    form.employee_id if form.form_type == ReviewFormType.SELF_ASSESSMENT
                    else form.manager_id
                )
                if not user_id:
                    continue
                user = db.query(User).filter(User.id == user_id).first()
                if not user:
                    continue

                if days_since_trigger >= 22:
                    notification_service.notify_review_escalation(db, form, user)
                elif days_since_trigger >= 15:
                    notification_service.notify_review_reminder(db, form, user, urgent=True)
                elif days_since_trigger >= 5:
                    notification_service.notify_review_reminder(db, form, user, urgent=False)


review_service = ReviewService()
