import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.achievement import Achievement
from app.models.timeline import TimelineEvent
from app.enums import TimelineEventType, AchievementCategory
from app.dependencies import get_current_user
from app.models.user import User

client = TestClient(app)

def override_get_current_user():
    return User(id=4, email="member@example.com", role="member", manager_id=3)

app.dependency_overrides[get_current_user] = override_get_current_user

def test_achievement_employee_id_override(test_db):
    """Property 24: Achievement employee_id is always the token user."""
    resp = client.post("/api/v1/achievements", json={
        "title": "A1",
        "description": "D1",
        "category": "technical_impact",
        "employee_id": 999  # Attempt to override
    })
    assert resp.status_code == 201
    
    ach = test_db.query(Achievement).first()
    assert ach.employee_id == 4

def test_achievement_append_only(test_db):
    """Property 25: Achievement append-only semantics."""
    test_db.add(Achievement(id=1, employee_id=4, title="A", description="B", category=AchievementCategory.DELIVERY))
    test_db.commit()
    
    assert client.put("/api/v1/achievements/1").status_code == 405
    assert client.patch("/api/v1/achievements/1").status_code == 405
    assert client.delete("/api/v1/achievements/1").status_code == 405

def test_achievement_ordering(test_db):
    """Property 26: Achievement ordering."""
    import time
    client.post("/api/v1/achievements", json={"title": "A1", "description": "D1", "category": "technical_impact"})
    client.post("/api/v1/achievements", json={"title": "A2", "description": "D2", "category": "technical_impact"})
    
    resp = client.get("/api/v1/achievements")
    data = resp.json()
    assert len(data) == 2
    assert data[0]["title"] == "A2"
    assert data[1]["title"] == "A1"

def test_achievement_timeline_emission(test_db):
    """Property 27: Achievement emits timeline event."""
    client.post("/api/v1/achievements", json={"title": "A1", "description": "D1", "category": "technical_impact"})
    events = test_db.query(TimelineEvent).filter_by(employee_id=4, event_type=TimelineEventType.ACHIEVEMENT_LOGGED).all()
    assert len(events) == 1
    assert events[0].title == "A1"
    assert events[0].summary == "technical_impact"
