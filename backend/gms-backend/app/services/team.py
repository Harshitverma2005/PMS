from sqlalchemy.orm import Session
from typing import List, Optional
from fastapi import HTTPException
from app.repositories.team import team_repository
from app.schemas.team import TeamCreate, TeamUpdate, Team
from app.models.team import Team as TeamModel
from app.models.user import User
from app.enums import UserRole

class TeamService:
    def _validate_manager(self, db: Session, manager_id: Optional[int], exclude_team_id: Optional[int] = None):
        """Enforce: the lead must be a manager-role user, and a manager may lead
        only one team (one manager per team, one team per manager)."""
        if manager_id is None:
            return
        mgr = db.query(User).filter(User.id == manager_id).first()
        if not mgr:
            raise HTTPException(status_code=400, detail="Assigned lead does not exist")
        role = mgr.role.value if hasattr(mgr.role, "value") else str(mgr.role)
        if role.lower() not in ("manager", "admin"):
            raise HTTPException(status_code=400, detail="Only a user with the manager role can lead a team")
        q = db.query(TeamModel).filter(TeamModel.manager_id == manager_id)
        if exclude_team_id is not None:
            q = q.filter(TeamModel.id != exclude_team_id)
        other = q.first()
        if other:
            raise HTTPException(status_code=400, detail=f"{mgr.name} already leads team '{other.name}'. A manager can lead only one team.")

    def _sync_manager_team(self, db: Session, team):
        """Keep the lead's own team_id pointing at the team they lead."""
        if team and team.manager_id:
            mgr = db.query(User).filter(User.id == team.manager_id).first()
            if mgr and mgr.team_id != team.id:
                mgr.team_id = team.id
                db.commit()

    def create_team(self, db: Session, team_data: TeamCreate) -> Team:
        self._validate_manager(db, team_data.manager_id)
        team = team_repository.create(db, **team_data.model_dump())
        self._sync_manager_team(db, team)
        return team

    def get_team(self, db: Session, team_id: int) -> Optional[Team]:
        return team_repository.get_by_id(db, team_id)

    def get_teams(self, db: Session, skip: int = 0, limit: int = 100) -> List[Team]:
        return team_repository.get_all(db, skip, limit)

    def update_team(self, db: Session, team_id: int, team_data: TeamUpdate) -> Optional[Team]:
        db_team = team_repository.get_by_id(db, team_id)
        if not db_team:
            return None
        data = team_data.model_dump(exclude_unset=True)
        if "manager_id" in data:
            self._validate_manager(db, data["manager_id"], exclude_team_id=team_id)
        updated = team_repository.update(db, db_team, **data)
        self._sync_manager_team(db, updated)
        return updated

    def delete_team(self, db: Session, team_id: int) -> bool:
        # Check if team has active users
        from app.models.user import User
        active_users = db.query(User).filter(
            User.team_id == team_id,
            User.is_active == True
        ).count()
        
        if active_users > 0:
            from fastapi import HTTPException
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete team with {active_users} active user(s). Please reassign or deactivate users first."
            )
        
        return team_repository.delete(db, team_id)

team_service = TeamService()
