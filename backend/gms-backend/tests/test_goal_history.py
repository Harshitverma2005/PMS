import pytest
from fastapi.testclient import TestClient
from datetime import datetime

from app.main import app
from app.models.goal import Goal
from app.models.timeline import TimelineEvent
from app.enums import GoalStatus, TimelineEventType
from app.dependencies import get_current_user
from app.models.user import User

client = TestClient(app)

def override_get_current_user():
    # Manager
    return User(id=3, email="manager@example.com", role="manager", manager_id=2)

app.dependency_overrides[get_current_user] = override_get_current_user

# Properties: 9, 10, 11

def test_goal_history_ordered_and_complete(test_db):
    """
    Property 9: Goal status history ordered and complete.
    """
    goal = Goal(id=10, title="G", assignee_id=4, status=GoalStatus.ACTIVE)
    test_db.add(goal)
    test_db.commit()
    
    # Do 3 transitions
    client.post("/api/v1/goals/10/approve", json={"approved": False, "comment": "T1"})
    client.post("/api/v1/goals/10/approve", json={"approved": True, "comment": "T2"})
    client.post("/api/v1/goals/10/archive", json={"archive_reason": "T3"})
    
    resp = client.get("/api/v1/goals/10/history")
    assert resp.status_code == 200
    hist = resp.json()
    assert len(hist) == 3
    assert hist[0]["comment"] == "T1"
    assert hist[1]["comment"] == "T2"
    assert hist[2]["comment"] == "T3"

def test_whitespace_comment_rejection(test_db):
    """Property 10: Goal approval/rejection rejects whitespace-only comments."""
    goal = Goal(id=11, title="G", assignee_id=4, status=GoalStatus.PENDING_APPROVAL)
    test_db.add(goal)
    test_db.commit()
    
    resp = client.post("/api/v1/goals/11/approve", json={"approved": True, "comment": "   "})
    assert resp.status_code == 422
    
    resp = client.post("/api/v1/goals/11/archive", json={"archive_reason": "\n\t"})
    assert resp.status_code == 422
    
    # Status should be unchanged
    test_db.refresh(goal)
    assert goal.status == GoalStatus.PENDING_APPROVAL

def test_goal_transition_timeline_event(test_db):
    """Property 11: Goal transition emits Timeline_Event."""
    goal = Goal(id=12, title="G", assignee_id=4, status=GoalStatus.ACTIVE)
    test_db.add(goal)
    test_db.commit()
    
    # Transition
    client.post("/api/v1/goals/12/archive", json={"archive_reason": "Archived it"})
    
    events = test_db.query(TimelineEvent).filter_by(employee_id=4, event_type=TimelineEventType.GOAL_STATUS_CHANGED).all()
    assert len(events) >= 1
    # Check the last one
    assert "Archived it" in events[-1].summary
