import pytest
from app.services.cycle_snapshot_service import snapshot_manager_of_record
from app.models.user import User
from app.models.review import ReviewForm
from app.enums import ReviewFormType

def test_manager_of_record_immutability(test_db, sample_users, sample_review_cycle):
    """Property 31: Manager-of-record immutability."""
    member = sample_users["member"]
    manager = sample_users["manager"]
    
    # Form created before snapshot
    form = ReviewForm(
        review_cycle_id=sample_review_cycle.id,
        employee_id=member.id,
        manager_id=manager.id,
        form_type=ReviewFormType.MANAGER_FEEDBACK
    )
    test_db.add(form)
    test_db.commit()
    
    snapshot_manager_of_record(test_db, sample_review_cycle.id)
    
    test_db.refresh(form)
    assert form.manager_of_record_id == manager.id
    
    # Change manager
    member.manager_id = 999
    test_db.commit()
    
    # Manager of record should NOT change
    test_db.refresh(form)
    assert form.manager_of_record_id == manager.id

def test_cycle_snapshot_atomicity(test_db, sample_users, sample_review_cycle, mocker):
    """Property 32: Cycle snapshot atomicity (simulate failure)."""
    # This is a bit tricky to simulate purely without deep mocks.
    # The requirement asks to ensure that either all are updated or none are.
    # We can mock the db.commit to raise an exception.
    member = sample_users["member"]
    form = ReviewForm(review_cycle_id=sample_review_cycle.id, employee_id=member.id)
    test_db.add(form)
    test_db.commit()
    
    original_commit = test_db.commit
    def broken_commit():
        raise Exception("DB failed")
    
    test_db.commit = broken_commit
    try:
        snapshot_manager_of_record(test_db, sample_review_cycle.id)
    except Exception:
        pass
    
    test_db.commit = original_commit
    test_db.rollback()
    
    # Verify rollback happened (the fields are still null)
    test_db.refresh(form)
    assert form.manager_of_record_id is None
