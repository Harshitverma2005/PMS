from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.dependencies import get_current_user
from app.permissions import require_admin, require_manager_or_admin
from app.models.user import User
from app.services.review_service import review_service
from app.schemas.review import (
    ReviewCycleCreate, ReviewCycleResponse,
    ReviewFormSubmit, ReviewFormResponse,
    ReviewHistoryResponse, CycleComplianceResponse
)

router = APIRouter()


# ── Cycles ────────────────────────────────────────────────────────────────

@router.post("/review-cycles/", response_model=ReviewCycleResponse, status_code=status.HTTP_201_CREATED)
def create_cycle(
    data: ReviewCycleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_admin(current_user)
    try:
        cycle = review_service.create_cycle(db, data, current_user.id)
        return _enrich_cycle(cycle)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/review-cycles/", response_model=List[ReviewCycleResponse])
def list_cycles(
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cycles = review_service.list_cycles(db, skip, limit)
    return [_enrich_cycle(c) for c in cycles]


@router.get("/review-cycles/{cycle_id}", response_model=ReviewCycleResponse)
def get_cycle(
    cycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cycle = review_service.get_cycle(db, cycle_id)
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")
    return _enrich_cycle(cycle)


@router.post("/review-cycles/{cycle_id}/trigger", response_model=ReviewCycleResponse)
def trigger_cycle(
    cycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_admin(current_user)
    try:
        cycle = review_service.trigger_cycle(db, cycle_id, current_user.id)
        return _enrich_cycle(cycle)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/review-cycles/{cycle_id}/close", response_model=ReviewCycleResponse)
def close_cycle(
    cycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_admin(current_user)
    try:
        cycle = review_service.close_cycle(db, cycle_id, current_user.id)
        return _enrich_cycle(cycle)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/review-cycles/{cycle_id}/compliance", response_model=CycleComplianceResponse)
def get_compliance(
    cycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_manager_or_admin(current_user)
    cycle = review_service.get_cycle(db, cycle_id)
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")
    return review_service.get_compliance(db, cycle_id)


# ── Forms ─────────────────────────────────────────────────────────────────

@router.get("/review-forms/", response_model=List[ReviewFormResponse])
def get_my_forms(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    forms = review_service.get_my_forms(db, current_user.id)
    return [_scrub_form(f, current_user.id) for f in forms]



@router.get("/review-forms/{form_id}", response_model=ReviewFormResponse)
def get_form(
    form_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    form = review_service.get_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return _scrub_form(form, current_user.id)



@router.post("/review-forms/{form_id}/submit", response_model=ReviewFormResponse)
def submit_form(
    form_id: int,
    data: ReviewFormSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        return review_service.submit_form(db, form_id, current_user.id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── History ───────────────────────────────────────────────────────────────

@router.get("/review-history/", response_model=List[ReviewHistoryResponse])
def get_my_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return review_service.get_history(db, current_user.id)


@router.get("/review-history/{employee_id}", response_model=List[ReviewHistoryResponse])
def get_employee_history(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_manager_or_admin(current_user)
    return review_service.get_history(db, employee_id)


# ── Helper ────────────────────────────────────────────────────────────────

def _enrich_cycle(cycle) -> dict:
    d = ReviewCycleResponse.model_validate(cycle).model_dump()
    d["total_forms"] = len(cycle.forms)
    from app.enums import ReviewFormStatus
    d["submitted_forms"] = sum(1 for f in cycle.forms if f.status == ReviewFormStatus.SUBMITTED)
    return d


def _scrub_form(form, current_user_id: int):
    """Hide manager feedback from employee until manager submits."""
    from app.enums import ReviewFormType, ReviewFormStatus
    d = ReviewFormResponse.model_validate(form).model_dump()
    
    # If this is a manager form, and it's NOT submitted yet, and the requester is the employee
    if (form.form_type == ReviewFormType.MANAGER_FEEDBACK and 
        form.status != ReviewFormStatus.SUBMITTED and 
        form.employee_id == current_user_id):
        
        # Redact sensitive manager fields
        d["form_data"] = None
        d["final_rating"] = None
        d["ai_draft"] = None
        d["citations"] = None
        
    return d

