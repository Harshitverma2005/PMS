#!/usr/bin/env python3
"""
SMTP Master Test Script - Tests all PMS notification scenarios
Uses native Python SMTP with your exact email addresses.
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

# Load SMTP credentials from .env
load_dotenv()
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")

# === THE USERS ===
EMP_EMAIL = "vermajiharshit1@gmail.com"  # Employee: Harshit
MGR_EMAIL = "gourav95411@gmail.com"      # Manager: Gourav
ADMIN_EMAIL = "gourav95411@gmail.com"    # Admin: Routed to Gourav for testing

# === THE HTML TEMPLATE GENERATOR ===
def get_email_template(notif_type: str, title: str, message: str) -> str:
    """Generate branded HTML email template based on notification type"""
    if notif_type in ["goal_submitted", "review_cycle_started"]:
        color = "#3b82f6"  # Blue
        icon = "🎯"
    elif notif_type == "goal_approved":
        color = "#10b981"  # Green
        icon = "✅"
    elif notif_type.startswith("probation_trigger"):
        color = "#8b5cf6"  # Purple
        icon = "📅"
    elif notif_type in ["probation_escalation", "flag_alert"]:
        color = "#ef4444"  # Red
        icon = "⚠️"
    else:
        color = "#6b7280"  # Gray
        icon = "🔔"

    return f"""
    <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background-color: {color}; padding: 20px; text-align: center;">
            <h2 style="color: #ffffff; margin: 0; font-size: 24px;">{icon} PMS Notification</h2>
        </div>
        <div style="padding: 30px;">
            <h3 style="color: #1f2937; margin-top: 0;">{title}</h3>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">{message}</p>
            <div style="margin-top: 30px; text-align: center;">
                <a href="http://localhost:3001" style="background-color: {color}; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Open PMS Dashboard</a>
            </div>
        </div>
        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">Automated message from the Performance Management System.</p>
        </div>
    </div>
    """

def send_test_email(to_email: str, subject: str, html_body: str):
    """Send email via SMTP"""
    if not SMTP_USER or not SMTP_PASSWORD:
        print(f"   ⚠️  SMTP credentials not configured in .env")
        print(f"   📧 Would send to: {to_email}")
        print(f"   📝 Subject: {subject}")
        return
    
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"PMS Platform <{SMTP_USER}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, to_email, msg.as_string())
        print(f"   ✅ Sent successfully!")
    except Exception as e:
        print(f"   ❌ Failed: {str(e)}")

# === THE PMS USE CASES ===
test_cases = [
    {
        "to": MGR_EMAIL,
        "subject": "Action Required: New Goal Proposal",
        "type": "goal_submitted",
        "title": "Goal Approval Required",
        "message": "Harshit Verma has submitted a new goal: <b>'Implement AWS EKS Cost Optimization with Grafana Dashboards'</b> for your approval. You have 5 business days to review and set the weightage percentage."
    },
    {
        "to": EMP_EMAIL,
        "subject": "Goal Approved: AWS EKS Cost Optimization",
        "type": "goal_approved",
        "title": "Your Goal is Active",
        "message": "Good news! Gourav has approved your EKS optimization goal and assigned it a weightage of 30%. You can now begin tracking your progress."
    },
    {
        "to": EMP_EMAIL,
        "subject": "Goal Rejected: Needs More Details",
        "type": "goal_rejected",
        "title": "Goal Returned for Revision",
        "message": "Your goal 'Implement Kubernetes Monitoring' has been returned by Gourav with the following feedback: <i>'Please add more specific metrics and success criteria. Also clarify the timeline for each milestone.'</i>"
    },
    {
        "to": EMP_EMAIL,
        "subject": "Action Required: Day 30 Probation Review",
        "type": "probation_trigger",
        "title": "Day 30 Check-in",
        "message": "Congratulations on completing your first 30 working days! It is time to submit your self-feedback. Your manager, Gourav, will complete their form concurrently."
    },
    {
        "to": EMP_EMAIL,
        "subject": "Reminder: Day 60 Probation Review Due",
        "type": "probation_trigger",
        "title": "Day 60 Mid-Probation Review",
        "message": "You have reached the 60-day milestone of your probation period. Please complete your self-assessment form within the next 2 business days. This is a critical checkpoint in your onboarding journey."
    },
    {
        "to": EMP_EMAIL,
        "subject": "Final Probation Review: Day 80",
        "type": "probation_trigger",
        "title": "Day 80 Final Probation Check",
        "message": "You are approaching the end of your probation period (Day 80). Please submit your final self-assessment. Your manager will provide their evaluation, and HR will make the final confirmation decision."
    },
    {
        "to": ADMIN_EMAIL,
        "subject": "COMPLIANCE ALERT: Missing Probation Form",
        "type": "probation_escalation",
        "title": "SLA Escalation: Day 60 Probation",
        "message": "Manager Gourav has failed to submit the Day 60 Probation review for Harshit Verma after 7 days of automated reminders. Immediate HR intervention is required."
    },
    {
        "to": EMP_EMAIL,
        "subject": "The Q1 2026 Review Cycle is Now Open",
        "type": "review_cycle_started",
        "title": "Performance Reviews are Live",
        "message": "The Q1 review cycle has officially launched. Please complete your self-assessment form before the April 15th deadline. This review will cover your goals, achievements, and development areas from January to March 2026."
    },
    {
        "to": EMP_EMAIL,
        "subject": "Reminder: Review Cycle Deadline Approaching",
        "type": "review_reminder",
        "title": "5 Days Until Review Deadline",
        "message": "This is a friendly reminder that your Q1 self-assessment is due in 5 days (April 15th). Please log in to the PMS dashboard to complete your review form."
    },
    {
        "to": MGR_EMAIL,
        "subject": "ALERT: Goal At Risk - Immediate Action Required",
        "type": "flag_alert",
        "title": "Red Flag: Goal Behind Schedule",
        "message": "Harshit Verma's goal 'AWS EKS Cost Optimization' is flagged as at-risk. Current progress: 15% with 70% of timeline elapsed. Blockers reported: <i>'Waiting for AWS credits approval, team bandwidth constraints.'</i> Please review and provide guidance."
    },
    {
        "to": ADMIN_EMAIL,
        "subject": "SYSTEM ALERT: Negative Feedback Flagged",
        "type": "flag_alert",
        "title": "Review Flag Detected",
        "message": "The system has detected a rating of 1/5 submitted during Harshit's Day 30 review. This has been flagged for your review in the Admin Dashboard. Manager: Gourav Singh. Please investigate and take appropriate action."
    },
    {
        "to": ADMIN_EMAIL,
        "subject": "ESCALATION: Goal Pending Approval >5 Days",
        "type": "goal_escalation",
        "title": "Goal Approval Overdue",
        "message": "The goal 'Implement CI/CD Pipeline for Microservices' submitted by Harshit Verma has been pending manager approval for 6 days. SLA breach detected. Manager: Gourav Singh. Please follow up."
    },
    {
        "to": MGR_EMAIL,
        "subject": "Goal Completed: Ready for Evaluation",
        "type": "goal_completed",
        "title": "Goal Awaiting Your Feedback",
        "message": "Harshit Verma has marked the goal 'AWS EKS Cost Optimization' as complete (100%). Please review the deliverables and provide your evaluation feedback. Self-rating: 4/5. Comments: <i>'Successfully reduced EKS costs by 35% through node optimization and spot instances.'</i>"
    }
]

# === EXECUTE SCRIPT ===
def main():
    print("=" * 70)
    print("🚀 SMTP MASTER TEST SUITE - PMS NOTIFICATIONS")
    print("=" * 70)
    print()
    print(f"📧 Employee Email: {EMP_EMAIL}")
    print(f"📧 Manager Email: {MGR_EMAIL}")
    print(f"📧 Admin Email: {ADMIN_EMAIL}")
    print()
    print(f"🔧 SMTP Server: {SMTP_HOST}:{SMTP_PORT}")
    print(f"🔧 SMTP User: {SMTP_USER or 'NOT CONFIGURED'}")
    print(f"🔧 SMTP Password: {'***' if SMTP_PASSWORD else 'NOT CONFIGURED'}")
    print()
    
    if not SMTP_USER or not SMTP_PASSWORD:
        print("⚠️  WARNING: SMTP credentials not configured!")
        print("   Update .env with SMTP_USER and SMTP_PASSWORD")
        print("   For Gmail: Use App Password from https://myaccount.google.com/apppasswords")
        print()
        print("   Continuing in DRY-RUN mode (no emails will be sent)...")
        print()
    
    print("=" * 70)
    print()
    
    for i, test in enumerate(test_cases, 1):
        print(f"[{i}/{len(test_cases)}] {test['type'].upper()}")
        print(f"   📧 To: {test['to']}")
        print(f"   📝 Subject: {test['subject']}")
        
        html_body = get_email_template(test["type"], test["title"], test["message"])
        send_test_email(test["to"], test["subject"], html_body)
        print()
    
    print("=" * 70)
    print("🎉 TEST SUITE COMPLETE!")
    print("=" * 70)
    print()
    print("📬 Check your inboxes:")
    print(f"   • Employee (Harshit): {EMP_EMAIL}")
    print(f"   • Manager (Gourav): {MGR_EMAIL}")
    print()
    print("📊 Expected Results:")
    print(f"   • {EMP_EMAIL} should receive 7 emails")
    print(f"   • {MGR_EMAIL} should receive 6 emails")
    print()
    print("💡 If emails don't arrive:")
    print("   1. Check spam/junk folder")
    print("   2. Verify SMTP credentials in .env")
    print("   3. For Gmail: Use App Password (not regular password)")
    print("   4. Check logs above for error messages")
    print()
    print("=" * 70)

if __name__ == "__main__":
    main()
