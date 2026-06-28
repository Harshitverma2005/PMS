from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator

from app.enums import GoalStatus


class GoalStatusHistoryResponse(BaseModel):
    from_status: Optional[GoalStatus] = None
    to_status: GoalStatus
    actor_id: int
    actor_name: str
    timestamp: datetime
    comment: Optional[str] = None

    class Config:
        from_attributes = True


class GoalApproveRequest(BaseModel):
    approved: bool
    comment: str

    @field_validator("comment")
    @classmethod
    def comment_must_not_be_empty(cls, v: str) -> str:
        """Strip whitespace and validate comment is non-empty"""
        if not v.strip():
            raise ValueError("comment must not be empty or whitespace")
        return v


class GoalArchiveRequest(BaseModel):
    archive_reason: str

    @field_validator("archive_reason")
    @classmethod
    def archive_reason_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("archive_reason must not be empty or whitespace")
        return v
