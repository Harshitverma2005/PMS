"""
Timeline property tests — Properties 1, 2, 5, 6, 7, 8
Validates: Requirements 1.1, 1.2, 1.7, 1.8, 1.9, 1.10
# Feature: upms-pro-features
"""
import pytest
from datetime import datetime, timedelta

from app.models.timeline import TimelineEvent
from app.enums import TimelineEventType


# ── Property 1: Timeline ordering invariant ───────────────────────────────

def test_timeline_ordering_invariant(test_db, sample_users, client_as_member):
    """Events are returned in strictly descending timestamp order."""
    now = datetime.utcnow()
    for i in range(10):
        ev = TimelineEvent(
            employee_id=4,
            event_type=TimelineEventType.GOAL_CREATED,
            timestamp=now - timedelta(minutes=10 - i),
            title=f"Event {i}",
        )
        test_db.add(ev)
    test_db.commit()

    resp = client_as_member.get("/api/v1/timeline/4")
    assert resp.status_code == 200
    events = resp.json()["events"]
    assert len(events) == 10

    for i in range(len(events) - 1):
        t1 = datetime.fromisoformat(events[i]["timestamp"].replace("Z", "+00:00"))
        t2 = datetime.fromisoformat(events[i + 1]["timestamp"].replace("Z", "+00:00"))
        assert t1 >= t2


# ── Property 2: Own timeline always accessible ────────────────────────────

def test_own_timeline_always_accessible(test_db, sample_users, client_as_member):
    """Any authenticated user can always read their own timeline."""
    resp = client_as_member.get("/api/v1/timeline/4")
    assert resp.status_code == 200


# ── Property 5: Timeline type filter correctness ──────────────────────────

def test_timeline_type_filter(test_db, sample_users, client_as_member):
    """Filtering by event type returns only events of that type."""
    test_db.add(TimelineEvent(employee_id=4, event_type=TimelineEventType.GOAL_CREATED, timestamp=datetime.utcnow(), title="E1"))
    test_db.add(TimelineEvent(employee_id=4, event_type=TimelineEventType.ACHIEVEMENT_LOGGED, timestamp=datetime.utcnow(), title="E2"))
    test_db.commit()

    resp = client_as_member.get(f"/api/v1/timeline/4?type={TimelineEventType.ACHIEVEMENT_LOGGED.value}")
    assert resp.status_code == 200
    events = resp.json()["events"]
    assert len(events) == 1
    assert events[0]["event_type"] == TimelineEventType.ACHIEVEMENT_LOGGED.value


# ── Property 6: Date filter inclusive bounds ──────────────────────────────

def test_timeline_date_filter(test_db, sample_users, client_as_member):
    """start_date/end_date filters include boundary dates."""
    today = datetime.utcnow()
    yesterday = today - timedelta(days=1)
    tomorrow = today + timedelta(days=1)

    test_db.add(TimelineEvent(employee_id=4, event_type=TimelineEventType.GOAL_CREATED, timestamp=yesterday, title="E1"))
    test_db.add(TimelineEvent(employee_id=4, event_type=TimelineEventType.GOAL_CREATED, timestamp=today, title="E2"))
    test_db.add(TimelineEvent(employee_id=4, event_type=TimelineEventType.GOAL_CREATED, timestamp=tomorrow, title="E3"))
    test_db.commit()

    today_str = today.date().isoformat()
    resp = client_as_member.get(f"/api/v1/timeline/4?start_date={today_str}&end_date={today_str}")
    assert resp.status_code == 200
    events = resp.json()["events"]
    assert len(events) == 1
    assert events[0]["title"] == "E2"


# ── Property 7: Pagination metadata ──────────────────────────────────────

def test_timeline_pagination(test_db, sample_users, client_as_member):
    """Paginated response has correct slice length and total_count."""
    now = datetime.utcnow()
    for i in range(25):
        test_db.add(TimelineEvent(employee_id=4, event_type=TimelineEventType.GOAL_CREATED, timestamp=now, title=f"E{i}"))
    test_db.commit()

    resp = client_as_member.get("/api/v1/timeline/4?page=2&page_size=10")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_count"] == 25
    assert len(data["events"]) == 10
    assert data["page"] == 2
    assert data["page_size"] == 10


# ── Property 8: CSV export structure invariant ────────────────────────────

def test_timeline_csv_export(test_db, sample_users, client_as_member):
    """CSV export has correct header and Content-Disposition header."""
    now = datetime.utcnow()
    test_db.add(TimelineEvent(employee_id=4, event_type=TimelineEventType.GOAL_CREATED, timestamp=now, title="E1", summary="Sum 1"))
    test_db.commit()

    resp = client_as_member.get("/api/v1/timeline/4/export")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "attachment; filename" in resp.headers["content-disposition"]

    lines = resp.text.splitlines()
    assert lines[0] == "timestamp,type,title,summary"
    assert "E1" in lines[1]
    assert "Sum 1" in lines[1]
