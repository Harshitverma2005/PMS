"""
Achievement service — create and list achievements.
"""

from datetime import datetime
from typing import Optional, List

from sqlalchemy.orm import Session

from app.enums import AchievementCategory, TimelineEventType
from app.models.achievement import Achievement
from app.models.goal import Goal
from app.models.user import User


def create_achievement(db: Session, data, employee_id: int) -> Achievement:
    """
    Create a new achievement for *employee_id*.
    - Ignores any employee_id in data body.
    - Validates goal_id if provided.
    - Validates evidence_url scheme if provided.
    """
    from app.services import timeline_service

    # Validate goal_id
    if data.goal_id is not None:
        goal = db.query(Goal).filter(Goal.id == data.goal_id).first()
        if goal is None:
            raise ValueError("Goal not found")
        if goal.assignee_id != employee_id:
            raise ValueError("Goal does not belong to this employee")

    # Validate evidence_url scheme
    if data.evidence_url is not None:
        url_str = str(data.evidence_url)
        if not (url_str.startswith("http://") or url_str.startswith("https://")):
            raise ValueError("evidence_url must use http or https scheme")

    achievement = Achievement(
        employee_id=employee_id,
        title=data.title,
        description=data.description,
        category=data.category,
        evidence_url=str(data.evidence_url) if data.evidence_url else None,
        goal_id=data.goal_id,
        created_at=datetime.utcnow(),
    )
    db.add(achievement)
    db.flush()

    timeline_service.emit(
        db=db,
        employee_id=employee_id,
        event_type=TimelineEventType.ACHIEVEMENT_LOGGED,
        title=data.title,
        summary=data.category.value if hasattr(data.category, 'value') else str(data.category),
        source_id=achievement.id,
    )

    db.commit()
    db.refresh(achievement)
    return achievement


def list_achievements(
    db: Session,
    requesting_user: User,
    employee_id: Optional[int] = None,
) -> List[Achievement]:
    """
    - Member: return their own achievements ordered DESC created_at.
    - Manager: if employee_id provided, verify direct manager relationship, then return that employee's achievements.
    """
    from app.services.hierarchy_service import is_direct_manager
    from app.enums import UserRole

    role = requesting_user.role.value if hasattr(requesting_user.role, 'value') else str(requesting_user.role)

    if role in ["member", "employee"] or employee_id is None:
        target_id = requesting_user.id
    else:
        # Admin can view anyone; a manager only their direct reports.
        if role.lower() != "admin" and not is_direct_manager(db, requesting_user.id, employee_id):
            raise PermissionError("You can only view achievements of your direct reports")
        target_id = employee_id

    return (
        db.query(Achievement)
        .filter(Achievement.employee_id == target_id)
        .order_by(Achievement.created_at.desc())
        .all()
    )
