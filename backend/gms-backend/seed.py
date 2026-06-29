"""
Run: python seed.py
Creates initial admin, manager, and member users.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal, engine, Base
from app.models import user, team, goal, subtask, progress, feedback, score
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

    # ── Legacy @opstree.com users (deprecated — kept for reference) ──────────
    # admin = User(email="sandeep@opstree.com", name="Harshit Verma",
    #              password_hash=hash_password("test"), role=UserRole.ADMIN, team_id=team_eng.id)
    # manager = User(email="deepak@opstree.com", name="Deepak Manager",
    #                password_hash=hash_password("test"), role=UserRole.MANAGER, team_id=team_eng.id)
    # member1 = User(email="harshit@opstree.com", name="Harshit Dev",
    #                password_hash=hash_password("test"), role=UserRole.MEMBER, team_id=team_eng.id)
    # member2 = User(email="gourav@opstree.com", name="Bob Dev",
    #                password_hash=hash_password("test"), role=UserRole.MEMBER, team_id=team_product.id)
    # db.add_all([admin, manager, member1, member2]); db.flush()
    # manager.manager_id = admin.id; member1.manager_id = manager.id
    # member2.manager_id = admin.id; team_eng.manager_id = manager.id

    # ── Demo users (name@pms.io / test) ─────────────────────────────────────
    sandeep = User(email="sandeep@pms.io", name="Sandeep",
                   password_hash=hash_password("test"), role=UserRole.ADMIN, department="Leadership")
    aman = User(email="aman@pms.io", name="Aman",
                password_hash=hash_password("test"), role=UserRole.MANAGER, team_id=team_eng.id, department="Engineering")
    prashant = User(email="prashant@pms.io", name="Prashant",
                    password_hash=hash_password("test"), role=UserRole.MANAGER, team_id=team_product.id, department="Product")
    harshit = User(email="harshit@pms.io", name="Harshit",
                   password_hash=hash_password("test"), role=UserRole.MEMBER, team_id=team_eng.id, department="Engineering")
    gourav = User(email="gourav@pms.io", name="Gourav",
                  password_hash=hash_password("test"), role=UserRole.MEMBER, team_id=team_eng.id, department="Engineering")
    awinash = User(email="awinash@pms.io", name="Awinash",
                   password_hash=hash_password("test"), role=UserRole.MEMBER, team_id=team_product.id, department="Product")

    db.add_all([sandeep, aman, prashant, harshit, gourav, awinash])
    db.flush()

    # Hierarchy: managers report to admin; members to their manager.
    # Aman manages Harshit + Gourav; Prashant manages Awinash.
    aman.manager_id = sandeep.id
    prashant.manager_id = sandeep.id
    harshit.manager_id = aman.id
    gourav.manager_id = aman.id
    awinash.manager_id = prashant.id
    team_eng.manager_id = aman.id
    team_product.manager_id = prashant.id

    db.commit()
    print("✅ Seed complete!")
    print("  sandeep@pms.io   / test  (admin)")
    print("  aman@pms.io      / test  (manager)")
    print("  prashant@pms.io  / test  (manager)")
    print("  harshit@pms.io   / test  (member)")
    print("  awinash@pms.io   / test  (member)")
    print("  gourav@pms.io    / test  (member)")

finally:
    db.close()
