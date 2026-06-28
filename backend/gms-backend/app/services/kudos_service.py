"""
Kudos service — create kudos and serve the feed.
"""

from datetime import datetime
from typing import List

from sqlalchemy.orm import Session

from app.models.kudos import Kudos
from app.models.user import User
from app.enums import TimelineEventType


def create_kudos(db: Session, data, sender_id: int) -> Kudos:
    """
    Create a new Kudos record.
    - 422 if recipient == sender.
    - 422 if recipient does not exist.
    - Emits kudos_received timeline event on recipient's timeline.
    """
    from app.services import timeline_service

    if data.recipient_id == sender_id:
        raise ValueError("Cannot give kudos to yourself")

    recipient = db.query(User).filter(User.id == data.recipient_id).first()
    if recipient is None:
        raise ValueError("Recipient user not found")

    sender = db.query(User).filter(User.id == sender_id).first()
    sender_name = sender.name if sender else f"User #{sender_id}"

    kudos = Kudos(
        sender_id=sender_id,
        recipient_id=data.recipient_id,
        message=data.message,
        created_at=datetime.utcnow(),
    )
    db.add(kudos)
    db.flush()

    # Emit event on RECIPIENT's timeline
    timeline_service.emit(
        db=db,
        employee_id=data.recipient_id,
        event_type=TimelineEventType.KUDOS_RECEIVED,
        title=f"Kudos from {sender_name}",
        summary=data.message,
        source_id=kudos.id,
    )

    db.commit()
    db.refresh(kudos)
    return kudos


def get_feed(db: Session, page: int = 1, page_size: int = 50) -> dict:
    """Return paginated kudos feed, newest first, with sender/recipient names."""
    total = db.query(Kudos).count()
    rows = (
        db.query(Kudos)
        .order_by(Kudos.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {"total_count": total, "page": page, "page_size": page_size, "items": rows}
