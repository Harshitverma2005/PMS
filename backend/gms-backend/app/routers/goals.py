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
    
    # Scope visibility by role:
    #   members  -> only their own goals
    #   managers -> only their direct reports' goals (+ their own / ones they created)
    #   admins   -> everything
    if role in ['member', 'employee']:
        goals = [g for g in goals if g.assignee_id == current_user.id]
    elif role == 'manager':
        report_ids = {u.id for u in db.query(User).filter(User.manager_id == current_user.id).all()}
        report_ids.add(current_user.id)
        goals = [g for g in goals if g.assignee_id in report_ids or g.creator_id == current_user.id]

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
    from app.services.hierarchy_service import is_direct_manager
    from app.repositories.goal import goal_repository
    require_manager_or_admin(current_user)

    goal = goal_repository.get_by_id(db, goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    if role.lower() != 'admin' and not is_direct_manager(db, current_user.id, goal.assignee_id):
        raise HTTPException(status_code=403, detail="Only the assignee's direct manager can approve or reject this goal")

    try:
        return goal_service.approve_goal(db, goal_id, current_user.id, approval.approved, approval.rejection_comment)
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
    """Assignee marks a goal done — it moves to 'pending review' (awaiting_feedback)
    for the manager to accept / reject / request changes."""
    try:
        from app.repositories.goal import goal_repository
        from app.services import goal_history_service

        goal = goal_repository.get_by_id(db, goal_id)
        if not goal:
            raise HTTPException(status_code=404, detail="Goal not found")

        role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
        is_manager_or_admin = role.lower() in ['admin', 'manager']
        if goal.assignee_id != current_user.id and not is_manager_or_admin:
            raise HTTPException(status_code=403, detail="Unauthorized - Only the assignee can submit this goal for review")
        if goal.status != GoalStatus.ACTIVE:
            raise HTTPException(status_code=400, detail="Can only submit an active goal for review")

        from_status = goal.status
        goal_repository.update(db, goal, status=GoalStatus.AWAITING_FEEDBACK, completion_percentage=100)
        goal_history_service.record_transition(db, goal_id, from_status, GoalStatus.AWAITING_FEEDBACK, current_user.id, "Submitted for review")
        return goal_service.get_goal_with_stats(db, goal_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{goal_id}/review")
def review_completion(goal_id: int, body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Manager reviews a goal that's pending review:
       action = 'accept' -> completed, 'reject' -> rejected, 'modify' -> back to active.
       A comment (required for modify/reject) is recorded and shown to the employee."""
    try:
        from app.repositories.goal import goal_repository
        from app.services import goal_history_service, hierarchy_service

        goal = goal_repository.get_by_id(db, goal_id)
        if not goal:
            raise HTTPException(status_code=404, detail="Goal not found")
        if goal.status != GoalStatus.AWAITING_FEEDBACK:
            raise HTTPException(status_code=400, detail="This goal is not pending review")

        role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
        is_admin = role.lower() == 'admin'
        if not is_admin and not hierarchy_service.is_direct_manager(db, current_user.id, goal.assignee_id):
            raise HTTPException(status_code=403, detail="Only the assignee's manager can review this goal")

        action = (body.get('action') or '').lower()
        comment = body.get('comment') or ''
        mapping = {'accept': GoalStatus.COMPLETED, 'reject': GoalStatus.REJECTED, 'modify': GoalStatus.ACTIVE}
        if action not in mapping:
            raise HTTPException(status_code=400, detail="action must be accept, reject, or modify")
        if action in ('modify', 'reject') and not comment.strip():
            raise HTTPException(status_code=400, detail="A comment is required when rejecting or requesting changes")

        new_status = mapping[action]
        from_status = goal.status
        goal_repository.update(db, goal, status=new_status)
        goal_history_service.record_transition(db, goal_id, from_status, new_status, current_user.id, comment)
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
