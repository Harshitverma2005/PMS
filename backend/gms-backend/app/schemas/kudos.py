from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator


class KudosCreate(BaseModel):
    recipient_id: int
    message: str

    @field_validator("message")
    @classmethod
    def message_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("message must not be empty")
        if len(v) > 500:
            raise ValueError("message must be at most 500 characters")
        return v


class KudosResponse(BaseModel):
    id: int
    sender_id: int
    sender_name: str
    recipient_id: int
    recipient_name: str
    message: str
    created_at: datetime

    model_config = {"from_attributes": True}
