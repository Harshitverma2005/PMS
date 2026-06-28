"""
AI Draft and Export property tests — Properties 12, 33, 34, 35, 36
Validates: Requirements 3.1–3.10, 11.1–11.4
# Feature: upms-pro-features
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.models.review import ReviewForm, ReviewCycle
from app.enums import ReviewFormType, ReviewFormStatus, ReviewCycleStatus
from app.dependencies import get_current_user
from app.main import app


# ── Property 33: Export requires authentication ───────────────────────────

def test_export_requires_auth():
    """Unauthenticated export requests are rejected (403/401)."""
    from fastapi.testclient import TestClient
    # Remove any get_current_user override so the real HTTPBearer runs
    saved = app.dependency_overrides.pop(get_current_user, None)
    try:
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/api/v1/reviews/forms/999/export")
        # FastAPI HTTPBearer returns 403 when Authorization header is absent
        assert resp.status_code in (401, 403), resp.text
    finally:
        if saved is not None:
            app.dependency_overrides[get_current_user] = saved


# ── Property 34: Export blocked before manager submission ────────────────

def test_export_blocked_before_finalisation(test_db, sample_users, sample_review_cycle, client_as_member):
    """Export returns 422 when manager form is not yet submitted."""
    # Create a manager form (PENDING) for the member (id=4); manager_of_record_id = member's view
    mgr_form = ReviewForm(
        id=21,
        review_cycle_id=1,
        employee_id=4,
        manager_id=3,
        manager_of_record_id=None,
        form_type=ReviewFormType.MANAGER_FEEDBACK,
        status=ReviewFormStatus.PENDING,
    )
    # Also need a self-assessment form so the employee has an employee_id match
    self_form = ReviewForm(
        id=22,
        review_cycle_id=1,
        employee_id=4,
        form_type=ReviewFormType.SELF_ASSESSMENT,
        status=ReviewFormStatus.PENDING,
    )
    test_db.add_all([mgr_form, self_form])
    test_db.commit()

    # member (id=4) requests export of their own self-assessment form
    resp = client_as_member.get("/api/v1/reviews/forms/22/export")
    # manager form is PENDING, so export is blocked → 422
    assert resp.status_code == 422, resp.text


# ── Property 12: AI draft — member is forbidden ───────────────────────────

def test_ai_draft_member_forbidden(test_db, sample_users, sample_review_cycle, client_as_member):
    """Members cannot generate AI drafts — returns 403."""
    form = ReviewForm(
        id=30,
        review_cycle_id=1,
        employee_id=4,
        manager_id=3,
        form_type=ReviewFormType.MANAGER_FEEDBACK,
    )
    test_db.add(form)
    test_db.commit()

    resp = client_as_member.post("/api/v1/reviews/forms/30/draft")
    assert resp.status_code == 403, resp.text


# ── Property 13: AI draft — 422 when no evidence ─────────────────────────

def test_ai_draft_no_evidence_returns_422(test_db, sample_users, sample_review_cycle, client_as_manager):
    """AI draft returns 422 when there are no active/completed goals."""
    form = ReviewForm(
        id=31,
        review_cycle_id=1,
        employee_id=4,
        manager_id=3,
        form_type=ReviewFormType.MANAGER_FEEDBACK,
    )
    test_db.add(form)
    test_db.commit()

    resp = client_as_manager.post("/api/v1/reviews/forms/31/draft")
    # No goals exist → 422 insufficient evidence
    assert resp.status_code == 422, resp.text
