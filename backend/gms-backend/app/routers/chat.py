from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services.chat_cache import chat_cache
from app.services.chat_service import fetch_context_for_user, chat_with_llm

router = APIRouter(prefix="/chat", tags=["chat"])

class ChatMessage(BaseModel):
    message: str

@router.post("")
def chat(
    payload: ChatMessage,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Try to get context from cache
    context = chat_cache.get_context(current_user.id)
    if not context:
        # Fetch from DB and cache
        context = fetch_context_for_user(db, current_user)
        chat_cache.set_context(current_user.id, context)

    # Call LLM
    response = chat_with_llm(context, payload.message)
    return {"reply": response}

@router.post("/clear")
def clear_chat_context(
    current_user: User = Depends(get_current_user)
):
    chat_cache.clear_context(current_user.id)
    return {"status": "cleared"}
