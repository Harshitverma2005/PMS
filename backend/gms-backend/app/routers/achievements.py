"""
Achievements router — POST /api/v1/achievements, GET /api/v1/achievements
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.achievement import AchievementCreate, AchievementResponse
from app.services import achievement_service

router = APIRouter()


@router.post("/", response_model=AchievementResponse, status_code=status.HTTP_201_CREATED)
def create_achievement(
    data: AchievementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new achievement. employee_id is always set from the token."""
    try:
        achievement = achievement_service.create_achievement(db, data, current_user.id)
        return AchievementResponse.model_validate(achievement)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/", response_model=List[AchievementResponse])
def list_achievements(
    employee_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List achievements — member sees own; manager can specify employee_id for direct report."""
    try:
        achievements = achievement_service.list_achievements(db, current_user, employee_id)
        return [AchievementResponse.model_validate(a) for a in achievements]
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.put("/{achievement_id}", status_code=405)
@router.patch("/{achievement_id}", status_code=405)
@router.delete("/{achievement_id}", status_code=405)
def achievement_mutation_not_allowed(achievement_id: int):
    """Achievements are append-only — PUT/PATCH/DELETE return 405."""
    raise HTTPException(status_code=405, detail="Achievements are append-only and cannot be modified or deleted")
