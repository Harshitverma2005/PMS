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
        _nudge_employees_on_cycle_start(db, cycle_id, current_user)
        return _enrich_cycle(cycle)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


def _nudge_employees_on_cycle_start(db: Session, cycle_id: int, actor: User):
    """When a cycle is activated, send each employee a readiness nudge listing
    what they still need to do to be review-ready (in-app notification)."""
    from app.services import readiness_service
    from app.services.notification_service import notification_service
    from app.models.review import ReviewForm
    from app.enums import ReviewFormType

    forms = db.query(ReviewForm).filter(
        ReviewForm.review_cycle_id == cycle_id,
        ReviewForm.form_type == ReviewFormType.SELF_ASSESSMENT,
    ).all()
    for f in forms:
        emp = db.query(User).filter(User.id == f.employee_id).first()
        if not emp:
            continue
        try:
            data = readiness_service.get_readiness(db, emp.id)
            notification_service.notify_readiness_nudge(db, emp, data["prompts"], actor.name)
        except Exception:
            # A nudge failure must never block cycle activation.
            continue


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


@router.get("/review-cycles/{cycle_id}/results")
def get_cycle_results(
    cycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Admin-only: per-employee review outcomes (self + manager ratings/feedback)."""
    require_admin(current_user)
    cycle = review_service.get_cycle(db, cycle_id)
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")
    return review_service.get_cycle_results(db, cycle_id)


@router.get("/review-cycles/{cycle_id}/upward-feedback")
def get_upward_feedback(
    cycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Admin-only: employees' upward feedback about their managers for this cycle."""
    require_admin(current_user)
    cycle = review_service.get_cycle(db, cycle_id)
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")
    return review_service.get_upward_feedback(db, cycle_id)


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

    from app.services.hierarchy_service import is_direct_manager
    from app.enums import ReviewFormType
    role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)

    if form.form_type == ReviewFormType.UPWARD_FEEDBACK:
        # Upward feedback is admin-only; the rater may see their own. The rated
        # manager must NOT be able to read it (no manager_id / direct-manager path).
        allowed = role.lower() == 'admin' or form.employee_id == current_user.id
    else:
        # Only the employee, their (managing) manager, or an admin may view a form.
        allowed = (
            role.lower() == 'admin'
            or form.employee_id == current_user.id
            or getattr(form, 'manager_id', None) == current_user.id
            or getattr(form, 'manager_of_record_id', None) == current_user.id
            or is_direct_manager(db, current_user.id, form.employee_id)
        )
    if not allowed:
        raise HTTPException(status_code=403, detail="Not authorized to view this review form")
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

