"""
Readiness service — compute review readiness scores for members and teams.
"""

from datetime import date, datetime, timedelta
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.review import ReviewCycle, ReviewForm
from app.models.goal import Goal
from app.models.achievement import Achievement
from app.models.kudos import Kudos
from app.models.feedback import Feedback
from app.models.progress import Progress
from app.models.user import User
from app.enums import ReviewCycleStatus, ReviewFormStatus, ReviewFormType, GoalStatus, UserRole


# Exact prompt strings from Requirement 10.2
PROMPT_STRINGS = [
    "No active or completed goal this cycle — create or activate one before review season",
    "No progress update in the last 30 days — add one to show momentum",
    "No feedback received this cycle — ask your manager for a check-in",
    "You have 0 achievements logged this cycle — log at least one to improve your review readiness",
    "Self-assessment not yet submitted — complete it before the deadline",
]

DEADLINE_PREFIX = "⚠ Review deadline approaching — "


def get_active_cycle(db: Session) -> Optional[ReviewCycle]:
    """
    Return the active ReviewCycle with the most recent start_date.
    Returns None if no active cycle exists.
    """
    today = date.today()
    cycles = (
        db.query(ReviewCycle)
        .filter(
            ReviewCycle.status == ReviewCycleStatus.ACTIVE,
            ReviewCycle.start_date <= today,
            ReviewCycle.end_date >= today,
        )
        .order_by(ReviewCycle.start_date.desc())
        .all()
    )
    return cycles[0] if cycles else None


def evaluate_signals(db: Session, employee_id: int, cycle: Optional[ReviewCycle]) -> List[bool]:
    """
    Evaluate the five readiness signals for employee_id.
    When cycle is None, evaluate against lifetime data.
    """
    start = cycle.start_date if cycle else None
    end = cycle.end_date if cycle else None

    def in_range(dt):
        if dt is None:
            return False
        dt_date = dt.date() if isinstance(dt, datetime) else dt
        if start and dt_date < start:
            return False
        if end and dt_date > end:
            return False
        return True

    # Signal a: ≥1 active or completed goal in cycle period
    gq = db.query(Goal).filter(
        Goal.assignee_id == employee_id,
        Goal.status.in_([GoalStatus.ACTIVE, GoalStatus.COMPLETED]),
    )
    if start:
        gq = gq.filter(Goal.created_at >= datetime.combine(start, datetime.min.time()))
    if end:
        gq = gq.filter(Goal.created_at <= datetime.combine(end, datetime.max.time()))
    signal_a = gq.count() >= 1

    # Signal b: ≥1 progress update within cycle period
    goal_ids = [g.id for g in db.query(Goal).filter(Goal.assignee_id == employee_id).all()]
    pq = db.query(Progress).filter(Progress.goal_id.in_(goal_ids)) if goal_ids else None
    if pq and start:
        pq = pq.filter(Progress.updated_at >= datetime.combine(start, datetime.min.time()))
    if pq and end:
        pq = pq.filter(Progress.updated_at <= datetime.combine(end, datetime.max.time()))
    signal_b = (pq.count() >= 1) if pq else False

    # Signal c: ≥1 feedback record received in cycle period
    fq = db.query(Feedback).filter(Feedback.goal_id.in_(goal_ids)) if goal_ids else None
    if fq and start:
        fq = fq.filter(Feedback.created_at >= datetime.combine(start, datetime.min.time()))
    if fq and end:
        fq = fq.filter(Feedback.created_at <= datetime.combine(end, datetime.max.time()))
    signal_c = (fq.count() >= 1) if fq else False

    # Signal d: ≥1 achievement logged in cycle period
    aq = db.query(Achievement).filter(Achievement.employee_id == employee_id)
    if start:
        aq = aq.filter(Achievement.created_at >= datetime.combine(start, datetime.min.time()))
    if end:
        aq = aq.filter(Achievement.created_at <= datetime.combine(end, datetime.max.time()))
    signal_d = aq.count() >= 1

    # Signal e: self-assessment ReviewForm is submitted
    if cycle:
        self_form = db.query(ReviewForm).filter(
            ReviewForm.review_cycle_id == cycle.id,
            ReviewForm.employee_id == employee_id,
            ReviewForm.form_type == ReviewFormType.SELF_ASSESSMENT,
            ReviewForm.status == ReviewFormStatus.SUBMITTED,
        ).first()
        signal_e = self_form is not None
    else:
        # Lifetime: any submitted self-assessment
        self_form = db.query(ReviewForm).filter(
            ReviewForm.employee_id == employee_id,
            ReviewForm.form_type == ReviewFormType.SELF_ASSESSMENT,
            ReviewForm.status == ReviewFormStatus.SUBMITTED,
        ).first()
        signal_e = self_form is not None

    return [signal_a, signal_b, signal_c, signal_d, signal_e]


def compute_score(signals: List[bool]) -> int:
    """Return sum(signals) * 20; range is 0–100."""
    return sum(signals) * 20


def build_prompts(signals: List[bool], cycle: Optional[ReviewCycle]) -> List[str]:
    """
    For each False signal, return the exact prompt string.
    If cycle.self_review_deadline is within 14 days, prepend the warning prefix.
    """
    today = date.today()
    deadline_soon = False
    if cycle and cycle.self_review_deadline:
        days_until = (cycle.self_review_deadline - today).days
        if 0 <= days_until <= 14:
            deadline_soon = True

    prompts = []
    for i, passed in enumerate(signals):
        if not passed:
            p = PROMPT_STRINGS[i]
            if deadline_soon:
                p = DEADLINE_PREFIX + p
            prompts.append(p)
    return prompts


def get_readiness(db: Session, employee_id: int) -> dict:
    """Compute and return readiness for a single employee."""
    cycle = get_active_cycle(db)
    signals = evaluate_signals(db, employee_id, cycle)
    score = compute_score(signals)
    prompts = build_prompts(signals, cycle)

    signal_names = ["active_goal", "progress_update", "feedback_received", "achievement_logged", "self_assessment"]
    signal_labels = PROMPT_STRINGS

    return {
        "score": score,
        "signals": [
            {
                "name": signal_names[i],
                "passed": signals[i],
                "label": signal_labels[i] if not signals[i] else None,
            }
            for i in range(5)
        ],
        "cycle_active": cycle is not None,
        "prompts": prompts,
    }


def get_team_readiness(db: Session, manager_id: int) -> List[dict]:
    """Return readiness for all direct reports of manager_id, sorted ascending by score."""
    direct_reports = db.query(User).filter(User.manager_id == manager_id).all()
    results = []
    for emp in direct_reports:
        r = get_readiness(db, emp.id)
        r["employee_id"] = emp.id
        r["employee_name"] = emp.name
        results.append(r)
    results.sort(key=lambda x: x["score"])
    return results


def get_all_employees_readiness(db: Session) -> List[dict]:
    """Admin view — readiness for every member-employee (legacy @opstree.com seed
    accounts excluded), sorted ascending by score (least prepared first)."""
    members = db.query(User).filter(User.role == UserRole.MEMBER).all()
    results = []
    for emp in members:
        if (emp.email or "").endswith("@opstree.com"):
            continue
        r = get_readiness(db, emp.id)
        r["employee_id"] = emp.id
        r["employee_name"] = emp.name
        results.append(r)
    results.sort(key=lambda x: x["score"])
    return results
