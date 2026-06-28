from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta
from typing import Optional, List, Any
from app.models.probation import ProbationRecord, ProbationTrigger, ProbationFeedback, ProbationReminder
from app.models.user import User
from app.enums import (
    ProbationStatus, ProbationTriggerStatus, ProbationFeedbackType, UserRole
)
from app.schemas.probation import ProbationRecordCreate, ProbationFeedbackCreate

TRIGGER_DAYS = [30, 60, 80]


def calculate_working_days(start: date, end: date, paused_ranges: List[tuple] = None) -> int:
    """Count Mon–Fri days between start and end, excluding paused periods."""
    if end <= start:
        return 0
    total = 0
    current = start
    while current < end:
        if current.weekday() < 5:  # Mon=0 … Fri=4
            # Check if this day falls in a paused range
            in_pause = False
            if paused_ranges:
                for pause_start, pause_end in paused_ranges:
                    if pause_start <= current < (pause_end or date.today()):
                        in_pause = True
                        break
            if not in_pause:
                total += 1
        current += timedelta(days=1)
    return total


class ProbationService:

    def create_record(self, db: Session, data: ProbationRecordCreate, admin_id: int) -> ProbationRecord:
        existing = db.query(ProbationRecord).filter(
            ProbationRecord.employee_id == data.employee_id
        ).first()
        if existing and existing.probation_status == ProbationStatus.IN_PROBATION:
            raise ValueError("Active probation record already exists for this employee")

        employee = db.query(User).filter(User.id == data.employee_id).first()
        if not employee:
            raise ValueError("Employee not found")

        record = ProbationRecord(
            employee_id=data.employee_id,
            date_of_joining=data.date_of_joining,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    def get_record(self, db: Session, record_id: int) -> Optional[ProbationRecord]:
        return db.query(ProbationRecord).filter(ProbationRecord.id == record_id).first()

    def get_by_employee(self, db: Session, employee_id: int) -> Optional[ProbationRecord]:
        return db.query(ProbationRecord).filter(
            ProbationRecord.employee_id == employee_id
        ).first()

    def list_records(self, db: Session, skip: int = 0, limit: int = 100) -> List[ProbationRecord]:
        return db.query(ProbationRecord).offset(skip).limit(limit).all()

    def get_probation_end_date(self, record: ProbationRecord) -> date:
        """Standard 90-day probation from DOJ, adjusted for pause/resumes."""
        # For now, simple DOJ + 90 days
        return record.date_of_joining + timedelta(days=90)

    def get_calculated_status(self, record: ProbationRecord) -> str:
        """Determine granular status for tracking."""
        if record.probation_status == ProbationStatus.COMPLETED:
            return "Completed"
        if record.probation_status == ProbationStatus.REJECTED:
            return "Terminated"
        if record.is_paused:
            return "Paused"
        
        # Check triggers
        has_overdue = any(t.status == ProbationTriggerStatus.ESCALATED for t in record.triggers)
        if has_overdue:
            return "Overdue"
            
        pending_triggers = [t for t in record.triggers if t.status == ProbationTriggerStatus.TRIGGERED]
        if pending_triggers:
            # Check if any are due today or in the past
            if any(t.trigger_date <= date.today() for t in pending_triggers):
                # Day 80 is special
                final_trigger = next((t for t in pending_triggers if t.trigger_day == 80), None)
                if final_trigger and final_trigger.trigger_date <= date.today():
                    return "Final Review Due"
                return "Pending Form"
                
        return "On Track"

    def get_working_days_elapsed(self, record: ProbationRecord) -> int:
        paused_ranges = []
        if record.is_paused and record.pause_start_date:
            paused_ranges.append((record.pause_start_date, record.pause_resume_date))
        elif record.pause_start_date and record.pause_resume_date:
            paused_ranges.append((record.pause_start_date, record.pause_resume_date))
        return calculate_working_days(record.date_of_joining, date.today(), paused_ranges)

    def pause(self, db: Session, record_id: int, pause_date: date) -> ProbationRecord:
        record = self.get_record(db, record_id)
        if not record:
            raise ValueError("Record not found")
        if record.probation_status != ProbationStatus.IN_PROBATION:
            raise ValueError("Can only pause an active probation")
        record.is_paused = True
        record.pause_start_date = pause_date
        record.probation_status = ProbationStatus.PAUSED
        db.commit()
        db.refresh(record)
        return record

    def resume(self, db: Session, record_id: int, resume_date: date) -> ProbationRecord:
        record = self.get_record(db, record_id)
        if not record:
            raise ValueError("Record not found")
        if record.probation_status != ProbationStatus.PAUSED:
            raise ValueError("Probation is not paused")
        record.is_paused = False
        record.pause_resume_date = resume_date
        record.probation_status = ProbationStatus.IN_PROBATION
        db.commit()
        db.refresh(record)
        return record

    def complete(self, db: Session, record_id: int) -> ProbationRecord:
        record = self.get_record(db, record_id)
        if not record:
            raise ValueError("Record not found")
        record.probation_status = ProbationStatus.COMPLETED
        # Cancel all pending triggers
        for trigger in record.triggers:
            if trigger.status == ProbationTriggerStatus.TRIGGERED:
                trigger.status = ProbationTriggerStatus.SUBMITTED  # freeze
        db.commit()
        db.refresh(record)
        return record
    
    def cancel_on_termination(self, db: Session, employee_id: int) -> None:
        """Auto-cancel all probation triggers when employee is deactivated"""
        record = self.get_by_employee(db, employee_id)
        if not record or record.probation_status not in [ProbationStatus.IN_PROBATION, ProbationStatus.PAUSED]:
            return
        
        # Cancel all pending triggers
        for trigger in record.triggers:
            if trigger.status == ProbationTriggerStatus.TRIGGERED:
                trigger.status = ProbationTriggerStatus.SUBMITTED  # Mark as handled
        
        record.probation_status = ProbationStatus.REJECTED  # Or create TERMINATED status
        db.commit()
        print(f"[PROBATION] Auto-cancelled triggers for terminated employee {employee_id}")
    
    def reassign_on_manager_change(self, db: Session, employee_id: int, old_manager_id: int, new_manager_id: int) -> None:
        """Reassign pending probation triggers when manager changes"""
        record = self.get_by_employee(db, employee_id)
        if not record:
            return
        
        # Find all TRIGGERED (pending) triggers
        pending_triggers = [t for t in record.triggers if t.status == ProbationTriggerStatus.TRIGGERED]
        
        if pending_triggers:
            from app.services.notification_service import notification_service
            new_manager = db.query(User).filter(User.id == new_manager_id).first()
            
            for trigger in pending_triggers:
                # Notify new manager
                if new_manager:
                    title = f"Probation Day {trigger.trigger_day} form assigned to you"
                    msg = f"You have been assigned as the new manager for an employee with a pending Day {trigger.trigger_day} probation form."
                    notification_service.create(db, new_manager.id, "probation_reassigned", title, msg, "probation_trigger", trigger.id)
                    notification_service._send_email(new_manager.email, title, msg)
            
            print(f"[PROBATION] Reassigned {len(pending_triggers)} triggers from manager {old_manager_id} to {new_manager_id}")

    def reject(self, db: Session, record_id: int) -> ProbationRecord:
        record = self.get_record(db, record_id)
        if not record:
            raise ValueError("Record not found")
        record.probation_status = ProbationStatus.REJECTED
        db.commit()
        db.refresh(record)
        return record

    def recommend(self, db: Session, record_id: int, data: Any, user_id: int) -> ProbationRecord:
        record = self.get_record(db, record_id)
        if not record:
            raise ValueError("Record not found")
        
        # In a real app, verify user_id is the manager or admin
        record.recommendation = data.recommendation
        record.recommendation_notes = data.recommendation_notes
        db.commit()
        db.refresh(record)
        return record

    def submit_feedback(
        self, db: Session, trigger_id: int, user_id: int, data: ProbationFeedbackCreate
    ) -> ProbationFeedback:
        trigger = db.query(ProbationTrigger).filter(ProbationTrigger.id == trigger_id).first()
        if not trigger:
            raise ValueError("Trigger not found")

        record = trigger.record
        employee = db.query(User).filter(User.id == record.employee_id).first()

        # Validate who can submit what
        if data.feedback_type == ProbationFeedbackType.SELF:
            if user_id != record.employee_id:
                raise ValueError("Only the employee can submit self-feedback")
        elif data.feedback_type == ProbationFeedbackType.MANAGER:
            if employee.manager_id != user_id:
                # Allow admin too
                submitter = db.query(User).filter(User.id == user_id).first()
                if not submitter or submitter.role != UserRole.ADMIN:
                    raise ValueError("Only the employee's manager or admin can submit manager feedback")

        # Prevent duplicate
        existing = db.query(ProbationFeedback).filter(
            ProbationFeedback.probation_trigger_id == trigger_id,
            ProbationFeedback.feedback_type == data.feedback_type
        ).first()
        if existing:
            raise ValueError(f"{data.feedback_type.value} feedback already submitted for this trigger")

        # Auto-flag low scores
        is_flagged = False
        flag_reason = None
        scores = [v for v in data.form_data.values() if isinstance(v, (int, float))]
        if scores and min(scores) <= 2:
            is_flagged = True
            flag_reason = "Low rating"

        feedback = ProbationFeedback(
            probation_trigger_id=trigger_id,
            submitted_by_id=user_id,
            feedback_type=data.feedback_type,
            form_data=data.form_data,
            is_flagged=is_flagged,
            flag_reason=flag_reason,
        )
        db.add(feedback)

        # Check if both submitted → mark SUBMITTED
        other_type = (
            ProbationFeedbackType.MANAGER
            if data.feedback_type == ProbationFeedbackType.SELF
            else ProbationFeedbackType.SELF
        )
        other = db.query(ProbationFeedback).filter(
            ProbationFeedback.probation_trigger_id == trigger_id,
            ProbationFeedback.feedback_type == other_type
        ).first()
        if other:
            trigger.status = ProbationTriggerStatus.SUBMITTED

        db.commit()
        db.refresh(feedback)
        return feedback

    def get_trigger_feedbacks(self, db: Session, trigger_id: int, user_id: int) -> List[ProbationFeedback]:
        """Cross-share: only return feedbacks if trigger is SUBMITTED (both parties done)."""
        trigger = db.query(ProbationTrigger).filter(ProbationTrigger.id == trigger_id).first()
        if not trigger:
            raise ValueError("Trigger not found")

        record = trigger.record
        requester = db.query(User).filter(User.id == user_id).first()

        # Admin sees all
        if requester.role == UserRole.ADMIN:
            return trigger.feedbacks

        # Cross-share only after both submitted
        if trigger.status != ProbationTriggerStatus.SUBMITTED:
            # Return only own feedback
            return [f for f in trigger.feedbacks if f.submitted_by_id == user_id]

        return trigger.feedbacks

    # ── Scheduler-called ──────────────────────────────────────────────────

    def check_and_fire_triggers(self, db: Session) -> None:
        """Called every 6 hours by APScheduler."""
        from app.services.notification_service import notification_service

        active_records = db.query(ProbationRecord).filter(
            ProbationRecord.probation_status.in_([
                ProbationStatus.IN_PROBATION, ProbationStatus.PAUSED
            ])
        ).all()

        for record in active_records:
            if record.probation_status == ProbationStatus.PAUSED:
                continue

            working_days = self.get_working_days_elapsed(record)
            employee = db.query(User).filter(User.id == record.employee_id).first()
            if not employee:
                continue
            
            # CRITICAL FIX: Block trigger if no manager assigned
            if not employee.manager_id:
                # Alert admin only once per record
                existing_alert = db.query(ProbationTrigger).filter(
                    ProbationTrigger.probation_record_id == record.id,
                    ProbationTrigger.status == ProbationTriggerStatus.BLOCKED
                ).first()
                if not existing_alert:
                    # Create blocked trigger as marker
                    blocked = ProbationTrigger(
                        probation_record_id=record.id,
                        trigger_day=30,  # placeholder
                        trigger_date=date.today(),
                        status=ProbationTriggerStatus.BLOCKED
                    )
                    db.add(blocked)
                    db.commit()
                    # Alert admin
                    admins = db.query(User).filter(User.role == UserRole.ADMIN).all()
                    for admin in admins:
                        notification_service.notify_no_manager_assigned(db, employee, admin)
                    print(f"[PROBATION] BLOCKED: No manager for employee {employee.email}")
                continue

            for trigger_day in TRIGGER_DAYS:
                if working_days < trigger_day:
                    continue

                existing = db.query(ProbationTrigger).filter(
                    ProbationTrigger.probation_record_id == record.id,
                    ProbationTrigger.trigger_day == trigger_day
                ).first()

                if not existing:
                    # Fire new trigger
                    trigger = ProbationTrigger(
                        probation_record_id=record.id,
                        trigger_day=trigger_day,
                        trigger_date=date.today(),
                    )
                    db.add(trigger)
                    db.commit()
                    db.refresh(trigger)
                    notification_service.notify_probation_trigger(db, trigger, employee)
                    print(f"[PROBATION] Fired Day {trigger_day} trigger for employee {employee.email}")
                    continue

                if existing.status != ProbationTriggerStatus.TRIGGERED:
                    continue

                # Check reminder / escalation thresholds
                days_since = (date.today() - existing.trigger_date).days
                last_reminder = db.query(ProbationReminder).filter(
                    ProbationReminder.probation_trigger_id == existing.id
                ).order_by(ProbationReminder.reminder_count.desc()).first()
                reminder_count = last_reminder.reminder_count if last_reminder else 0

                if days_since >= 7 and existing.status != ProbationTriggerStatus.ESCALATED:
                    existing.status = ProbationTriggerStatus.ESCALATED
                    db.commit()
                    notification_service.notify_probation_escalation(db, existing, employee)
                    print(f"[PROBATION] Escalated Day {trigger_day} trigger for {employee.email}")
                elif days_since >= 6 and reminder_count < 3:
                    self._send_reminder(db, existing, employee, 3, notification_service)
                elif days_since >= 4 and reminder_count < 2:
                    self._send_reminder(db, existing, employee, 2, notification_service)
                elif days_since >= 2 and reminder_count < 1:
                    self._send_reminder(db, existing, employee, 1, notification_service)

    def _send_reminder(self, db, trigger, employee, count, notification_service):
        reminder = ProbationReminder(
            probation_trigger_id=trigger.id,
            reminder_count=count,
        )
        db.add(reminder)
        db.commit()
        notification_service.notify_probation_reminder(db, trigger, employee)
        print(f"[PROBATION] Reminder #{count} sent to {employee.email} for Day {trigger.trigger_day}")


probation_service = ProbationService()
