from app.repositories.base import BaseRepository
from app.models.team import Team

class TeamRepository(BaseRepository[Team]):
    def __init__(self):
        super().__init__(Team)

    def update(self, db, db_obj, **kwargs):
        # Unlike the base repo, honor explicit None so a team's lead can be cleared
        # ("No Lead assigned"). Callers upstream use exclude_unset, so only fields
        # the admin actually provided ever reach here.
        for key, value in kwargs.items():
            setattr(db_obj, key, value)
        db.commit()
        db.refresh(db_obj)
        return db_obj

team_repository = TeamRepository()
