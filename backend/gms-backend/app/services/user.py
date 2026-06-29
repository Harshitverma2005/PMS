from sqlalchemy.orm import Session
from typing import List, Optional
from app.repositories.user import user_repository
from app.schemas.user import UserCreate, UserUpdate, User
from app.auth import hash_password
from app.models.team import Team
from app.models.user import User as UserModel
from app.enums import UserRole


def _is_member(role) -> bool:
    role_str = role.value if hasattr(role, "value") else str(role)
    return role_str.lower() in ("member", "employee")


def _team_for_manager(db: Session, manager_id):
    """An employee inherits their manager's team — enforces one team per employee."""
    if not manager_id:
        return None
    mgr = db.query(UserModel).filter(UserModel.id == manager_id).first()
    return mgr.team_id if mgr else None


class UserService:
    def create_user(self, db: Session, user_data: UserCreate) -> User:
        password_hash = hash_password(user_data.password)
        user_dict = user_data.model_dump(exclude={"password"})

        # Members inherit their manager's team so an employee is only ever in one team.
        if _is_member(user_dict.get("role")) and user_dict.get("manager_id"):
            mgr_team = _team_for_manager(db, user_dict["manager_id"])
            if mgr_team is not None:
                user_dict["team_id"] = mgr_team

        user = user_repository.create(db, password_hash=password_hash, **user_dict)
        
        # Auto-assign as team manager if role is manager/admin and team has no manager
        if user.team_id and user.role in [UserRole.MANAGER, UserRole.ADMIN]:
            team = db.query(Team).filter(Team.id == user.team_id).first()
            if team and not team.manager_id:
                team.manager_id = user.id
                db.commit()
        
        return user
    
    def get_user(self, db: Session, user_id: int) -> Optional[User]:
        return user_repository.get_by_id(db, user_id)
    
    def get_users(self, db: Session, skip: int = 0, limit: int = 100, team_id: int = None) -> List[User]:
        return user_repository.get_all(db, skip, limit, team_id=team_id)
    
    def update_user(self, db: Session, user_id: int, user_data: UserUpdate) -> Optional[User]:
        db_user = user_repository.get_by_id(db, user_id)
        if not db_user:
            return None
        data = user_data.model_dump(exclude_unset=True)

        # When an employee is (re)assigned to a manager, move them onto that
        # manager's team so they never belong to two teams.
        eff_role = data.get("role", db_user.role)
        if _is_member(eff_role) and data.get("manager_id"):
            mgr_team = _team_for_manager(db, data["manager_id"])
            if mgr_team is not None:
                data["team_id"] = mgr_team

        return user_repository.update(db, db_user, **data)
    
    def delete_user(self, db: Session, user_id: int) -> bool:
        return user_repository.delete(db, user_id)

user_service = UserService()
