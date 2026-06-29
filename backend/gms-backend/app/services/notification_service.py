from sqlalchemy.orm import Session
from datetime import datetime
from app.models.notification import Notification
from app.models.user import User
from app.enums import UserRole
from app.utils.email import email_sender


class NotificationService:

    def _send_email(self, to_email: str, subject: str, body: str):
        """Send email using Resend with styled HTML"""
        body_html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">PMS Platform</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1f2937; margin-top: 0; font-size: 20px;">{subject}</h2>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">{body}</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">This is an automated notification from the PMS Platform.</p>
        </div>
    </div>
</body>
</html>"""
        email_sender.send(to_email, subject, body_html)

    def create(self, db: Session, recipient_id: int, notification_type: str,
               title: str, message: str, entity_type: str = None, entity_id: int = None) -> Notification:
        n = Notification(
            recipient_id=recipient_id,
            notification_type=notification_type,
            title=title,
            message=message,
            related_entity_type=entity_type,
            related_entity_id=entity_id,
        )
        db.add(n)
        db.commit()
        db.refresh(n)
        return n

    # ── Goal notifications ────────────────────────────────────────────────

    def notify_goal_submitted(self, db: Session, goal) -> None:
        assignee = db.query(User).filter(User.id == goal.assignee_id).first()
        if not assignee or not assignee.manager_id:
            return
        manager = db.query(User).filter(User.id == assignee.manager_id).first()
        if not manager:
            return
        title = f"Goal pending approval: {goal.title}"
        msg = f"{assignee.name} submitted a goal for your approval."
        self.create(db, manager.id, "goal_submitted", title, msg, "goal", goal.id)
        self._send_email(manager.email, title, msg)

    def notify_goal_approved(self, db: Session, goal) -> None:
        title = f"Goal approved: {goal.title}"
        msg = "Your goal has been approved and is now active."
        self.create(db, goal.assignee_id, "goal_approved", title, msg, "goal", goal.id)
        assignee = db.query(User).filter(User.id == goal.assignee_id).first()
        if assignee:
            self._send_email(assignee.email, title, msg)

    def notify_goal_rejected(self, db: Session, goal, comment: str = "") -> None:
        title = f"Goal rejected: {goal.title}"
        msg = f"Your goal was rejected. Reason: {comment}"
        self.create(db, goal.assignee_id, "goal_rejected", title, msg, "goal", goal.id)
        assignee = db.query(User).filter(User.id == goal.assignee_id).first()
        if assignee:
            self._send_email(assignee.email, title, msg)

    # ── Probation notifications ───────────────────────────────────────────

    def notify_probation_trigger(self, db: Session, trigger, employee: User) -> None:
        title = f"Probation Day {trigger.trigger_day} form ready"
        msg = f"Please complete your Day {trigger.trigger_day} probation self-feedback form."
        self.create(db, employee.id, "probation_trigger", title, msg, "probation_trigger", trigger.id)
        self._send_email(employee.email, title, msg)

        if employee.manager_id:
            manager = db.query(User).filter(User.id == employee.manager_id).first()
            if manager:
                mgr_msg = f"Please complete the Day {trigger.trigger_day} probation feedback for {employee.name}."
                self.create(db, manager.id, "probation_trigger", title, mgr_msg, "probation_trigger", trigger.id)
                self._send_email(manager.email, title, mgr_msg)

    def notify_probation_reminder(self, db: Session, trigger, employee: User) -> None:
        title = f"Reminder: Probation Day {trigger.trigger_day} form pending"
        msg = "Your probation feedback form is still pending. Please submit it."
        self.create(db, employee.id, "probation_reminder", title, msg, "probation_trigger", trigger.id)
        self._send_email(employee.email, title, msg)

    def notify_probation_escalation(self, db: Session, trigger, employee: User) -> None:
        title = f"ESCALATION: Probation Day {trigger.trigger_day} overdue for {employee.name}"
        msg = f"Probation feedback for {employee.name} has not been submitted after 7 days."
        admins = db.query(User).filter(User.role == UserRole.ADMIN).all()
        for admin in admins:
            self.create(db, admin.id, "probation_escalation", title, msg, "probation_trigger", trigger.id)
            self._send_email(admin.email, title, msg)

    # ── Review notifications ──────────────────────────────────────────────

    def notify_review_cycle_started(self, db: Session, cycle, employees: list) -> None:
        title = f"Review cycle started: {cycle.cycle_name}"
        for employee in employees:
            msg = f"The {cycle.cycle_name} review cycle has started. Please complete your self-assessment by {cycle.self_review_deadline}."
            self.create(db, employee.id, "review_cycle_started", title, msg, "review_cycle", cycle.id)
            self._send_email(employee.email, title, msg)

    def notify_review_reminder(self, db: Session, form, user: User, urgent: bool = False) -> None:
        prefix = "URGENT: " if urgent else ""
        title = f"{prefix}Review form pending"
        msg = "Your review form is still pending. Please submit it before the deadline."
        self.create(db, user.id, "review_reminder", title, msg, "review_form", form.id)
        self._send_email(user.email, title, msg)

    def notify_review_escalation(self, db: Session, form, user: User) -> None:
        title = "ESCALATION: Review form overdue"
        msg = f"Review form for employee {form.employee_id} is overdue."
        admins = db.query(User).filter(User.role == UserRole.ADMIN).all()
        for admin in admins:
            self.create(db, admin.id, "review_escalation", title, msg, "review_form", form.id)
            self._send_email(admin.email, title, msg)

    def notify_flag(self, db: Session, form) -> None:
        """Notify admin when red flag is detected in review form"""
        employee = db.query(User).filter(User.id == form.employee_id).first()
        title = f"RED FLAG: {employee.name if employee else 'Employee'} - Review Form"
        msg = f"A review form has been flagged for review. Reason: {form.flag_reason}. Rating: {form.final_rating}/5"
        admins = db.query(User).filter(User.role == UserRole.ADMIN).all()
        for admin in admins:
            self.create(db, admin.id, "red_flag", title, msg, "review_form", form.id)
            self._send_email(admin.email, title, msg)
    
    def notify_cross_share_complete(self, db: Session, user: User, role: str) -> None:
        """Notify when both feedbacks are submitted and cross-shared"""
        title = "Feedback Cross-Share Complete"
        if role == "employee":
            msg = "Both you and your manager have submitted feedback. You can now view your manager's feedback."
        else:
            msg = "Both you and your team member have submitted feedback. You can now view their self-assessment."
        self.create(db, user.id, "cross_share_complete", title, msg)
        self._send_email(user.email, title, msg)
    
    def notify_no_manager_assigned(self, db: Session, employee: User, admin: User) -> None:
        """Alert admin when probation trigger is blocked due to missing manager"""
        title = f"ACTION REQUIRED: No manager assigned to {employee.name}"
        msg = f"Employee {employee.name} ({employee.email}) has reached a probation milestone but has no manager assigned. Please assign a manager to proceed."
        self.create(db, admin.id, "no_manager_alert", title, msg, "user", employee.id)
        self._send_email(admin.email, title, msg)

    def notify_readiness_nudge(self, db: Session, employee: User, prompts: list, manager_name: str) -> None:
        """Send an in-app review-readiness nudge to an employee (no email)."""
        title = "Review readiness nudge"
        if prompts:
            items = "\n".join(f"• {p}" for p in prompts)
            msg = f"{manager_name} nudged you to get review-ready. Outstanding items:\n{items}"
        else:
            msg = f"{manager_name} sent you a nudge — you're fully review-ready. Keep it up! 🎉"
        self.create(db, employee.id, "readiness_nudge", title, msg, "user", employee.id)


notification_service = NotificationService()
