import os
import json
from sqlalchemy.orm import Session
from openai import OpenAI
from app.models.user import User
from app.models.goal import Goal
from app.models.feedback import FeedbackForm

def get_groq_client():
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return None
    return OpenAI(
        base_url="https://api.groq.com/openai/v1",
        api_key=api_key
    )

def fetch_employee_context(db: Session, user: User):
    goals = db.query(Goal).filter(Goal.owner_id == user.id).all()
    feedback = db.query(FeedbackForm).filter(FeedbackForm.employee_id == user.id).all()
    return {
        "role": "employee",
        "name": user.name,
        "goals": [{"title": g.title, "status": g.status, "completion_pct": g.completion_pct} for g in goals],
        "feedback_scores": [f.overall_score for f in feedback if f.overall_score is not None]
    }

def fetch_manager_context(db: Session, user: User):
    own_goals = db.query(Goal).filter(Goal.owner_id == user.id).all()
    team = db.query(User).filter(User.manager_id == user.id).all()
    team_ids = [t.id for t in team]
    team_goals = db.query(Goal).filter(Goal.owner_id.in_(team_ids)).all() if team_ids else []
    
    return {
        "role": "manager",
        "name": user.name,
        "own_goals": [{"title": g.title, "status": g.status, "completion_pct": g.completion_pct} for g in own_goals],
        "team_members": [{"name": t.name, "id": t.id} for t in team],
        "team_goals": [{"owner_id": g.owner_id, "title": g.title, "status": g.status, "completion_pct": g.completion_pct} for g in team_goals]
    }

def fetch_admin_context(db: Session, user: User):
    total_users = db.query(User).filter(User.is_active == True).count()
    total_goals = db.query(Goal).count()
    return {
        "role": "admin",
        "name": user.name,
        "total_active_users": total_users,
        "total_goals": total_goals
    }

def fetch_context_for_user(db: Session, user: User):
    if user.role == "admin":
        return fetch_admin_context(db, user)
    elif user.role == "manager":
        return fetch_manager_context(db, user)
    else:
        return fetch_employee_context(db, user)

def chat_with_llm(context: dict, message: str) -> str:
    client = get_groq_client()
    if not client:
        return "I'm sorry, the chat service is currently unavailable. (GROQ_API_KEY is not set)"

    system_prompt = (
        "You are a strictly read-only assistant for a Goal Management System. "
        "You CANNOT modify data, create tasks, or perform actions. "
        "You can ONLY answer questions based on the provided JSON context. "
        "If the user asks something outside this context or requests an action, politely decline. "
        f"Context: {json.dumps(context)}"
    )
    
    try:
        response = client.chat.completions.create(
            model="llama3-8b-8192", 
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message}
            ],
            temperature=0.3
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"Error connecting to chat service: {str(e)}"
