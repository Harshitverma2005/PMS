"""
AI Draft service — generate evidence-backed review drafts using an AI provider.
"""

import json
import httpx
from sqlalchemy.orm import Session

from app.models.review import ReviewForm, ReviewCycle
from app.models.user import User
from app.enums import ReviewCycleStatus, ReviewFormType, UserRole


async def generate(db: Session, form_id: int, requesting_user_id: int) -> dict:
    """
    Generate an AI review draft for the given form.
    - 403 if requesting user is member.
    - 404 if form not found or cycle not active.
    - 422 if no active/completed goals in period.
    - 503 on AI provider error.
    - Atomically replaces draft only on success.
    """
    from app.services import timeline_service
    from app.config import settings

    requesting_user = db.query(User).filter(User.id == requesting_user_id).first()
    if requesting_user is None:
        raise PermissionError("User not found")

    role = requesting_user.role.value if hasattr(requesting_user.role, 'value') else str(requesting_user.role)
    if role == "member":
        raise PermissionError("Only managers and admins can generate AI drafts")

    form = db.query(ReviewForm).filter(ReviewForm.id == form_id).first()
    if form is None:
        raise LookupError("ReviewForm not found or cycle is not active")

    cycle = db.query(ReviewCycle).filter(
        ReviewCycle.id == form.review_cycle_id,
        ReviewCycle.status == ReviewCycleStatus.ACTIVE,
    ).first()
    if cycle is None:
        raise LookupError("ReviewForm not found or cycle is not active")

    # Get work trail
    work_trail = timeline_service.get_work_trail(db, form.employee_id, cycle)

    # Validate: at least one active/completed goal
    from app.enums import GoalStatus
    eligible_goals = [
        g for g in work_trail["goals"]
        if g.status in [GoalStatus.ACTIVE, GoalStatus.COMPLETED]
    ]
    if not eligible_goals:
        raise ValueError("Insufficient evidence: no completed or active goals found for this employee in the review period")

    # Build prompt
    employee = db.query(User).filter(User.id == form.employee_id).first()
    employee_name = employee.name if employee else "Employee"

    prompt = _build_prompt(employee_name, work_trail)

    # Call AI provider
    ai_draft = await _call_ai_provider(prompt, settings)

    # Atomic replace: only write on full success
    form.ai_draft = ai_draft
    form.citations = ai_draft.get("citations", {})
    db.commit()
    db.refresh(form)

    return ai_draft


def _build_prompt(employee_name: str, work_trail: dict) -> str:
    """Construct a prompt string from the work trail."""
    lines = [f"Generate a structured performance review draft for {employee_name}.", ""]
    lines.append("Goals:")
    for g in work_trail["goals"]:
        lines.append(f"  - [{g.status.value}] {g.title}: {g.description[:100]}")

    lines.append("\nAchievements:")
    for a in work_trail["achievements"]:
        lines.append(f"  - [{a.category.value}] {a.title}: {a.description[:100]}")

    lines.append("\nKudos received:")
    for k in work_trail["kudos"]:
        lines.append(f"  - {k.message[:100]}")

    lines.append("\nProgress updates:")
    for p in work_trail["progress"]:
        lines.append(f"  - Goal #{p.goal_id}: {p.completion_percentage}% — {p.notes or ''}")

    lines.append("""
Return a JSON object with:
{
  "summary": "...",
  "strengths": ["...", "..."],
  "growth_areas": ["..."],
  "suggested_rating": 3,
  "citations": {
    "claim text": [{"event_type": "...", "event_date": "...", "event_title": "...", "source_id": 0}]
  }
}
""")
    return "\n".join(lines)


async def _call_ai_provider(prompt: str, settings) -> dict:
    """Call the configured AI provider with a 30-second timeout."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                settings.ai_provider_url,
                headers={
                    "Authorization": f"Bearer {settings.ai_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "user", "content": prompt}],
                    "response_format": {"type": "json_object"},
                },
            )
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            return json.loads(content)
    except Exception as exc:
        raise RuntimeError(f"Draft generation temporarily unavailable; please try again") from exc
