"""
Export service — render a completed review as a self-contained HTML file.
"""

import re
from typing import Tuple

from sqlalchemy.orm import Session

from app.models.review import ReviewForm
from app.models.user import User
from app.enums import ReviewFormType, ReviewFormStatus


def render(db: Session, form_id: int, requesting_user_id: int) -> Tuple[str, str]:
    """
    Render the completed review for *form_id* as self-contained HTML.
    Returns (html_string, filename).
    """
    form = db.query(ReviewForm).filter(ReviewForm.id == form_id).first()
    if form is None:
        raise LookupError("ReviewForm not found")

    # Check access: must be employee or manager_of_record
    if (form.employee_id != requesting_user_id and
            form.manager_of_record_id != requesting_user_id):
        raise PermissionError("Access denied — you are not the employee or manager of record for this review")

    # Load the manager ReviewForm for the same employee+cycle
    mgr_form = db.query(ReviewForm).filter(
        ReviewForm.review_cycle_id == form.review_cycle_id,
        ReviewForm.employee_id == form.employee_id,
        ReviewForm.form_type == ReviewFormType.MANAGER_FEEDBACK,
    ).first()

    if mgr_form is None or mgr_form.status != ReviewFormStatus.SUBMITTED:
        raise ValueError("Review is not yet finalised; export is available only after the manager submits")

    # Load related objects
    employee = db.query(User).filter(User.id == form.employee_id).first()
    employee_name = employee.name if employee else "Unknown"

    cycle = form.cycle
    cycle_name = cycle.cycle_name if cycle else "Unknown Cycle"
    cycle_range = f"{cycle.start_date} – {cycle.end_date}" if cycle else ""

    # Manager of record name
    mor_name = "No manager assigned at cycle start"
    if form.manager_of_record_id:
        mor = db.query(User).filter(User.id == form.manager_of_record_id).first()
        mor_name = mor.name if mor else f"User #{form.manager_of_record_id}"

    # Self-assessment content
    self_form = db.query(ReviewForm).filter(
        ReviewForm.review_cycle_id == form.review_cycle_id,
        ReviewForm.employee_id == form.employee_id,
        ReviewForm.form_type == ReviewFormType.SELF_ASSESSMENT,
    ).first()
    self_text = str(self_form.form_data) if self_form and self_form.form_data else "(Not submitted)"

    mgr_comment = str(mgr_form.form_data) if mgr_form.form_data else "(No comment)"
    final_rating = mgr_form.final_rating or "N/A"

    # AI draft fields
    ai_draft = form.ai_draft or {}
    summary = ai_draft.get("summary", "")
    strengths = ai_draft.get("strengths", [])
    growth_areas = ai_draft.get("growth_areas", [])
    citations = form.citations or {}

    html = _build_html(
        employee_name=employee_name,
        cycle_name=cycle_name,
        cycle_range=cycle_range,
        mor_name=mor_name,
        self_text=self_text,
        mgr_comment=mgr_comment,
        final_rating=final_rating,
        summary=summary,
        strengths=strengths,
        growth_areas=growth_areas,
        citations=citations,
    )

    filename = _sanitize_filename(employee_name, cycle_name)
    return html, filename


def _sanitize(s: str) -> str:
    """Replace non-alphanumeric chars with underscores."""
    return re.sub(r"[^a-zA-Z0-9]", "_", s)


def _sanitize_filename(employee_name: str, cycle_name: str) -> str:
    return f"review_{_sanitize(employee_name)}_{_sanitize(cycle_name)}.html"


def _build_html(
    employee_name, cycle_name, cycle_range, mor_name,
    self_text, mgr_comment, final_rating,
    summary, strengths, growth_areas, citations,
) -> str:
    strengths_html = "".join(f"<li>{s}</li>" for s in strengths)
    growth_html = "".join(f"<li>{g}</li>" for g in growth_areas)

    # Build references section
    ref_items = []
    for key, cit_list in citations.items():
        for cit in cit_list:
            ref_items.append(
                f"<li><strong>{cit.get('event_type','')}</strong> — {cit.get('event_date','')}: "
                f"{cit.get('event_title','')}</li>"
            )
    refs_html = "".join(ref_items) if ref_items else "<li>No citations</li>"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Review — {employee_name}</title>
<style>
  body {{ font-family: 'Segoe UI', Arial, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; color: #1a1a2e; background: #f8f9fa; }}
  h1 {{ color: #16213e; border-bottom: 3px solid #0f3460; padding-bottom: 12px; }}
  h2 {{ color: #0f3460; margin-top: 32px; }}
  .meta {{ background: #e8f4fd; border-left: 4px solid #0f3460; padding: 12px 16px; border-radius: 4px; margin-bottom: 24px; }}
  .section {{ background: #fff; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin-bottom: 20px; }}
  .self-assessment {{ background: #f0f7ff; border-left: 4px solid #3b82f6; }}
  .manager-review {{ background: #f0fff4; border-left: 4px solid #10b981; }}
  .rating {{ font-size: 2rem; font-weight: bold; color: #0f3460; }}
  ul {{ padding-left: 20px; }}
  li {{ margin-bottom: 6px; }}
  .refs {{ font-size: 0.85rem; color: #555; }}
  sup {{ color: #0f3460; font-weight: bold; }}
</style>
</head>
<body>
<h1>Performance Review</h1>
<div class="meta">
  <strong>Employee:</strong> {employee_name}<br>
  <strong>Cycle:</strong> {cycle_name} ({cycle_range})<br>
  <strong>Manager of Record:</strong> {mor_name}
</div>

<h2>Employee Self-Assessment</h2>
<div class="section self-assessment">
  <p>{self_text}</p>
</div>

<h2>Manager Review</h2>
<div class="section manager-review">
  <p>{mgr_comment}</p>
  <p><strong>Final Rating:</strong> <span class="rating">{final_rating}</span>/5</p>
</div>

<h2>AI-Generated Draft Summary</h2>
<div class="section">
  <p>{summary}</p>
  <h3>Strengths</h3>
  <ul>{strengths_html}</ul>
  <h3>Growth Areas</h3>
  <ul>{growth_html}</ul>
</div>

<h2>References</h2>
<div class="section refs">
  <ul>{refs_html}</ul>
</div>
</body>
</html>"""
