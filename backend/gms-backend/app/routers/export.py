"""
Export router — GET /api/v1/reviews/forms/{form_id}/export
"""

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services import export_service

router = APIRouter()


@router.get("/forms/{form_id}/export")
def export_review(
    form_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Export a completed review as a self-contained HTML file.
    Auth required — 401 handled by get_current_user dependency.
    """
    try:
        html, filename = export_service.render(db, form_id, current_user.id)
        return Response(
            content=html,
            media_type="text/html; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
