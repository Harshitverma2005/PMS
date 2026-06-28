"""
Test fixtures and configuration for UPMS Pro Features test suite.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta
from unittest.mock import MagicMock

from app.database import Base
from app.models.user import User
from app.models.team import Team
from app.models.goal import Goal
from app.models.timeline import TimelineEvent
from app.models.achievement import Achievement
from app.models.kudos import Kudos
from app.models.goal_history import GoalStatusHistory
from app.models.review import ReviewCycle, ReviewForm
from app.enums import (
    UserRole, GoalStatus, GoalLevel, GoalTag, GoalPriority,
    TimelineEventType, AchievementCategory, ReviewCycleType,
    ReviewCycleStatus, ReviewFormType, ReviewFormStatus,
)
from app.database import get_db
from app.dependencies import get_current_user
from app.main import app


from sqlalchemy.pool import StaticPool

# ── Test database setup ───────────────────────────────────────────────────

@pytest.fixture(scope="function")
def test_db():
    """Create a fresh in-memory SQLite DB for each test."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    yield db

    db.close()
    try:
        Base.metadata.drop_all(bind=engine)
    except Exception:
        pass  # ignore FK-cycle warnings on teardown


@pytest.fixture(autouse=True)
def override_db_dependency(test_db):
    """Override FastAPI's get_db dependency to use the per-test in-memory DB."""
    app.dependency_overrides[get_db] = lambda: test_db
    yield
    app.dependency_overrides.pop(get_db, None)


# ── Auth helpers ──────────────────────────────────────────────────────────

def make_member_user():
    return User(id=4, email="member@example.com", name="Member User", role=UserRole.MEMBER, manager_id=3, password_hash="hashed")

def make_manager_user():
    return User(id=3, email="manager@example.com", name="Manager User", role=UserRole.MANAGER, manager_id=2, password_hash="hashed")

def make_admin_user():
    return User(id=1, email="ceo@example.com", name="CEO User", role=UserRole.ADMIN, manager_id=None, password_hash="hashed")


@pytest.fixture
def client_as_member():
    """TestClient with get_current_user overridden to a member user."""
    app.dependency_overrides[get_current_user] = make_member_user
    c = TestClient(app, raise_server_exceptions=True)
    yield c
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def client_as_manager():
    """TestClient with get_current_user overridden to a manager user."""
    app.dependency_overrides[get_current_user] = make_manager_user
    c = TestClient(app, raise_server_exceptions=True)
    yield c
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def client_as_admin():
    """TestClient with get_current_user overridden to an admin user."""
    app.dependency_overrides[get_current_user] = make_admin_user
    c = TestClient(app, raise_server_exceptions=True)
    yield c
    app.dependency_overrides.pop(get_current_user, None)


# ── Reusable data fixtures ────────────────────────────────────────────────

@pytest.fixture
def sample_users(test_db):
    """Create a management hierarchy: admin → vp → manager → member, plus an unrelated other_member."""
    ceo = User(id=1, email="ceo@example.com", name="CEO User", password_hash="hashed", role=UserRole.ADMIN, manager_id=None)
    vp  = User(id=2, email="vp@example.com",  name="VP User",  password_hash="hashed", role=UserRole.MANAGER, manager_id=1)
    mgr = User(id=3, email="manager@example.com", name="Manager User", password_hash="hashed", role=UserRole.MANAGER, manager_id=2)
    mem = User(id=4, email="member@example.com",  name="Member User",  password_hash="hashed", role=UserRole.MEMBER, manager_id=3)
    other = User(id=5, email="other@example.com", name="Other Member", password_hash="hashed", role=UserRole.MEMBER, manager_id=None)

    test_db.add_all([ceo, vp, mgr, mem, other])
    test_db.commit()

    return {"ceo": ceo, "vp": vp, "manager": mgr, "member": mem, "other_member": other}


def _make_goal(id, title, assignee_id, status=GoalStatus.ACTIVE):
    """Helper — create a Goal with all NOT NULL fields populated."""
    from datetime import date
    return Goal(
        id=id,
        title=title,
        description="Test description",
        level=GoalLevel.INDIVIDUAL,
        status=status,
        tag=GoalTag.QUARTERLY,
        priority=GoalPriority.MEDIUM,
        weightage=20.0,
        start_date=date.today(),
        due_date=date.today() + timedelta(days=30),
        creator_id=assignee_id,
        assignee_id=assignee_id,
    )


@pytest.fixture
def sample_goal(test_db, sample_users):
    """Create a sample goal attached to the member user."""
    goal = _make_goal(id=1, title="Test Goal", assignee_id=sample_users["member"].id)
    test_db.add(goal)
    test_db.commit()
    return goal


@pytest.fixture
def sample_review_cycle(test_db):
    """Create an active review cycle."""
    cycle = ReviewCycle(
        id=1,
        cycle_name="Q4 2024",
        cycle_type=ReviewCycleType.QUARTERLY,
        start_date=datetime.utcnow().date() - timedelta(days=90),
        end_date=datetime.utcnow().date() + timedelta(days=90),
        self_review_deadline=datetime.utcnow().date() + timedelta(days=14),
        manager_review_deadline=datetime.utcnow().date() + timedelta(days=21),
        status=ReviewCycleStatus.ACTIVE,
        created_by_id=1,
    )
    test_db.add(cycle)
    test_db.commit()
    return cycle
