from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.services.team import team_service
from app.schemas.team import Team, TeamCreate, TeamUpdate
from app.dependencies import get_current_user
from app.permissions import require_admin
from app.models.user import User

router = APIRouter()

@router.post("/", response_model=Team, status_code=status.HTTP_201_CREATED)
def create_team(
    team_in: TeamCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_admin(current_user)
    return team_service.create_team(db, team_in)

@router.get("/{team_id}", response_model=Team)
def get_team(
    team_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.enums import UserRole
    team = team_service.get_team(db, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Only admin or manager of the team can view team details
    if current_user.role != UserRole.ADMIN and current_user.team_id != team_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this team")
    
    return team

@router.get("/", response_model=List[Team])
def list_teams(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return team_service.get_teams(db, skip, limit)

@router.patch("/{team_id}", response_model=Team)
def update_team(
    team_id: int, 
    team_in: TeamUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_admin(current_user)
    team = team_service.get_team(db, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    updated_team = team_service.update_team(db, team_id, team_in)
    return updated_team

@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_team(
    team_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_admin(current_user)
    team = team_service.get_team(db, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    if not team_service.delete_team(db, team_id):
        raise HTTPException(status_code=404, detail="Team not found")
