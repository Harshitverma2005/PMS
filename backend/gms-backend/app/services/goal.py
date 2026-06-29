from sqlalchemy.orm import Session
from datetime import datetime, date
from typing import Optional
from app.repositories.goal import goal_repository
from app.repositories.user import user_repository
from app.schemas.goal import GoalCreate, GoalUpdate, ProgressUpdate, SubtaskCreate, SubtaskUpdate, GoalStats
from app.models.goal import Goal
from app.models.subtask import Subtask
from app.models.progress import Progress
from app.enums import GoalStatus, GoalLevel, UserRole

class GoalService:
    def create_goal(self, db: Session, goal_data: GoalCreate, creator_id: int) -> Goal:
        creator = user_repository.get_by_id(db, creator_id)
        assignee = user_repository.get_by_id(db, goal_data.assignee_id)
        
        if not creator or not assignee:
            raise ValueError("Creator or assignee not found")
        
        # Validate parent_id hierarchy
        if goal_data.parent_id:
            parent = db.query(Goal).filter(Goal.id == goal_data.parent_id).first()
            if not parent:
                raise ValueError("Parent goal not found")
            valid_parents = {
                GoalLevel.TEAM: [GoalLevel.COMPANY],
                GoalLevel.INDIVIDUAL: [GoalLevel.TEAM, GoalLevel.COMPANY],
            }
            allowed = valid_parents.get(goal_data.level, [])
            if parent.level not in allowed:
                raise ValueError(f"{goal_data.level} goal parent must be one of: {[l.value for l in allowed]}")
        elif goal_data.level == GoalLevel.COMPANY and goal_data.parent_id is not None:
            raise ValueError("Company goals cannot have a parent")
        
        # Validate total weightage doesn't exceed 100% for user's goals in same period
        existing_goals = db.query(Goal).filter(
            Goal.assignee_id == goal_data.assignee_id,
            Goal.tag == goal_data.tag,
            Goal.status.in_([GoalStatus.DRAFT, GoalStatus.PENDING_APPROVAL, GoalStatus.ACTIVE])
        ).all()
        
        total_weightage = sum(g.weightage for g in existing_goals) + goal_data.weightage
        if total_weightage > 100:
            raise ValueError(
                f"Total weightage ({total_weightage}%) exceeds 100%. "
                f"Current: {sum(g.weightage for g in existing_goals)}%, "
                f"Trying to add: {goal_data.weightage}% ({goal_data.priority})"
            )
        
        # Robust role check via string value comparison
        creator_role = creator.role.value if hasattr(creator.role, 'value') else str(creator.role)
        role = creator_role.lower()
        if creator_id != goal_data.assignee_id and role in [UserRole.ADMIN.value, UserRole.MANAGER.value]:
            # Manager/admin assigning a goal to someone else -> goes straight to active.
            status = GoalStatus.ACTIVE
        elif role == UserRole.MEMBER.value:
            # Employee proposing their own goal -> waits for their manager's approval.
            status = GoalStatus.PENDING_APPROVAL
        else:
            # Manager/admin's own goal -> active.
            status = GoalStatus.ACTIVE
        
        goal_dict = goal_data.model_dump(exclude={'subtasks'})
        goal_dict['due_date'] = goal_data.due_date
        goal_dict['weightage'] = goal_data.weightage
        goal_dict['status'] = status
        goal_dict['creator_id'] = creator_id
        goal_dict['team_id'] = assignee.team_id
        
        goal = goal_repository.create(db, **goal_dict)

        # Add initial subtasks
        if goal_data.subtasks:
            for st_data in goal_data.subtasks:
                subtask = Subtask(goal_id=goal.id, **st_data.model_dump())
                db.add(subtask)
            db.commit()
            db.refresh(goal)

        # Emit timeline event
        try:
            from app.services import timeline_service
            from app.enums import TimelineEventType
            timeline_service.emit(
                db=db,
                employee_id=goal.assignee_id,
                event_type=TimelineEventType.GOAL_CREATED,
                title=goal.title,
                summary=f"Goal created with status {goal.status.value}",
                source_id=goal.id,
            )
        except Exception:
            pass  # Timeline failures should not break goal creation

        return goal
    
    def update_goal(self, db: Session, goal_id: int, goal_data: GoalUpdate, user_id: int) -> Goal:
        goal = goal_repository.get_by_id(db, goal_id)
        if not goal:
            raise ValueError("Strategic objective not found")
        if goal.creator_id != user_id:
            raise ValueError("Unauthorized - only the creator can modify this objective")
        
        # Only allow editing in DRAFT, REJECTED, or PENDING_APPROVAL status
        allowed_edit_statuses = [GoalStatus.DRAFT, GoalStatus.REJECTED, GoalStatus.PENDING_APPROVAL]
        if goal.status not in allowed_edit_statuses:
            raise ValueError(f"Objectives in '{goal.status.value}' state cannot be modified")
            
        update_dict = goal_data.model_dump(exclude_unset=True, exclude={'subtasks'})
        
        # Handle subtasks separately if provided
        if goal_data.subtasks is not None:
            # Simple strategy: clear existing and re-add (for Edit Mode)
            db.query(Subtask).filter(Subtask.goal_id == goal_id).delete()
            for st_data in goal_data.subtasks:
                new_st = Subtask(goal_id=goal_id, **st_data.model_dump())
                db.add(new_st)
        
        # Re-calculate due_date if start_date or tag changes
        if 'start_date' in update_dict or 'tag' in update_dict:
            # Need schemas.goal.GoalCreate's logic or model logic
            from app.schemas.goal import GoalCreate, GoalTag
            tag = update_dict.get('tag', goal.tag)
            start_date = update_dict.get('start_date', goal.start_date)
            # Simple duration map here too
            tag_duration = {
                GoalTag.DAILY: 1, GoalTag.WEEKLY: 7, GoalTag.MONTHLY: 30,
                GoalTag.QUARTERLY: 90, GoalTag.YEARLY: 365
            }
            from datetime import timedelta
            update_dict['due_date'] = start_date + timedelta(days=tag_duration[tag])
            
        if 'priority' in update_dict:
            from app.schemas.goal import PRIORITY_WEIGHTAGE
            update_dict['weightage'] = PRIORITY_WEIGHTAGE[update_dict['priority']]
            
        return goal_repository.update(db, goal, **update_dict)
    
    def get_goal_with_stats(self, db: Session, goal_id: int) -> Optional[Goal]:
        goal = goal_repository.get_by_id(db, goal_id)
        if goal:
            goal.stats = GoalStats(
                days_remaining=goal.days_remaining,
                days_elapsed=goal.days_elapsed,
                total_days=goal.total_days,
                time_elapsed_percentage=goal.time_elapsed_percentage,
                is_overdue=goal.is_overdue,
                is_at_risk=goal.is_at_risk
            )
        return goal
    
    def add_subtask(self, db: Session, goal_id: int, subtask_data: SubtaskCreate, user_id: int) -> Subtask:
        goal = goal_repository.get_by_id(db, goal_id)
        if not goal:
            raise ValueError("Goal not found")
        if goal.assignee_id != user_id and goal.creator_id != user_id:
            raise ValueError("Unauthorized - only assignee or creator can add subtasks")
        
        subtask = Subtask(goal_id=goal_id, **subtask_data.model_dump())
        db.add(subtask)
        db.commit()
        db.refresh(subtask)
        return subtask
    
    def delete_goal(self, db: Session, goal_id: int, user_id: int) -> bool:
        from app.services import hierarchy_service

        goal = goal_repository.get_by_id(db, goal_id)
        if not goal:
            raise ValueError("Goal not found")

        # A manager may delete goals belonging to their direct reports.
        # Admins are intentionally NOT allowed to delete goals.
        is_manager_of_assignee = (
            goal.assignee_id is not None
            and hierarchy_service.is_direct_manager(db, user_id, goal.assignee_id)
        )

        if (
            goal.creator_id != user_id
            and goal.assignee_id != user_id
            and not is_manager_of_assignee
        ):
            raise ValueError("Unauthorized - only the creator, assignee, or their direct manager can delete this goal")

        # We can implement a soft-delete or hard-delete here
        goal_repository.delete(db, id=goal_id)
        return True

    def delete_subtask_by_id(self, db: Session, goal_id: int, subtask_id: int, user_id: int) -> bool:
        subtask = db.query(Subtask).filter(Subtask.id == subtask_id, Subtask.goal_id == goal_id).first()
        if not subtask:
            raise ValueError("Subtask not found for this goal")
        
        goal = goal_repository.get_by_id(db, goal_id)
        if not goal:
            raise ValueError("Goal not found")
        if goal.assignee_id != user_id and goal.creator_id != user_id:
            raise ValueError("Unauthorized - only assignee or creator can remove milestones")
        
        db.delete(subtask)
        db.commit()
        self._recalculate_goal_completion(db, goal)
        return True

    def update_subtask(self, db: Session, subtask_id: int, subtask_data: SubtaskUpdate, user_id: int) -> Subtask:
        subtask = db.query(Subtask).filter(Subtask.id == subtask_id).first()
        if not subtask:
            raise ValueError("Subtask not found")
        
        goal = goal_repository.get_by_id(db, subtask.goal_id)
        if not goal:
            raise ValueError("Goal not found")
        if goal.assignee_id != user_id and goal.creator_id != user_id:
            raise ValueError("Unauthorized - only assignee or creator can update subtasks")
        
        for key, value in subtask_data.model_dump(exclude_unset=True).items():
            setattr(subtask, key, value)
        
        if subtask_data.is_completed and not subtask.completed_at:
            subtask.completed_at = datetime.utcnow()
        
        db.commit()
        db.refresh(subtask)
        
        self._recalculate_goal_completion(db, goal)
        return subtask
    
    def _recalculate_goal_completion(self, db: Session, goal: Goal):
        subtasks = db.query(Subtask).filter(Subtask.goal_id == goal.id).all()
        if subtasks:
            completed = sum(1 for s in subtasks if s.is_completed)
            goal.completion_percentage = (completed / len(subtasks)) * 100
            db.commit()
    
    def submit_for_approval(self, db: Session, goal_id: int, user_id: int) -> Goal:
        goal = goal_repository.get_by_id(db, goal_id)
        if not goal or goal.creator_id != user_id:
            raise ValueError("Objective not found or unauthorized access")
        if goal.status not in [GoalStatus.DRAFT, GoalStatus.REJECTED]:
            raise ValueError("Only draft or rejected objectives can be submitted for deployment")
        result = goal_repository.update(db, goal, status=GoalStatus.PENDING_APPROVAL)
        from app.services.notification_service import notification_service
        notification_service.notify_goal_submitted(db, result)
        return result
    
    def approve_goal(self, db: Session, goal_id: int, evaluator_id: int, approved: bool, comment: str = None) -> Goal:
        goal = goal_repository.get_by_id(db, goal_id)
        evaluator = user_repository.get_by_id(db, evaluator_id)
        assignee = user_repository.get_by_id(db, goal.assignee_id)
        
        if not goal or not evaluator or not assignee:
            raise ValueError("Goal, evaluator, or assignee not found")
        
        if goal.status != GoalStatus.PENDING_APPROVAL:
            raise ValueError("Goal is not pending approval")
        
        # Robust role retrieval: Handle Enum, string, or Enum-as-string cases
        role_raw = str(evaluator.role.value if hasattr(evaluator.role, 'value') else evaluator.role)
        # Handle potential "UserRole.manager" from str(Enum)
        role_val = role_raw.split('.')[-1].lower()
        
        # User requirement (Member can approve/reject member)
        # Any Admin, Manager, or Member can approve, as long as it's not their own goal
        if evaluator_id == assignee.id:
            raise ValueError("Unauthorized: You cannot approve your own goal. Please ask your manager or a peer.")
        
        # Admin, Manager, or any Peer can approve for now (per user's flow requirement)
        allowed_roles = [UserRole.ADMIN.value, UserRole.MANAGER.value]
        if role_val not in allowed_roles:
            raise ValueError(f"Not authorized to approve this goal. User role '{role_val}' is not in allowed roles {allowed_roles}")
        
        from app.services.notification_service import notification_service
        if approved:
            result = goal_repository.update(db, goal, status=GoalStatus.ACTIVE)
            notification_service.notify_goal_approved(db, result)
            try:
                from app.services import timeline_service
                from app.enums import TimelineEventType
                timeline_service.emit(
                    db=db,
                    employee_id=result.assignee_id,
                    event_type=TimelineEventType.GOAL_APPROVED,
                    title=result.title,
                    summary="Goal approved and activated",
                    source_id=result.id,
                )
            except Exception:
                pass
            return result
        else:
            if not comment:
                raise ValueError("Rejection comment is mandatory")
            result = goal_repository.update(db, goal, status=GoalStatus.REJECTED)
            notification_service.notify_goal_rejected(db, result, comment)
            return result
    
    def update_progress(self, db: Session, goal_id: int, progress_data: ProgressUpdate, user_id: int) -> Progress:
        goal = goal_repository.get_by_id(db, goal_id)
        if not goal or goal.assignee_id != user_id:
            raise ValueError("Goal not found or unauthorized")
        if goal.status != GoalStatus.ACTIVE:
            raise ValueError("Can only update progress for active goals")
        
        progress = Progress(
            goal_id=goal_id,
            completion_percentage=progress_data.completion_percentage,
            notes=progress_data.notes
        )
        db.add(progress)

        goal_repository.update(db, goal, completion_percentage=progress_data.completion_percentage)

        if progress_data.completion_percentage >= 100:
            goal_repository.update(db, goal, status=GoalStatus.COMPLETED)
            # Auto-transition to awaiting feedback
            goal_repository.update(db, goal, status=GoalStatus.AWAITING_FEEDBACK)
            try:
                from app.services import timeline_service
                from app.enums import TimelineEventType
                timeline_service.emit(
                    db=db,
                    employee_id=goal.assignee_id,
                    event_type=TimelineEventType.GOAL_COMPLETED,
                    title=goal.title,
                    summary="Goal completed at 100%",
                    source_id=goal.id,
                )
            except Exception:
                pass

        # Emit progress_updated event
        try:
            from app.services import timeline_service
            from app.enums import TimelineEventType
            timeline_service.emit(
                db=db,
                employee_id=goal.assignee_id,
                event_type=TimelineEventType.PROGRESS_UPDATED,
                title=goal.title,
                summary=progress_data.notes or f"{progress_data.completion_percentage}% complete",
                source_id=progress.id,
            )
        except Exception:
            pass

        db.commit()
        db.refresh(progress)
        return progress
    
    def check_at_risk(self, goal: Goal) -> bool:
        if goal.status != GoalStatus.ACTIVE:
            return False
        
        today = date.today()
        total_days = (goal.due_date - goal.created_at.date()).days
        elapsed_days = (today - goal.created_at.date()).days
        
        time_elapsed_pct = (elapsed_days / total_days * 100) if total_days > 0 else 0
        
        return time_elapsed_pct > 70 and goal.completion_percentage < 50

goal_service = GoalService()
