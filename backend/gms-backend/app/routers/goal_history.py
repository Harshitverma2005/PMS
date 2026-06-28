"""
Goal history router — GET /{goal_id}/history, POST /{goal_id}/approve, POST /{goal_id}/archive
These are mounted at /api/v1/goals in main.py.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.dependencies import get_current_user
from app.models.goal import Goal
from app.models.user import User
from app.schemas.goal_history import (
    GoalStatusHistoryResponse,
    GoalApproveRequest,
    GoalArchiveRequest,
)
from app.services import goal_history_service
from app.services.hierarchy_service import is_direct_manager, can_read
from app.enums import GoalStatus, UserRole

router = APIRouter()


def _get_goal_or_404(db: Session, goal_id: int) -> Goal:
    goal = db.query(Goal).filter(Goal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal


@router.get("/{goal_id}/history", response_model=List[GoalStatusHistoryResponse])
def get_goal_history(
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get status transition history for a goal."""
    goal = _get_goal_or_404(db, goal_id)

    # Access: own goal, or manager with read access
    if current_user.id != goal.assignee_id:
        if not can_read(db, current_user, goal.assignee_id):
            raise HTTPException(status_code=403, detail="Access denied")

    return goal_history_service.get_history(db, goal_id)


@router.post("/{goal_id}/approve")
def approve_goal(
    goal_id: int,
    body: GoalApproveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manager only — approve or reject a goal in pending_approval status."""
    role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    if role not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Only managers can approve or reject goals")

    goal = _get_goal_or_404(db, goal_id)

    # Must be direct manager
    if not is_direct_manager(db, current_user.id, goal.assignee_id):
        raise HTTPException(status_code=403, detail="Action requires direct manager relationship")

    if goal.status != GoalStatus.PENDING_APPROVAL:
        raise HTTPException(status_code=400, detail="Goal must be in pending_approval status")

    from_status = goal.status
    new_status = GoalStatus.ACTIVE if body.approved else GoalStatus.REJECTED

    goal.status = new_status
    goal_history_service.record_transition(
        db=db,
        goal_id=goal_id,
        from_status=from_status,
        to_status=new_status,
        actor_id=current_user.id,
        comment=body.comment,
    )
    db.commit()

    return {"message": f"Goal {'approved' if body.approved else 'rejected'}", "status": new_status.value}


@router.post("/{goal_id}/archive")
def archive_goal(
    goal_id: int,
    body: GoalArchiveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Member (own goal) or manager (direct report's goal) can archive a goal."""
    goal = _get_goal_or_404(db, goal_id)

    role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)

    if current_user.id == goal.assignee_id:
        pass  # Owner can archive
    elif role in ["manager", "admin"]:
        if not is_direct_manager(db, current_user.id, goal.assignee_id):
            raise HTTPException(status_code=403, detail="Action requires direct manager relationship")
    else:
        raise HTTPException(status_code=403, detail="Access denied")

    from_status = goal.status
    goal.status = GoalStatus.ARCHIVED if hasattr(GoalStatus, 'ARCHIVED') else GoalStatus.REJECTED

    goal_history_service.record_transition(
        db=db,
        goal_id=goal_id,
        from_status=from_status,
        to_status=goal.status,
        actor_id=current_user.id,
        comment=body.archive_reason,
    )
    db.commit()

    return {"message": "Goal archived", "status": goal.status.value}
