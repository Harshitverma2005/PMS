"""
Timeline router — GET /{employee_id} and GET /{employee_id}/export
"""

import csv
import io
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services import timeline_service
from app.services.hierarchy_service import can_read
from app.schemas.timeline import TimelineQueryParams, TimelineResponse

router = APIRouter()


def _get_employee_or_404(db: Session, employee_id: int) -> User:
    employee = db.query(User).filter(User.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee


def _check_access(db: Session, requesting_user: User, employee_id: int):
    if not can_read(db, requesting_user, employee_id):
        raise HTTPException(status_code=403, detail="You don't have permission to view this employee's timeline")


@router.get("/{employee_id}", response_model=TimelineResponse)
def get_timeline(
    employee_id: int,
    type: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get timeline events for an employee. Requires read access (self, direct manager, or skip-level)."""
    _get_employee_or_404(db, employee_id)
    _check_access(db, current_user, employee_id)

    # Validate type filter
    params = TimelineQueryParams(
        type=type,
        start_date=start_date,
        end_date=end_date,
        page=page,
        page_size=page_size,
    )

    return timeline_service.get_timeline(
        db=db,
        employee_id=employee_id,
        type_filter=params.type,
        start_date=params.start_date,
        end_date=params.end_date,
        page=params.page,
        page_size=params.page_size,
    )


@router.get("/{employee_id}/export")
def export_timeline(
    employee_id: int,
    type: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export all timeline events as a UTF-8 CSV file."""
    _get_employee_or_404(db, employee_id)
    _check_access(db, current_user, employee_id)

    # Validate type filter
    if type:
        from app.enums import TimelineEventType
        valid = [e.value for e in TimelineEventType]
        if type.lower() not in valid:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid type '{type}'. Valid values: {valid}"
            )

    events = timeline_service.get_all_events_for_export(
        db=db,
        employee_id=employee_id,
        type_filter=type.lower() if type else None,
        start_date=start_date,
        end_date=end_date,
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["timestamp", "type", "title", "summary"])
    for event in events:
        writer.writerow([
            event.timestamp.isoformat(),
            event.event_type.value if hasattr(event.event_type, 'value') else str(event.event_type),
            event.title,
            event.summary or "",
        ])

    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    filename = f"timeline_{employee_id}_{today_str}.csv"

    return Response(
        content=output.getvalue().encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
