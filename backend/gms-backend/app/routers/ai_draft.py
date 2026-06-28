"""
AI Draft router — POST /api/v1/reviews/forms/{form_id}/draft
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services import ai_draft_service
import asyncio

router = APIRouter()


@router.post("/forms/{form_id}/draft")
async def generate_draft(
    form_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate an AI review draft for the given form.
    Manager/admin only. Returns 403 for members before any AI processing.
    """
    try:
        result = await ai_draft_service.generate(db, form_id, current_user.id)
        return result
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail="Draft generation temporarily unavailable; please try again")
    except Exception as e:
        raise HTTPException(status_code=503, detail="Draft generation temporarily unavailable; please try again")
