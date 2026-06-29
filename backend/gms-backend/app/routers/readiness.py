"""
Readiness router — GET /api/v1/readiness/team and GET /api/v1/readiness/{employee_id}
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.readiness import ReadinessResponse, ReadinessSignal
from app.services import readiness_service
from app.services.notification_service import notification_service
from app.services.hierarchy_service import is_direct_manager, can_read
from app.enums import UserRole

router = APIRouter()


def _build_response(data: dict) -> ReadinessResponse:
    return ReadinessResponse(
        score=data["score"],
        signals=[ReadinessSignal(**s) for s in data["signals"]],
        cycle_active=data["cycle_active"],
        prompts=data["prompts"],
        employee_id=data.get("employee_id"),
        employee_name=data.get("employee_name"),
    )


@router.get("/team")
def get_team_readiness(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manager only — return readiness for all direct reports, sorted ascending by score."""
    role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    if role == "member":
        raise HTTPException(status_code=403, detail="Only managers can access team readiness")

    # Admins oversee everyone; managers see their direct reports.
    if role.lower() == "admin":
        team_data = readiness_service.get_all_employees_readiness(db)
    else:
        team_data = readiness_service.get_team_readiness(db, current_user.id)
    return [_build_response(d) for d in team_data]


@router.get("/{employee_id}")
def get_employee_readiness(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get readiness for a specific employee. Manager for direct report, or member for self."""
    # Check employee exists
    employee = db.query(User).filter(User.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Self-access always OK
    if current_user.id == employee_id:
        data = readiness_service.get_readiness(db, employee_id)
        data["employee_id"] = employee_id
        data["employee_name"] = employee.name
        return _build_response(data)

    # Admins may view anyone; a manager only their direct reports.
    role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    if role.lower() == "admin" or (role.lower() == "manager" and is_direct_manager(db, current_user.id, employee_id)):
        data = readiness_service.get_readiness(db, employee_id)
        data["employee_id"] = employee_id
        data["employee_name"] = employee.name
        return _build_response(data)

    raise HTTPException(status_code=403, detail="Access denied")


@router.post("/{employee_id}/nudge")
def send_readiness_nudge(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manager/admin nudges a direct report with their outstanding readiness items.
    Creates an in-app notification for the employee."""
    role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    if role not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Only managers can send nudges")

    employee = db.query(User).filter(User.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    if role == "manager" and not is_direct_manager(db, current_user.id, employee_id):
        raise HTTPException(status_code=403, detail="You can only nudge your direct reports")

    data = readiness_service.get_readiness(db, employee_id)
    notification_service.notify_readiness_nudge(db, employee, data["prompts"], current_user.name)
    return {"sent": True, "employee_id": employee_id, "items": data["prompts"], "score": data["score"]}
