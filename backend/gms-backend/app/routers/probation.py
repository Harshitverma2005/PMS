from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.dependencies import get_current_user
from app.permissions import require_admin, require_manager_or_admin
from app.models.user import User
from app.services.probation_service import probation_service
from app.schemas.probation import (
    ProbationRecordCreate, ProbationRecordResponse,
    ProbationFeedbackCreate, ProbationFeedbackResponse,
    ProbationTriggerResponse, ProbationPauseRequest, ProbationResumeRequest,
    ProbationRecommendRequest
)

router = APIRouter()


@router.post("/", response_model=ProbationRecordResponse, status_code=status.HTTP_201_CREATED)
def create_probation_record(
    data: ProbationRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_admin(current_user)
    try:
        return probation_service.create_record(db, data, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/scan")
def scan_triggers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Run the milestone check on demand (same logic the 6-hour scheduler runs):
    fires 30/60/80-day triggers that are due, escalates overdue ones, sends nudges."""
    require_admin(current_user)
    probation_service.check_and_fire_triggers(db)
    return {"status": "ok"}


@router.get("/", response_model=List[ProbationRecordResponse])
def list_probation_records(
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_manager_or_admin(current_user)
    records = probation_service.list_records(db, skip, limit)
    for r in records:
        r.working_days_elapsed = probation_service.get_working_days_elapsed(r)
        r.calculated_status = probation_service.get_calculated_status(r)
        r.probation_end_date = probation_service.get_probation_end_date(r)
    return records


@router.get("/employee/{employee_id}", response_model=ProbationRecordResponse)
def get_probation_by_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Employee can view own; manager/admin can view any
    if current_user.id != employee_id:
        require_manager_or_admin(current_user)
    record = probation_service.get_by_employee(db, employee_id)
    if not record:
        raise HTTPException(status_code=404, detail="Probation record not found")
    record.working_days_elapsed = probation_service.get_working_days_elapsed(record)
    record.calculated_status = probation_service.get_calculated_status(record)
    record.probation_end_date = probation_service.get_probation_end_date(record)
    return record


@router.get("/{record_id}", response_model=ProbationRecordResponse)
def get_probation_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    record = probation_service.get_record(db, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Probation record not found")
    # Employee can only view own
    if current_user.id != record.employee_id:
        require_manager_or_admin(current_user)
    record.working_days_elapsed = probation_service.get_working_days_elapsed(record)
    record.calculated_status = probation_service.get_calculated_status(record)
    record.probation_end_date = probation_service.get_probation_end_date(record)
    return record


@router.post("/{record_id}/pause", response_model=ProbationRecordResponse)
def pause_probation(
    record_id: int,
    body: ProbationPauseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_admin(current_user)
    try:
        return probation_service.pause(db, record_id, body.pause_date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{record_id}/resume", response_model=ProbationRecordResponse)
def resume_probation(
    record_id: int,
    body: ProbationResumeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_admin(current_user)
    try:
        return probation_service.resume(db, record_id, body.resume_date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{record_id}/complete", response_model=ProbationRecordResponse)
def complete_probation(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_admin(current_user)
    try:
        return probation_service.complete(db, record_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{record_id}/reject", response_model=ProbationRecordResponse)
def reject_probation(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_admin(current_user)
    try:
        return probation_service.reject(db, record_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{record_id}/recommend", response_model=ProbationRecordResponse)
def recommend_probation(
    record_id: int,
    body: ProbationRecommendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_manager_or_admin(current_user)
    # A manager may only recommend for their own direct reports.
    from app.services.hierarchy_service import is_direct_manager
    role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    existing = probation_service.get_record(db, record_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Probation record not found")
    if role.lower() != 'admin' and not is_direct_manager(db, current_user.id, existing.employee_id):
        raise HTTPException(status_code=403, detail="You can only recommend for your direct reports")
    try:
        record = probation_service.recommend(db, record_id, body, current_user.id)
        record.calculated_status = probation_service.get_calculated_status(record)
        record.probation_end_date = probation_service.get_probation_end_date(record)
        record.working_days_elapsed = probation_service.get_working_days_elapsed(record)
        return record
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/triggers/{trigger_id}", response_model=ProbationTriggerResponse)
def get_trigger(
    trigger_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.probation import ProbationTrigger
    trigger = db.query(ProbationTrigger).filter(ProbationTrigger.id == trigger_id).first()
    if not trigger:
        raise HTTPException(status_code=404, detail="Trigger not found")
    return trigger


@router.post("/triggers/{trigger_id}/feedback", response_model=ProbationFeedbackResponse, status_code=status.HTTP_201_CREATED)
def submit_feedback(
    trigger_id: int,
    data: ProbationFeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        return probation_service.submit_feedback(db, trigger_id, current_user.id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/triggers/{trigger_id}/feedback", response_model=List[ProbationFeedbackResponse])
def get_trigger_feedbacks(
    trigger_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        return probation_service.get_trigger_feedbacks(db, trigger_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
