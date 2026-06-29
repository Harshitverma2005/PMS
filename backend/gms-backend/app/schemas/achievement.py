from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator, AnyHttpUrl

from app.enums import AchievementCategory


class AchievementCreate(BaseModel):
    title: str
    description: str
    category: AchievementCategory
    evidence_url: Optional[str] = None
    goal_id: Optional[int] = None
    # Optional target — a manager/admin may log an achievement for a direct report.
    # Ignored for members (always logged for themselves).
    employee_id: Optional[int] = None

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("title must not be empty")
        if len(v) > 200:
            raise ValueError("title must be at most 200 characters")
        return v

    @field_validator("description")
    @classmethod
    def description_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("description must not be empty")
        if len(v) > 2000:
            raise ValueError("description must be at most 2000 characters")
        return v


class AchievementResponse(BaseModel):
    id: int
    employee_id: int
    title: str
    description: str
    category: AchievementCategory
    evidence_url: Optional[str] = None
    goal_id: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}
