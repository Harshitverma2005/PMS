from typing import List, Dict, Optional
from pydantic import BaseModel, field_validator


class Citation(BaseModel):
    event_type: str
    event_date: str  # ISO 8601 string
    event_title: str
    source_id: int


class AIDraftResponse(BaseModel):
    summary: str
    strengths: List[str]
    growth_areas: List[str]
    suggested_rating: int
    citations: Dict[str, List[Citation]]

    @field_validator("summary")
    @classmethod
    def summary_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("summary must not be empty")
        return v

    @field_validator("strengths")
    @classmethod
    def min_two_strengths(cls, v: List[str]) -> List[str]:
        if len(v) < 2:
            raise ValueError("strengths must have at least 2 items")
        return v

    @field_validator("growth_areas")
    @classmethod
    def min_one_growth_area(cls, v: List[str]) -> List[str]:
        if len(v) < 1:
            raise ValueError("growth_areas must have at least 1 item")
        return v

    @field_validator("suggested_rating")
    @classmethod
    def valid_rating(cls, v: int) -> int:
        if v < 1 or v > 5:
            raise ValueError("suggested_rating must be between 1 and 5")
        return v
