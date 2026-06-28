import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.kudos import Kudos
from app.models.timeline import TimelineEvent
from app.enums import TimelineEventType
from app.dependencies import get_current_user
from app.models.user import User

client = TestClient(app)

def override_get_current_user():
    return User(id=4, email="member@example.com", role="member", manager_id=3)

app.dependency_overrides[get_current_user] = override_get_current_user

def test_kudos_self_give_guard(test_db):
    """Property 28: Kudos self-give guard."""
    resp = client.post("/api/v1/kudos", json={
        "recipient_id": 4,
        "message": "Good job me"
    })
    assert resp.status_code == 422
    assert test_db.query(Kudos).count() == 0

def test_kudos_feed_ordering(test_db):
    """Property 29: Kudos feed ordering."""
    # Ensure recipient exists
    test_db.add(User(id=5, email="m2@ex.com", name="U5", role="member", password_hash="h"))
    test_db.commit()
    
    client.post("/api/v1/kudos", json={"recipient_id": 5, "message": "K1"})
    client.post("/api/v1/kudos", json={"recipient_id": 5, "message": "K2"})
    
    resp = client.get("/api/v1/kudos/feed")
    data = resp.json()["items"]
    assert len(data) == 2
    assert data[0]["message"] == "K2"
    assert data[1]["message"] == "K1"

def test_kudos_timeline_event(test_db):
    """Property 30: Kudos emits timeline event on recipient."""
    test_db.add(User(id=5, email="m2@ex.com", name="U5", role="member", password_hash="h"))
    test_db.commit()
    
    client.post("/api/v1/kudos", json={"recipient_id": 5, "message": "Great!"})
    
    # Recipient
    events = test_db.query(TimelineEvent).filter_by(employee_id=5, event_type=TimelineEventType.KUDOS_RECEIVED).all()
    assert len(events) == 1
    assert events[0].summary == "Great!"
    
    # Sender
    sender_events = test_db.query(TimelineEvent).filter_by(employee_id=4, event_type=TimelineEventType.KUDOS_RECEIVED).all()
    assert len(sender_events) == 0
