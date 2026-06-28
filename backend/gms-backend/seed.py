"""
Run: python seed.py
Creates initial admin, manager, and member users.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal, engine, Base
from app.models import user, team, goal, subtask, progress, feedback, score, kudos, achievement, review, timeline
from app.models.user import User
from app.models.team import Team
from app.enums import UserRole
from app.auth import hash_password

Base.metadata.create_all(bind=engine)
db = SessionLocal()

try:
    # Skip if already seeded
    if db.query(User).first():
        print("Database already seeded.")
        sys.exit(0)

    # Teams
    team_eng = Team(name="Engineering")
    team_product = Team(name="Product")
    db.add_all([team_eng, team_product])
    db.flush()

    # Users
    admin = User(
        email="sandeep@opstree.com",
        name="Harshit Verma",
        password_hash=hash_password("test"),
        role=UserRole.ADMIN,
        team_id=team_eng.id
    )
    manager = User(
        email="deepak@opstree.com",
        name="Deepak Manager",
        password_hash=hash_password("test"),
        role=UserRole.MANAGER,
        team_id=team_eng.id
    )
    member1 = User(
        email="harshit@opstree.com",
        name="Harshit Dev",
        password_hash=hash_password("test"),
        role=UserRole.MEMBER,
        team_id=team_eng.id
    )
    member2 = User(
        email="gourav@opstree.com",
        name="Bob Dev",
        password_hash=hash_password("test"),
        role=UserRole.MEMBER,
        team_id=team_product.id
    )

    db.add_all([admin, manager, member1, member2])
    db.flush()

    # Set manager relationships
    manager.manager_id = admin.id
    member1.manager_id = manager.id
    member2.manager_id = admin.id
    team_eng.manager_id = manager.id

    db.commit()
    print("✅ Seed complete!")
    print("  sandeep@opstree.com  / test  (admin)")
    print("  deepak@opstree.com   / test  (manager)")
    print("  harshit@opstree.com  / test  (member)")
    print("  gourav@opstree.com   / test  (member)")

finally:
    db.close()
