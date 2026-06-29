from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.goal import Goal
from app.models.user import User
from app.services.hierarchy_service import can_read
from app.enums import GoalStatus, GoalTag

router = APIRouter()

@router.get("/users/{user_id}/weightage/{tag}")
def get_remaining_weightage(user_id: int, tag: GoalTag, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get remaining weightage % for a user's goals in a specific period.
    Visible to the user themselves, their managers in the chain, or an admin."""
    role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    if role.lower() != 'admin' and not can_read(db, current_user, user_id):
        raise HTTPException(status_code=403, detail="Not authorized to view this user's weightage")
    goals = db.query(Goal).filter(
        Goal.assignee_id == user_id,
        Goal.tag == tag,
        Goal.status.in_([GoalStatus.DRAFT, GoalStatus.PENDING_APPROVAL, GoalStatus.ACTIVE])
    ).all()
    
    used_weightage = sum(g.weightage for g in goals)
    remaining = 100 - used_weightage
    
    return {
        "tag": tag,
        "used_weightage": used_weightage,
        "remaining_weightage": remaining,
        "goals_count": len(goals)
    }
