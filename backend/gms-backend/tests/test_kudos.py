"""
Kudos property tests — Properties 28, 29, 30
Validates: Requirements 7.1, 7.2, 7.4, 7.5
# Feature: upms-pro-features
"""
import pytest

from app.models.kudos import Kudos
from app.models.timeline import TimelineEvent
from app.models.user import User
from app.enums import TimelineEventType, UserRole


# ── Property 28: Kudos self-give guard ────────────────────────────────────

def test_kudos_self_give_guard(test_db, sample_users, client_as_member):
    """Sending kudos to yourself returns 422 and persists no record."""
    resp = client_as_member.post("/api/v1/kudos/", json={
        "recipient_id": 4,   # same as authenticated member (id=4)
        "message": "Good job me",
    })
    assert resp.status_code == 422, resp.text
    assert test_db.query(Kudos).count() == 0


# ── Property 29: Kudos feed ordering ─────────────────────────────────────

def test_kudos_feed_ordering(test_db, sample_users, client_as_member):
    """Kudos feed is ordered descending by created_at and includes sender/recipient names."""
    # user 4 (member) sends kudos to user 5 (other_member)
    client_as_member.post("/api/v1/kudos/", json={"recipient_id": 5, "message": "K1"})
    client_as_member.post("/api/v1/kudos/", json={"recipient_id": 5, "message": "K2"})

    resp = client_as_member.get("/api/v1/kudos/feed")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "items" in data, f"Expected 'items' key, got: {list(data.keys())}"
    items = data["items"]
    assert len(items) == 2
    # Most recent first
    assert items[0]["message"] == "K2"
    assert items[1]["message"] == "K1"
    # Names populated
    assert items[0]["sender_name"] is not None
    assert items[0]["recipient_name"] is not None


# ── Property 30: Kudos emits timeline event on recipient ──────────────────

def test_kudos_timeline_event(test_db, sample_users, client_as_member):
    """Creating kudos emits a KUDOS_RECEIVED event on the recipient's timeline only."""
    # member (id=4) sends kudos to other_member (id=5)
    resp = client_as_member.post("/api/v1/kudos/", json={"recipient_id": 5, "message": "Great work!"})
    assert resp.status_code == 201, resp.text

    # Recipient should have the event
    recipient_events = (
        test_db.query(TimelineEvent)
        .filter_by(employee_id=5, event_type=TimelineEventType.KUDOS_RECEIVED)
        .all()
    )
    assert len(recipient_events) == 1
    assert recipient_events[0].summary == "Great work!"

    # Sender should NOT have a KUDOS_RECEIVED event
    sender_events = (
        test_db.query(TimelineEvent)
        .filter_by(employee_id=4, event_type=TimelineEventType.KUDOS_RECEIVED)
        .all()
    )
    assert len(sender_events) == 0
