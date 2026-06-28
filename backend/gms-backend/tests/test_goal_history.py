"""
Goal history property tests — Properties 9, 10, 11
Validates: Requirements 2.2, 2.3, 2.4, 2.8
# Feature: upms-pro-features
"""
import pytest
from datetime import datetime, timedelta, date

from app.models.goal import Goal
from app.models.timeline import TimelineEvent
from app.enums import GoalStatus, GoalLevel, GoalTag, GoalPriority, TimelineEventType
from tests.conftest import _make_goal


# ── Property 9: Goal history ordered and complete ─────────────────────────

def test_goal_history_ordered_and_complete(test_db, sample_users, client_as_manager):
    """N status transitions produce exactly N history entries in ascending order."""
    goal = _make_goal(id=10, title="History Goal", assignee_id=4, status=GoalStatus.PENDING_APPROVAL)
    test_db.add(goal)
    test_db.commit()

    # Approve (PENDING_APPROVAL → ACTIVE)
    r1 = client_as_manager.post("/api/v1/goals/10/approve", json={"approved": True, "comment": "Looks good"})
    assert r1.status_code in (200, 201), r1.text

    # Archive (ACTIVE → ARCHIVED)
    r2 = client_as_manager.post("/api/v1/goals/10/archive", json={"archive_reason": "No longer needed"})
    assert r2.status_code in (200, 201), r2.text

    resp = client_as_manager.get("/api/v1/goals/10/history")
    assert resp.status_code == 200, resp.text
    hist = resp.json()
    assert len(hist) == 2
    # Ascending order — first entry is approval
    assert hist[0]["comment"] == "Looks good"
    assert hist[1]["comment"] == "No longer needed"


# ── Property 10: Whitespace-only comment rejection ────────────────────────

def test_whitespace_comment_rejection(test_db, sample_users, client_as_manager):
    """Whitespace-only comments return 422 and leave goal status unchanged."""
    goal = _make_goal(id=11, title="Whitespace Test", assignee_id=4, status=GoalStatus.PENDING_APPROVAL)
    test_db.add(goal)
    test_db.commit()

    resp = client_as_manager.post("/api/v1/goals/11/approve", json={"approved": True, "comment": "   "})
    assert resp.status_code == 422, resp.text

    resp = client_as_manager.post("/api/v1/goals/11/archive", json={"archive_reason": "\n\t"})
    assert resp.status_code == 422, resp.text

    # Status should remain PENDING_APPROVAL
    test_db.refresh(goal)
    assert goal.status == GoalStatus.PENDING_APPROVAL


# ── Property 11: Goal transition emits timeline event ─────────────────────

def test_goal_transition_timeline_event(test_db, sample_users, client_as_manager):
    """Archiving a goal emits a GOAL_STATUS_CHANGED timeline event for the assignee."""
    goal = _make_goal(id=12, title="Timeline Emit Goal", assignee_id=4, status=GoalStatus.ACTIVE)
    test_db.add(goal)
    test_db.commit()

    resp = client_as_manager.post("/api/v1/goals/12/archive", json={"archive_reason": "Archived it"})
    assert resp.status_code in (200, 201), resp.text

    events = (
        test_db.query(TimelineEvent)
        .filter_by(employee_id=4, event_type=TimelineEventType.GOAL_STATUS_CHANGED)
        .all()
    )
    assert len(events) >= 1
    assert "Archived it" in events[-1].summary
