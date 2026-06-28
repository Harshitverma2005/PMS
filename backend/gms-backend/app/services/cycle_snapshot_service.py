"""
Cycle snapshot service — snapshot manager_of_record_id at cycle activation.
"""

from sqlalchemy.orm import Session

from app.models.review import ReviewForm, ReviewCycle
from app.models.user import User


def snapshot_manager_of_record(db: Session, cycle_id: int) -> None:
    """
    For every ReviewForm in the given cycle, set manager_of_record_id to the
    employee's current manager_id. All updates execute atomically — if any
    row fails, the transaction is rolled back entirely.
    """
    forms = db.query(ReviewForm).filter(ReviewForm.review_cycle_id == cycle_id).all()

    for form in forms:
        employee = db.query(User).filter(User.id == form.employee_id).first()
        form.manager_of_record_id = employee.manager_id if employee else None

    # Commit handled by caller (inside trigger_cycle transaction) or here if standalone
    db.flush()
