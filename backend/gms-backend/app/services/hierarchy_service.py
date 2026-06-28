"""
Hierarchy service — skip-level access control derived from manager_id chain.

No separate permission table is used; visibility is computed at query time
by walking the manager_id chain on the User model.
"""

from sqlalchemy.orm import Session
from app.models.user import User


def get_management_chain(db: Session, user_id: int, max_depth: int = 20) -> set[int]:
    """Walk the manager_id chain upward from *user_id* and return every ancestor.

    Args:
        db:        SQLAlchemy sync session.
        user_id:   The user whose ancestors we want.
        max_depth: Hard cap on chain length; prevents infinite loops in addition
                   to the visited-set guard.  Default 20 per spec.

    Returns:
        A set of user IDs for every ancestor (manager, manager's manager, …).
        The starting *user_id* itself is NOT included.
        Returns an empty set if the user does not exist or has no manager.
    """
    ancestors: set[int] = set()
    visited: set[int] = {user_id}  # include start to catch cycles back to self

    current_id: int | None = user_id
    depth = 0

    while depth < max_depth:
        user = db.query(User).filter(User.id == current_id).first()
        if user is None or user.manager_id is None:
            # No further ancestors — chain terminates naturally.
            break

        manager_id: int = user.manager_id

        if manager_id in visited:
            # Circular reference detected — stop to avoid an infinite loop.
            break

        ancestors.add(manager_id)
        visited.add(manager_id)
        current_id = manager_id
        depth += 1

    return ancestors


def can_read(db: Session, requesting_user: User, target_employee_id: int) -> bool:
    """Return True if *requesting_user* is authorised to read *target_employee_id*'s data.

    Access is granted when the requester:
      1. IS the target employee (same id), OR
      2. Is the direct manager of the target (target.manager_id == requester.id), OR
      3. Is a skip-level ancestor anywhere in the target's management chain.

    Args:
        db:                  SQLAlchemy sync session.
        requesting_user:     The authenticated user object (must have .id).
        target_employee_id:  The employee whose data is being requested.

    Returns:
        True if access is permitted, False otherwise.
    """
    # Case 1: requester is the employee themselves.
    if requesting_user.id == target_employee_id:
        return True

    # Fetch target to check direct manager and full chain.
    target = db.query(User).filter(User.id == target_employee_id).first()
    if target is None:
        # Target does not exist — no access to grant.
        return False

    # Case 2: requester is the direct (one-hop) manager.
    if target.manager_id == requesting_user.id:
        return True

    # Case 3: requester is a skip-level ancestor.
    ancestors = get_management_chain(db, target_employee_id)
    return requesting_user.id in ancestors


def is_direct_manager(db: Session, manager_id: int, employee_id: int) -> bool:
    """Return True if *manager_id* is the immediate (one-hop) manager of *employee_id*.

    This is intentionally strict — skip-level relationships return False.

    Args:
        db:          SQLAlchemy sync session.
        manager_id:  The user to check as manager.
        employee_id: The subordinate user to check.

    Returns:
        True only when employee.manager_id == manager_id exactly.
    """
    employee = db.query(User).filter(User.id == employee_id).first()
    if employee is None:
        return False
    return employee.manager_id == manager_id
