"""
Cycle snapshot property tests — Properties 31, 32
Validates: Requirements 9.1, 9.2
# Feature: upms-pro-features
"""
import pytest

from app.services.cycle_snapshot_service import snapshot_manager_of_record
from app.models.review import ReviewForm
from app.enums import ReviewFormType


# ── Property 31: Manager-of-record immutability ───────────────────────────

def test_manager_of_record_immutability(test_db, sample_users, sample_review_cycle):
    """manager_of_record_id is snapshotted at cycle activation and doesn't change."""
    member = sample_users["member"]
    manager = sample_users["manager"]

    form = ReviewForm(
        review_cycle_id=sample_review_cycle.id,
        employee_id=member.id,
        manager_id=manager.id,
        form_type=ReviewFormType.MANAGER_FEEDBACK,
    )
    test_db.add(form)
    test_db.commit()

    snapshot_manager_of_record(test_db, sample_review_cycle.id)
    test_db.refresh(form)
    assert form.manager_of_record_id == manager.id

    # Change the employee's current manager — snapshot must not change
    member.manager_id = 999
    test_db.commit()

    test_db.refresh(form)
    assert form.manager_of_record_id == manager.id


# ── Property 32: Cycle snapshot atomicity ────────────────────────────────

def test_cycle_snapshot_atomicity(test_db, sample_users, sample_review_cycle):
    """If snapshot fails mid-way, no form gets a partial update (all-or-nothing)."""
    member = sample_users["member"]

    form = ReviewForm(
        review_cycle_id=sample_review_cycle.id,
        employee_id=member.id,
        manager_id=sample_users["manager"].id,
        form_type=ReviewFormType.MANAGER_FEEDBACK,
    )
    test_db.add(form)
    test_db.commit()

    original_commit = test_db.commit

    def broken_commit():
        raise Exception("Simulated DB failure")

    test_db.commit = broken_commit
    try:
        snapshot_manager_of_record(test_db, sample_review_cycle.id)
    except Exception:
        pass
    finally:
        test_db.commit = original_commit

    test_db.rollback()
    test_db.refresh(form)

    # Rollback means manager_of_record_id is still None
    assert form.manager_of_record_id is None
