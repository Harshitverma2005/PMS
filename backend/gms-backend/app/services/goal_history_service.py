"""
Goal history service — record status transitions and fetch history.
"""

from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session

from app.enums import GoalStatus, TimelineEventType
from app.models.goal_history import GoalStatusHistory
from app.models.goal import Goal
from app.schemas.goal_history import GoalStatusHistoryResponse


def record_transition(
    db: Session,
    goal_id: int,
    from_status: Optional[GoalStatus],
    to_status: GoalStatus,
    actor_id: int,
    comment: Optional[str] = None,
) -> GoalStatusHistory:
    """Insert a GoalStatusHistory row and emit a timeline event."""
    from app.services import timeline_service

    goal = db.query(Goal).filter(Goal.id == goal_id).first()
    title = goal.title if goal else f"Goal #{goal_id}"
    employee_id = goal.assignee_id if goal else actor_id

    entry = GoalStatusHistory(
        goal_id=goal_id,
        from_status=from_status,
        to_status=to_status,
        actor_id=actor_id,
        timestamp=datetime.utcnow(),
        comment=comment,
    )
    db.add(entry)
    db.flush()  # get id without full commit

    summary_text = f"{from_status.value if from_status else 'None'} → {to_status.value}"
    if comment:
        summary_text += f" — {comment}"

    timeline_service.emit(
        db=db,
        employee_id=employee_id,
        event_type=TimelineEventType.GOAL_STATUS_CHANGED,
        title=title,
        summary=summary_text,
        source_id=goal_id,
    )

    db.commit()
    db.refresh(entry)
    return entry


def get_history(db: Session, goal_id: int) -> List[GoalStatusHistoryResponse]:
    """Return full status transition history for a goal, ordered ascending."""
    rows = (
        db.query(GoalStatusHistory)
        .filter(GoalStatusHistory.goal_id == goal_id)
        .order_by(GoalStatusHistory.timestamp.asc())
        .all()
    )
    result = []
    for row in rows:
        actor_name = row.actor.name if row.actor else "Unknown"
        result.append(GoalStatusHistoryResponse(
            from_status=row.from_status,
            to_status=row.to_status,
            actor_id=row.actor_id,
            actor_name=actor_name,
            timestamp=row.timestamp,
            comment=row.comment,
        ))
    return result
