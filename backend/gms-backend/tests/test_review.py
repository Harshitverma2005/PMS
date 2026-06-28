"""
Review form property tests — Properties 16, 17, 18, 19
Validates: Requirements 4.1, 4.2, 4.3, 4.8
# Feature: upms-pro-features
"""
import pytest

from app.models.review import ReviewForm
from app.enums import ReviewFormType, ReviewFormStatus


# ── Property 16: Separate review form records ─────────────────────────────

def test_separate_form_records(test_db, sample_users, sample_review_cycle):
    """Two distinct ReviewForm rows exist per employee per cycle — one per type."""
    f1 = ReviewForm(
        review_cycle_id=1,
        employee_id=4,
        form_type=ReviewFormType.SELF_ASSESSMENT,
    )
    f2 = ReviewForm(
        review_cycle_id=1,
        employee_id=4,
        manager_id=3,
        form_type=ReviewFormType.MANAGER_FEEDBACK,
    )
    test_db.add_all([f1, f2])
    test_db.commit()

    assert f1.id != f2.id
    assert f1.form_type != f2.form_type


# ── Property 17: Self-assessment immutability after submission ────────────

def test_self_assessment_immutability(test_db, sample_users, sample_review_cycle, client_as_member):
    """Re-submitting a submitted self-assessment returns 400 and leaves it unchanged."""
    f1 = ReviewForm(
        id=10,
        review_cycle_id=1,
        employee_id=4,
        form_type=ReviewFormType.SELF_ASSESSMENT,
        status=ReviewFormStatus.SUBMITTED,
    )
    test_db.add(f1)
    test_db.commit()

    resp = client_as_member.post(
        "/api/v1/review-forms/10/submit",
        json={"form_data": {"q": "a"}},
    )
    assert resp.status_code == 400, resp.text
    detail = resp.json().get("detail", "").lower()
    assert "immutable" in detail or "already submitted" in detail or "submitted" in detail


# ── Property 18: Manager form validation ─────────────────────────────────

def test_manager_form_validation(test_db, sample_users, sample_review_cycle, client_as_manager):
    """Manager form submission requires non-empty comment and rating in [1,5]."""
    f1 = ReviewForm(
        id=11,
        review_cycle_id=1,
        employee_id=4,
        manager_id=3,
        form_type=ReviewFormType.MANAGER_FEEDBACK,
    )
    test_db.add(f1)
    test_db.commit()

    # Missing comment / rating
    resp = client_as_manager.post(
        "/api/v1/review-forms/11/submit",
        json={"form_data": {}},
    )
    assert resp.status_code == 400, resp.text
    detail = resp.json().get("detail", "").lower()
    assert "comment" in detail or "rating" in detail

    # Rating out of range
    resp = client_as_manager.post(
        "/api/v1/review-forms/11/submit",
        json={"form_data": {"comment": "Good"}, "final_rating": 6},
    )
    assert resp.status_code == 400, resp.text
    detail = resp.json().get("detail", "").lower()
    assert "rating" in detail or "1" in detail or "5" in detail


# ── Property 19: Manager content hidden until submission ──────────────────

def test_manager_content_hidden_until_submission(test_db, sample_users, sample_review_cycle, client_as_member):
    """Member cannot see manager final_rating/form_data until manager form is submitted."""
    # The requesting user (member, id=4) is the employee; manager id=3 hasn't submitted yet
    f1 = ReviewForm(
        id=12,
        review_cycle_id=1,
        employee_id=4,
        manager_id=3,
        form_type=ReviewFormType.MANAGER_FEEDBACK,
        status=ReviewFormStatus.PENDING,
        final_rating=4,
        form_data={"comment": "Excellent"},
    )
    test_db.add(f1)
    test_db.commit()

    resp = client_as_member.get("/api/v1/review-forms/12")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data.get("final_rating") is None
    assert data.get("form_data") is None
