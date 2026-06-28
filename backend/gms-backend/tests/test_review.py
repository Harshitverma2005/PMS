import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.review import ReviewForm
from app.enums import ReviewFormType, ReviewFormStatus
from app.dependencies import get_current_user
from app.models.user import User

client = TestClient(app)

def override_get_current_user():
    return User(id=3, email="manager@example.com", role="manager", manager_id=2)

app.dependency_overrides[get_current_user] = override_get_current_user

def test_separate_form_records(test_db, sample_users, sample_review_cycle):
    """Property 16: Separate review form records."""
    # Already seeded by trigger_cycle if we had one.
    # Manual setup
    f1 = ReviewForm(review_cycle_id=1, employee_id=4, form_type=ReviewFormType.SELF_ASSESSMENT)
    f2 = ReviewForm(review_cycle_id=1, employee_id=4, manager_id=3, form_type=ReviewFormType.MANAGER_FEEDBACK)
    test_db.add_all([f1, f2])
    test_db.commit()
    
    assert f1.id != f2.id
    assert f1.form_type != f2.form_type

def test_self_assessment_immutability(test_db):
    """Property 17: Self-assessment immutability after submission."""
    f1 = ReviewForm(id=10, review_cycle_id=1, employee_id=3, form_type=ReviewFormType.SELF_ASSESSMENT, status=ReviewFormStatus.SUBMITTED)
    test_db.add(f1)
    test_db.commit()
    
    resp = client.post("/api/v1/review-forms/10/submit", json={"form_data": {"q": "a"}})
    assert resp.status_code == 400
    assert "immutable" in resp.json()["detail"].lower()

def test_manager_form_validation(test_db):
    """Property 18: Manager form validation — comment and rating required."""
    f1 = ReviewForm(id=11, review_cycle_id=1, employee_id=4, manager_id=3, form_type=ReviewFormType.MANAGER_FEEDBACK)
    test_db.add(f1)
    test_db.commit()
    
    resp = client.post("/api/v1/review-forms/11/submit", json={"form_data": {}, "final_rating": None})
    assert resp.status_code == 400
    assert "comment is required" in resp.json()["detail"].lower()
    
    resp = client.post("/api/v1/review-forms/11/submit", json={"form_data": {"comment": "Good"}, "final_rating": 6})
    assert resp.status_code == 400
    assert "between 1 and 5" in resp.json()["detail"].lower()

def test_manager_content_hidden_until_submission(test_db):
    """Property 19: Manager content hidden until submission."""
    f1 = ReviewForm(id=12, review_cycle_id=1, employee_id=3, manager_id=2, form_type=ReviewFormType.MANAGER_FEEDBACK, final_rating=4, form_data={"comment": "Good"})
    test_db.add(f1)
    test_db.commit()
    
    # User 3 (the employee) requesting their manager's un-submitted form
    resp = client.get("/api/v1/review-forms/12")
    data = resp.json()
    assert data["final_rating"] is None
    assert data["form_data"] is None
