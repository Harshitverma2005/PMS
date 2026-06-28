"""
Kudos router — POST /api/v1/kudos, GET /api/v1/kudos/feed
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.kudos import KudosCreate, KudosResponse
from app.services import kudos_service

router = APIRouter()


@router.post("/", response_model=KudosResponse, status_code=status.HTTP_201_CREATED)
def create_kudos(
    data: KudosCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Give kudos to another user. Returns 422 if self-kudos or unknown recipient."""
    try:
        kudos = kudos_service.create_kudos(db, data, current_user.id)
        sender = db.query(User).filter(User.id == kudos.sender_id).first()
        recipient = db.query(User).filter(User.id == kudos.recipient_id).first()
        return KudosResponse(
            id=kudos.id,
            sender_id=kudos.sender_id,
            sender_name=sender.name if sender else f"User #{kudos.sender_id}",
            recipient_id=kudos.recipient_id,
            recipient_name=recipient.name if recipient else f"User #{kudos.recipient_id}",
            message=kudos.message,
            created_at=kudos.created_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/feed")
def get_kudos_feed(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get paginated kudos feed — all authenticated users can view."""
    result = kudos_service.get_feed(db, page, page_size)
    items = []
    for k in result["items"]:
        sender = db.query(User).filter(User.id == k.sender_id).first()
        recipient = db.query(User).filter(User.id == k.recipient_id).first()
        items.append(KudosResponse(
            id=k.id,
            sender_id=k.sender_id,
            sender_name=sender.name if sender else f"User #{k.sender_id}",
            recipient_id=k.recipient_id,
            recipient_name=recipient.name if recipient else f"User #{k.recipient_id}",
            message=k.message,
            created_at=k.created_at,
        ))
    return {"total_count": result["total_count"], "page": page, "page_size": page_size, "items": items}


@router.put("/{kudos_id}", status_code=405)
@router.patch("/{kudos_id}", status_code=405)
@router.delete("/{kudos_id}", status_code=405)
def kudos_mutation_not_allowed(kudos_id: int):
    """Kudos are append-only — PUT/PATCH/DELETE return 405."""
    raise HTTPException(status_code=405, detail="Kudos are append-only and cannot be modified or deleted")
