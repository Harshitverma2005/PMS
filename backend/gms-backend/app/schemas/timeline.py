from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, field_validator, model_validator
from typing_extensions import Self

from app.enums import TimelineEventType


# ---------------------------------------------------------------------------
# Query / request helpers (used by the router, not stored in DB)
# ---------------------------------------------------------------------------

class TimelineQueryParams(BaseModel):
    """Validated query parameters for the timeline list endpoint."""

    type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    page: int = 1
    page_size: int = 50

    @field_validator("type", mode="before")
    @classmethod
    def validate_event_type(cls, v: Optional[str]) -> Optional[str]:
        """Accept any case; reject unknown values with a 422 listing valid choices."""
        if v is None:
            return v
        normalised = v.lower()
        valid_values = [e.value for e in TimelineEventType]
        if normalised not in valid_values:
            raise ValueError(
                f"Invalid type '{v}'. Valid values are: {valid_values}"
            )
        return normalised

    @field_validator("page", mode="before")
    @classmethod
    def validate_page(cls, v: int) -> int:
        if v < 1:
            raise ValueError("page must be >= 1")
        return v

    @field_validator("page_size", mode="before")
    @classmethod
    def validate_page_size(cls, v: int) -> int:
        if v < 1 or v > 200:
            raise ValueError("page_size must be between 1 and 200 (inclusive)")
        return v


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class TimelineEventResponse(BaseModel):
    """A single timeline event returned from the API."""

    id: int
    event_type: TimelineEventType
    timestamp: datetime
    title: str
    summary: Optional[str] = None
    source_id: Optional[int] = None

    model_config = {"from_attributes": True}


class TimelineResponse(BaseModel):
    """Paginated list of timeline events."""

    total_count: int
    page: int
    page_size: int
    events: List[TimelineEventResponse]
