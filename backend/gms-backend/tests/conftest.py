"""
Test fixtures and configuration for UPMS Pro Features test suite.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta

from app.database import Base
from app.models.user import User
from app.models.team import Team
from app.models.goal import Goal
from app.models.timeline import TimelineEvent
from app.models.achievement import Achievement
from app.models.kudos import Kudos
from app.models.goal_history import GoalStatusHistory
from app.models.review import ReviewCycle, ReviewForm
from app.enums import UserRole, GoalStatus, TimelineEventType, AchievementCategory, ReviewCycleType
from app.database import get_db
from app.main import app


from sqlalchemy.pool import StaticPool

# Test database setup (in-memory SQLite)
@pytest.fixture(scope="function")
def test_db():
    """Create a fresh test database for each test."""
    engine = create_engine(
        "sqlite://", 
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False
    )
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    yield db
    
    db.close()
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(autouse=True)
def override_db_dependency(test_db):
    """Override FastAPI's get_db dependency to use the test_db fixture."""
    app.dependency_overrides[get_db] = lambda: test_db
    yield
    app.dependency_overrides.pop(get_db, None)

@pytest.fixture
def sample_users(test_db):
    """Create a hierarchy of test users."""
    # CEO
    ceo = User(
        id=1,
        email="ceo@example.com",
        name="CEO User",
        password_hash="hashed",
        role=UserRole.ADMIN,
        manager_id=None
    )
    test_db.add(ceo)
    
    # VP (reports to CEO)
    vp = User(
        id=2,
        email="vp@example.com",
        name="VP User",
        password_hash="hashed",
        role=UserRole.MANAGER,
        manager_id=1
    )
    test_db.add(vp)
    
    # Manager (reports to VP)
    manager = User(
        id=3,
        email="manager@example.com",
        name="Manager User",
        password_hash="hashed",
        role=UserRole.MANAGER,
        manager_id=2
    )
    test_db.add(manager)
    
    # Member (reports to Manager)
    member = User(
        id=4,
        email="member@example.com",
        name="Member User",
        password_hash="hashed",
        role=UserRole.MEMBER,
        manager_id=3
    )
    test_db.add(member)
    
    # Unrelated member (no chain to above)
    other_member = User(
        id=5,
        email="other@example.com",
        name="Other Member",
        password_hash="hashed",
        role=UserRole.MEMBER,
        manager_id=None
    )
    test_db.add(other_member)
    
    test_db.commit()
    
    return {
        "ceo": ceo,
        "vp": vp,
        "manager": manager,
        "member": member,
        "other_member": other_member
    }


@pytest.fixture
def sample_goal(test_db, sample_users):
    """Create a sample goal for testing."""
    goal = Goal(
        id=1,
        title="Test Goal",
        description="Test goal description",
        assignee_id=sample_users["member"].id,
        status=GoalStatus.ACTIVE,
        created_at=datetime.utcnow()
    )
    test_db.add(goal)
    test_db.commit()
    return goal


@pytest.fixture
def sample_review_cycle(test_db):
    """Create a sample review cycle."""
    cycle = ReviewCycle(
        id=1,
        cycle_name="Q4 2024",
        cycle_type=ReviewCycleType.QUARTERLY,
        start_date=datetime.utcnow().date() - timedelta(days=90),
        end_date=datetime.utcnow().date() + timedelta(days=90),
        self_review_deadline=datetime.utcnow().date() + timedelta(days=14),
        manager_review_deadline=datetime.utcnow().date() + timedelta(days=21),
        status="active",
        created_by_id=1
    )
    test_db.add(cycle)
    test_db.commit()
    return cycle

