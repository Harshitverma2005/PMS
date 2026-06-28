from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.services.goal import goal_service
from app.services.feedback import feedback_service
from app.services.score import score_service
from app.schemas import goal as goal_schema
from app.schemas import feedback as feedback_schema
from app.schemas import score as score_schema
from app.dependencies import get_current_user
from app.models.user import User
from app.enums import GoalStatus

router = APIRouter()

@router.get("/", response_model=List[goal_schema.Goal])
def get_goals(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.repositories.goal import goal_repository
    from app.schemas.feedback import Feedback as FeedbackSchema
    from app.schemas.score import Score as ScoreSchema
    
    goals = goal_repository.get_all(db)
    
    # Normalize role for check
    role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    role = role.lower()
    
    # Filter for members: Only see self-assigned goals
    if role in ['member', 'employee']:
        goals = [g for g in goals if g.assignee_id == current_user.id]
    
    result = []
    for goal in goals:
        goal_dict = goal_schema.Goal.model_validate(goal).model_dump()
        goal_dict['feedbacks'] = [FeedbackSchema.model_validate(f).model_dump() for f in goal.feedbacks]
        goal_dict['score'] = ScoreSchema.model_validate(goal.score).model_dump() if goal.score else None
        goal_dict['is_at_risk'] = goal.is_at_risk
        result.append(goal_dict)
    return result

@router.post("/", response_model=goal_schema.Goal, status_code=status.HTTP_201_CREATED)
def create_goal(goal_in: goal_schema.GoalCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return goal_service.create_goal(db, goal_in, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/{goal_id}", response_model=goal_schema.Goal)
def update_goal(
    goal_id: int, 
    goal_in: goal_schema.GoalUpdate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    try:
        return goal_service.update_goal(db, goal_id, goal_in, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{goal_id}", response_model=goal_schema.Goal)
def get_goal(goal_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.schemas.feedback import Feedback as FeedbackSchema
    from app.schemas.score import Score as ScoreSchema
    goal = goal_service.get_goal_with_stats(db, goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    goal_dict = goal_schema.Goal.model_validate(goal).model_dump()
    goal_dict['feedbacks'] = [FeedbackSchema.model_validate(f).model_dump() for f in goal.feedbacks]
    goal_dict['score'] = ScoreSchema.model_validate(goal.score).model_dump() if goal.score else None
    return goal_dict

@router.post("/{goal_id}/subtasks", response_model=goal_schema.Subtask)
def add_subtask(goal_id: int, subtask: goal_schema.SubtaskCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return goal_service.add_subtask(db, goal_id, subtask, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/subtasks/{subtask_id}", response_model=goal_schema.Subtask)
def update_subtask(subtask_id: int, subtask: goal_schema.SubtaskUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return goal_service.update_subtask(db, subtask_id, subtask, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{goal_id}/submit", response_model=goal_schema.Goal)
def submit_goal(goal_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return goal_service.submit_for_approval(db, goal_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{goal_id}/approve", response_model=goal_schema.Goal)
def approve_goal(
    goal_id: int, 
    approval: goal_schema.GoalApproval, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    from app.permissions import require_manager_or_admin
    require_manager_or_admin(current_user)
    
    try:
        comment = approval.comment.strip() if approval.comment else approval.rejection_comment
        result = goal_service.approve_goal(db, goal_id, current_user.id, approval.approved, comment)
        # Record history transition
        try:
            from app.services.goal_history_service import record_transition
            from app.enums import GoalStatus
            from_status = GoalStatus.PENDING_APPROVAL
            to_status = GoalStatus.ACTIVE if approval.approved else GoalStatus.REJECTED
            record_transition(db, goal_id, from_status, to_status, current_user.id, comment)
        except Exception:
            pass
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{goal_id}/progress")
def update_progress(goal_id: int, progress: goal_schema.ProgressUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return goal_service.update_progress(db, goal_id, progress, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{goal_id}/complete")
def complete_goal(goal_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        # Allow assignee, manager, or admin to complete
        role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
        is_manager_or_admin = role.lower() in ['admin', 'manager']
        
        if not goal or (goal.assignee_id != current_user.id and not is_manager_or_admin):
            raise HTTPException(status_code=403, detail="Unauthorized - Only assignee or manager/admin can resolve this goal")
        if goal.status != GoalStatus.ACTIVE:
            raise HTTPException(status_code=400, detail="Can only complete active goals")
        
        from app.repositories.goal import goal_repository
        goal_repository.update(db, goal, status=GoalStatus.AWAITING_FEEDBACK, completion_percentage=100)
        return goal_service.get_goal_with_stats(db, goal_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
@router.delete("/{goal_id}/archive", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(goal_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        goal_service.delete_goal(db, goal_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{goal_id}/subtasks/{subtask_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subtask(goal_id: int, subtask_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        goal_service.delete_subtask_by_id(db, goal_id, subtask_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{goal_id}/feedback/member", response_model=feedback_schema.Feedback)
def submit_member_feedback(goal_id: int, feedback: feedback_schema.MemberFeedbackCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return feedback_service.submit_member_feedback(db, goal_id, current_user.id, feedback)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{goal_id}/feedback/evaluator", response_model=feedback_schema.Feedback)
def submit_evaluator_feedback(goal_id: int, feedback: feedback_schema.EvaluatorFeedbackCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return feedback_service.submit_evaluator_feedback(db, goal_id, current_user.id, feedback)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{goal_id}/score", response_model=score_schema.Score)
def score_goal(
    goal_id: int, 
    score: score_schema.ScoreCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    from app.permissions import require_manager_or_admin
    require_manager_or_admin(current_user)
    
    try:
        return score_service.score_goal(db, goal_id, current_user.id, score)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
