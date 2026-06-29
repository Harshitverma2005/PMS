"""
Seed database with demo data for testing all P0/P1 flows.
Credentials:
  Admin:    admin@pms.io    / admin123
  Manager:  manager@pms.io  / manager123
  Manager2: prashant@pms.io / manager123
  Employee: employee@pms.io / emp123
  Employee2: gourav@pms.io / emp123
  Employee3: awinash@pms.io / emp123
"""
from datetime import date, timedelta
from sqlalchemy.orm import Session
from app.core.security import get_password_hash
from app.models.user import User
from app.models.cycle import ReviewCycle
from app.models.goal import Goal
from app.models.feedback import FeedbackForm, Flag
from app.models.notification import Notification
from app.services.probation_service import initialize_probation
from app.services.cycle_service import auto_enroll_cycle


def seed(db: Session) -> None:
    if db.query(User).count() > 0:
        return  # Already seeded

    today = date.today()

    # ── Users ────────────────────────────────────────────────
    admin = User(name="sandeep", email="admin@pms.io",
                 hashed_password=get_password_hash("admin123"),
                 role="admin", department="HR", is_active=True, is_first_login=True,
                 review_track="bi_annual")
    db.add(admin)

    manager = User(name="aman", email="manager@pms.io",
                   hashed_password=get_password_hash("manager123"),
                   role="manager", department="Engineering", doj=today - timedelta(days=365),
                   is_active=True, is_first_login=False, review_track="bi_annual")
    db.add(manager)

    manager2 = User(name="prashant", email="prashant@pms.io",
                    hashed_password=get_password_hash("manager123"),
                    role="manager", department="Engineering", doj=today - timedelta(days=200),
                    is_active=True, is_first_login=False, review_track="bi_annual")
    db.add(manager2)
    db.flush()

    emp1 = User(name="harshit", email="employee@pms.io",
                hashed_password=get_password_hash("emp123"),
                role="employee", department="Engineering",
                doj=today - timedelta(days=45),
                manager_id=manager.id, is_active=True, is_first_login=False,
                review_track="bi_annual")
    db.add(emp1)

    emp2 = User(name="gourav", email="gourav@pms.io",
                hashed_password=get_password_hash("emp123"),
                role="employee", department="Engineering",
                doj=today - timedelta(days=20),
                manager_id=manager.id, is_active=True, is_first_login=False,
                review_track="bi_annual")
    db.add(emp2)

    emp3 = User(name="awinash", email="awinash@pms.io",
                hashed_password=get_password_hash("emp123"),
                role="employee", department="Engineering",
                doj=today - timedelta(days=10),
                manager_id=manager2.id, is_active=True, is_first_login=False,
                review_track="bi_annual")
    db.add(emp3)
    db.flush()

    # ── Probation ────────────────────────────────────────────
    initialize_probation(db, emp1)
    initialize_probation(db, emp2)
    initialize_probation(db, emp3)

    # ── Review Cycle ─────────────────────────────────────────
    cycle = ReviewCycle(
        name="H1 2026 Bi-Annual",
        track="bi_annual",
        period_start=date(2026, 4, 1),
        period_end=date(2026, 9, 30),
        trigger_date=date(2026, 8, 1),
        close_date=date(2026, 8, 25),
        status="active",
    )
    db.add(cycle)
    db.flush()
    auto_enroll_cycle(db, cycle)

    # ── Goals (Company → Team → Individual) ──────────────────
    company_goal = Goal(title="Achieve 95% Platform Uptime", description="SLA target for all services",
                        level="company", status="active", weightage=100.0,
                        owner_id=admin.id, creator_id=admin.id, cycle_id=cycle.id)
    db.add(company_goal)
    db.flush()

    team_goal = Goal(title="Reduce API P99 Latency to <200ms",
                     description="Optimize critical endpoints",
                     level="team", status="active", weightage=60.0,
                     owner_id=manager.id, creator_id=manager.id,
                     cycle_id=cycle.id, parent_goal_id=company_goal.id)
    db.add(team_goal)
    db.flush()

    ind_goal1 = Goal(title="Refactor Auth Service", description="Reduce token validation time by 50%",
                     level="individual", status="active", weightage=40.0, completion_pct=65.0,
                     owner_id=emp1.id, creator_id=emp1.id,
                     cycle_id=cycle.id, parent_goal_id=team_goal.id)
    ind_goal2 = Goal(title="Write API Load Tests", description="Cover all P0 endpoints",
                     level="individual", status="pending_approval", weightage=30.0,
                     owner_id=emp1.id, creator_id=emp1.id,
                     cycle_id=cycle.id, parent_goal_id=team_goal.id)
    ind_goal3 = Goal(title="Setup Test Automation Framework",
                     level="individual", status="draft", weightage=0.0,
                     owner_id=emp2.id, creator_id=emp2.id, cycle_id=cycle.id)
    db.add_all([ind_goal1, ind_goal2, ind_goal3])

    # ── Sample Flag ───────────────────────────────────────────
    # Find a submitted form and add a flag to it
    db.flush()
    self_form = db.query(FeedbackForm).filter(
        FeedbackForm.employee_id == emp1.id,
        FeedbackForm.form_type == "self"
    ).first()
    if self_form:
        self_form.responses = {"q1": 2, "q2": 3, "comments": ""}
        self_form.overall_score = 1.5
        self_form.status = "submitted"
        from datetime import datetime
        self_form.submitted_at = datetime.utcnow()
        db.flush()
        flag = Flag(form_id=self_form.id, reason="low_score", status="open", is_repeat=False)
        db.add(flag)

    # ── Notifications ─────────────────────────────────────────
    db.add(Notification(user_id=emp1.id, title="Welcome to PMS 🎉",
                        body="Your account is ready. Start by setting your goals.", category="general"))
    db.add(Notification(user_id=manager.id, title="⏳ Goal Approval Pending",
                        body="Jamie Dev submitted a goal for your approval.", category="goal",
                        action_url="/goals"))
    db.add(Notification(user_id=admin.id, title="🚩 Red Flag Detected",
                        body="A low-score feedback form has been flagged for review.", category="escalation",
                        action_url="/admin/flags"))

    db.commit()
    print("✅ Database seeded successfully")
