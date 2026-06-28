from pydantic import BaseModel, model_validator
from datetime import date, datetime
from typing import Optional, List, Any
from app.enums import ReviewCycleType, ReviewCycleStatus, ReviewFormType, ReviewFormStatus


class ReviewCycleCreate(BaseModel):
    cycle_name: str
    cycle_type: ReviewCycleType
    start_date: date
    end_date: date
    self_review_deadline: date
    manager_review_deadline: date

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date")
        if self.self_review_deadline > self.end_date:
            raise ValueError("self_review_deadline must be on or before end_date")
        if self.manager_review_deadline < self.self_review_deadline:
            raise ValueError("manager_review_deadline must be on or after self_review_deadline")
        return self


class ReviewFormSubmit(BaseModel):
    form_data: dict
    final_rating: Optional[int] = None   # 1–5, required for MANAGER_FEEDBACK


class ReviewFormResponse(BaseModel):
    id: int
    review_cycle_id: int
    employee_id: int
    manager_id: Optional[int] = None
    manager_of_record_id: Optional[int] = None
    manager_of_record_name: Optional[str] = None
    form_type: ReviewFormType
    status: ReviewFormStatus
    form_data: Optional[Any] = None
    final_rating: Optional[int] = None
    submitted_at: Optional[datetime] = None
    ai_draft: Optional[Any] = None
    citations: Optional[Any] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewCycleResponse(BaseModel):
    id: int
    cycle_name: str
    cycle_type: ReviewCycleType
    start_date: date
    end_date: date
    self_review_deadline: date
    manager_review_deadline: date
    status: ReviewCycleStatus
    created_by_id: int
    created_at: datetime
    total_forms: int = 0
    submitted_forms: int = 0

    class Config:
        from_attributes = True


class ReviewHistoryResponse(BaseModel):
    id: int
    employee_id: int
    review_cycle_id: int
    performance_score: Optional[float] = None
    rating: Optional[str] = None
    feedback_summary: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CycleComplianceResponse(BaseModel):
    cycle_id: int
    total_employees: int
    self_submitted: int
    manager_submitted: int
    both_submitted: int
    pending: int
