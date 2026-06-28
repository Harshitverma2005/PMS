from pydantic import BaseModel, field_validator
from datetime import date, timedelta
from app.enums import GoalStatus, GoalLevel, GoalTag, GoalPriority
from typing import Optional, List, TYPE_CHECKING, Any

PRIORITY_WEIGHTAGE = {
    GoalPriority.CRITICAL: 40,
    GoalPriority.HIGH: 30,
    GoalPriority.MEDIUM: 20,
    GoalPriority.LOW: 10
}

class UserInfo(BaseModel):
    id: int
    name: str
    email: str
    role: str
    team_id: Optional[int] = None
    
    class Config:
        from_attributes = True

class TeamInfo(BaseModel):
    id: int
    name: str
    
    class Config:
        from_attributes = True

class UserWithTeam(UserInfo):
    team: Optional[TeamInfo] = None

class GoalBase(BaseModel):
    title: str
    description: str
    level: GoalLevel = GoalLevel.INDIVIDUAL
    tag: GoalTag
    priority: GoalPriority
    start_date: date
    category: str | None = None

class GoalCreate(GoalBase):
    assignee_id: int
    parent_id: int | None = None
    subtasks: List["SubtaskCreate"] = []

    @property
    def due_date(self) -> date:
        """Auto-calculate due date based on tag"""
        tag_duration = {
            GoalTag.DAILY: 1,
            GoalTag.WEEKLY: 7,
            GoalTag.MONTHLY: 30,
            GoalTag.QUARTERLY: 90,
            GoalTag.YEARLY: 365
        }
        return self.start_date + timedelta(days=tag_duration[self.tag])
    
    @property
    def weightage(self) -> float:
        """Auto-calculate weightage from priority"""
        return PRIORITY_WEIGHTAGE[self.priority]

class GoalUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    level: GoalLevel | None = None
    tag: GoalTag | None = None
    priority: GoalPriority | None = None
    start_date: date | None = None
    assignee_id: int | None = None
    weightage: float | None = None
    category: str | None = None
    subtasks: Optional[List["SubtaskCreate"]] = None

class GoalSubmit(BaseModel):
    pass

class GoalApproval(BaseModel):
    approved: bool
    rejection_comment: str | None = None

class ProgressUpdate(BaseModel):
    completion_percentage: float
    notes: str | None = None

class SubtaskCreate(BaseModel):
    title: str
    description: str | None = None

class SubtaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    is_completed: bool | None = None

class Subtask(BaseModel):
    id: int
    goal_id: int
    title: str
    description: str | None
    is_completed: bool
    
    class Config:
        from_attributes = True

class GoalStats(BaseModel):
    days_remaining: int
    days_elapsed: int
    total_days: int
    time_elapsed_percentage: float
    is_overdue: bool
    is_at_risk: bool

class Goal(BaseModel):
    id: int
    title: str
    description: str
    level: GoalLevel
    tag: GoalTag
    priority: GoalPriority
    weightage: float
    status: GoalStatus
    start_date: date
    due_date: date
    category: str | None
    completion_percentage: float
    creator_id: int
    assignee_id: int
    team_id: int | None
    parent_id: int | None = None
    creator: Optional[UserInfo] = None
    assignee: Optional[UserWithTeam] = None
    subtasks: List[Subtask] = []
    feedbacks: List[Any] = []
    score: Optional[Any] = None
    stats: GoalStats | None = None
    is_at_risk: bool = False
    
    class Config:
        from_attributes = True
