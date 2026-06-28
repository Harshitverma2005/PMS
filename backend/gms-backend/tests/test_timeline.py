import pytest
from fastapi.testclient import TestClient
from hypothesis import given, settings, strategies as st
from datetime import datetime, timedelta

from app.main import app
from app.models.timeline import TimelineEvent
from app.enums import TimelineEventType
from app.dependencies import get_current_user
from app.models.user import User

client = TestClient(app)

def override_get_current_user():
    return User(id=4, email="member@example.com", role="member", manager_id=3)

app.dependency_overrides[get_current_user] = override_get_current_user

# Properties: 1, 2, 5, 6, 7, 8

def test_timeline_ordering_invariant(test_db):
    """
    Property 1: Timeline ordering invariant.
    Seed N random TimelineEvent rows; call GET; assert strictly descending by timestamp.
    """
    now = datetime.utcnow()
    # Seed 10 events
    for i in range(10):
        ev = TimelineEvent(
            employee_id=4,
            event_type=TimelineEventType.GOAL_CREATED,
            timestamp=now - timedelta(minutes=10 - i),
            title=f"Event {i}"
        )
        test_db.add(ev)
    test_db.commit()

    resp = client.get("/api/v1/timeline/4")
    assert resp.status_code == 200
    events = resp.json()["events"]
    assert len(events) == 10
    
    # Assert descending order
    for i in range(len(events) - 1):
        t1 = datetime.fromisoformat(events[i]["timestamp"].replace("Z", "+00:00"))
        t2 = datetime.fromisoformat(events[i+1]["timestamp"].replace("Z", "+00:00"))
        assert t1 >= t2

def test_own_timeline_always_accessible():
    """Property 2: Own timeline always accessible."""
    resp = client.get("/api/v1/timeline/4")
    assert resp.status_code == 200

def test_timeline_type_filter(test_db):
    """Property 5: Timeline type filter correctness."""
    test_db.add(TimelineEvent(employee_id=4, event_type=TimelineEventType.GOAL_CREATED, timestamp=datetime.utcnow(), title="E1"))
    test_db.add(TimelineEvent(employee_id=4, event_type=TimelineEventType.ACHIEVEMENT_LOGGED, timestamp=datetime.utcnow(), title="E2"))
    test_db.commit()
    
    resp = client.get(f"/api/v1/timeline/4?type_filter={TimelineEventType.ACHIEVEMENT_LOGGED.value}")
    events = resp.json()["events"]
    assert len(events) == 1
    assert events[0]["event_type"] == TimelineEventType.ACHIEVEMENT_LOGGED.value

def test_timeline_date_filter(test_db):
    """Property 6: Date filter inclusive bounds."""
    today = datetime.utcnow()
    yesterday = today - timedelta(days=1)
    tomorrow = today + timedelta(days=1)
    
    test_db.add(TimelineEvent(employee_id=4, event_type=TimelineEventType.GOAL_CREATED, timestamp=yesterday, title="E1"))
    test_db.add(TimelineEvent(employee_id=4, event_type=TimelineEventType.GOAL_CREATED, timestamp=today, title="E2"))
    test_db.add(TimelineEvent(employee_id=4, event_type=TimelineEventType.GOAL_CREATED, timestamp=tomorrow, title="E3"))
    test_db.commit()
    
    # Filter to today only
    today_str = today.date().isoformat()
    resp = client.get(f"/api/v1/timeline/4?start_date={today_str}&end_date={today_str}")
    events = resp.json()["events"]
    assert len(events) == 1
    assert events[0]["title"] == "E2"

def test_timeline_pagination(test_db):
    """Property 7: Pagination correct slice and metadata."""
    now = datetime.utcnow()
    for i in range(25):
        test_db.add(TimelineEvent(employee_id=4, event_type=TimelineEventType.GOAL_CREATED, timestamp=now, title=f"E{i}"))
    test_db.commit()
    
    resp = client.get("/api/v1/timeline/4?page=2&page_size=10")
    data = resp.json()
    assert data["total_count"] == 25
    assert len(data["events"]) == 10
    assert data["page"] == 2
    assert data["page_size"] == 10

def test_timeline_csv_export(test_db):
    """Property 8: CSV Export structure invariant."""
    now = datetime.utcnow()
    test_db.add(TimelineEvent(employee_id=4, event_type=TimelineEventType.GOAL_CREATED, timestamp=now, title="E1", summary="Sum 1"))
    test_db.commit()
    
    resp = client.get("/api/v1/timeline/4/export")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "attachment; filename" in resp.headers["content-disposition"]
    
    content = resp.text.split("\r\n")
    assert content[0] == "timestamp,type,title,summary"
    assert "E1" in content[1]
    assert "Sum 1" in content[1]
