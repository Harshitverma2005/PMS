from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.permissions import require_manager_or_admin, require_admin
from app.models.user import User
from app.models.goal import Goal
from app.models.probation import ProbationRecord
from app.models.review import ReviewCycle, ReviewForm
from app.models.notification import Notification
from app.models.team import Team
from app.enums import GoalStatus, ProbationStatus, ReviewCycleStatus, ReviewFormStatus, UserRole
from datetime import date

router = APIRouter()


@router.get("/me")
def my_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    goals = db.query(Goal).filter(Goal.assignee_id == current_user.id).all()
    active = [g for g in goals if g.status == GoalStatus.ACTIVE]
    completed = [g for g in goals if g.status in [GoalStatus.COMPLETED, GoalStatus.SCORED]]
    at_risk = [g for g in goals if g.is_at_risk]
    avg_pct = (sum(g.completion_percentage for g in goals) / len(goals)) if goals else 0.0

    probation = db.query(ProbationRecord).filter(
        ProbationRecord.employee_id == current_user.id
    ).first()

    pending_forms = db.query(ReviewForm).filter(
        ReviewForm.employee_id == current_user.id,
        ReviewForm.status.in_([ReviewFormStatus.PENDING, ReviewFormStatus.IN_PROGRESS])
    ).count()

    unread = db.query(Notification).filter(
        Notification.recipient_id == current_user.id,
        Notification.is_read == False
    ).count()

    return {
        "total_goals": len(goals),
        "active_goals": len(active),
        "completed_goals": len(completed),
        "at_risk_goals": len(at_risk),
        "avg_completion_pct": round(avg_pct, 1),
        "pending_review_forms": pending_forms,
        "probation_status": probation.probation_status.value if probation else None,
        "unread_notifications": unread,
    }


@router.get("/team")
def team_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_manager_or_admin(current_user)
    from app.services.probation_service import probation_service

    if current_user.role == UserRole.ADMIN:
        members = db.query(User).filter(User.is_active == True).all()
        team = None
    else:
        team = db.query(Team).filter(Team.id == current_user.team_id).first()
        members = db.query(User).filter(
            User.team_id == current_user.team_id,
            User.id != current_user.id
        ).all()

    member_stats = []
    all_at_risk = 0
    all_completion = []

    for member in members:
        goals = db.query(Goal).filter(Goal.assignee_id == member.id).all()
        active = sum(1 for g in goals if g.status == GoalStatus.ACTIVE)
        comp = sum(1 for g in goals if g.status in [GoalStatus.COMPLETED, GoalStatus.SCORED])
        at_risk = sum(1 for g in goals if g.is_at_risk)
        avg = (sum(g.completion_percentage for g in goals) / len(goals)) if goals else 0.0
        all_at_risk += at_risk
        all_completion.append(avg)
        member_stats.append({
            "user_id": member.id,
            "name": member.name,
            "total_goals": len(goals),
            "active": active,
            "completed": comp,
            "at_risk": at_risk,
            "avg_completion_pct": round(avg, 1),
        })

    # Detailed pending approvals
    pending_approvals_list = db.query(Goal).filter(
        Goal.status == GoalStatus.PENDING_APPROVAL,
        Goal.team_id == current_user.team_id if current_user.team_id else True
    ).all()

    # Detailed pending reviews for team members (Self-assessments or manager reviews not yet complete)
    team_member_ids = [m.id for m in members]
    pending_reviews_list = db.query(ReviewForm).filter(
        ReviewForm.employee_id.in_(team_member_ids),
        ReviewForm.status.in_([ReviewFormStatus.PENDING, ReviewFormStatus.IN_PROGRESS])
    ).all()

    # Flagged team members (Based on their forms)
    flagged_forms = db.query(ReviewForm).filter(
        ReviewForm.employee_id.in_(team_member_ids),
        ReviewForm.is_flagged > 0
    ).all()

    # Probation records for team members
    probation_list = db.query(ProbationRecord).filter(
        ProbationRecord.employee_id.in_(team_member_ids),
        ProbationRecord.probation_status == ProbationStatus.IN_PROBATION
    ).all()

    return {
        "team_id": team.id if team else None,
        "team_name": team.name if team else "All Teams",
        "members": member_stats,
        "team_completion_pct": round(sum(all_completion) / len(all_completion), 1) if all_completion else 0.0,
        "pending_approvals_count": len(pending_approvals_list),
        "pending_approvals": [
            {
                "id": g.id,
                "title": g.title,
                "assignee_name": g.assignee.name if g.assignee else "Unknown",
                "weightage": g.weightage,
                "priority": g.priority.value
            } for g in pending_approvals_list
        ],
        "at_risk_count": all_at_risk,
        "flagged_members": [
            {
                "id": f.id,
                "employee_name": f.employee.name if f.employee else "Unknown",
                "reason": f.flag_reason,
                "level": "Red" if f.is_flagged == 2 else "Soft"
            } for f in flagged_forms
        ],
        "probation_members": [
            {
                "id": p.id,
                "employee_name": p.employee.name if p.employee else "Unknown",
                "status": probation_service.get_calculated_status(p),
                "end_date": probation_service.get_probation_end_date(p).isoformat() if probation_service.get_probation_end_date(p) else None,
                "milestones": [
                    {"day": t.trigger_day, "status": t.status.value} for t in p.triggers
                ]
            } for p in probation_list
        ],
        "pending_reviews": [
            {
                "id": f.id,
                "employee_name": f.employee.name if f.employee else "Unknown",
                "type": f.form_type.value,
                "status": f.status.value
            } for f in pending_reviews_list
        ]
    }


@router.get("/company")
def company_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_admin(current_user)

    total_employees = db.query(User).filter(User.is_active == True).count()
    goals = db.query(Goal).all()
    active_goals = sum(1 for g in goals if g.status == GoalStatus.ACTIVE)
    completed_goals = sum(1 for g in goals if g.status in [GoalStatus.COMPLETED, GoalStatus.SCORED])
    at_risk_goals = sum(1 for g in goals if g.is_at_risk)

    teams = db.query(Team).all()
    team_stats = []
    for team in teams:
        team_goals = [g for g in goals if g.team_id == team.id]
        avg = (sum(g.completion_percentage for g in team_goals) / len(team_goals)) if team_goals else 0.0
        team_stats.append({
            "team_id": team.id,
            "team_name": team.name,
            "completion_pct": round(avg, 1),
            "total_goals": len(team_goals),
        })

    probation_in_progress = db.query(ProbationRecord).filter(
        ProbationRecord.probation_status == ProbationStatus.IN_PROBATION
    ).count()

    open_cycles = db.query(ReviewCycle).filter(
        ReviewCycle.status == ReviewCycleStatus.ACTIVE
    ).count()

    from app.enums import ProbationTriggerStatus
    from app.models.probation import ProbationTrigger
    pending_escalations = db.query(ProbationTrigger).filter(
        ProbationTrigger.status == ProbationTriggerStatus.ESCALATED
    ).count()

    return {
        "total_employees": total_employees,
        "total_goals": len(goals),
        "active_goals": active_goals,
        "completed_goals": completed_goals,
        "at_risk_goals": at_risk_goals,
        "teams": team_stats,
        "probation_in_progress": probation_in_progress,
        "open_review_cycles": open_cycles,
        "pending_escalations": pending_escalations,
    }
