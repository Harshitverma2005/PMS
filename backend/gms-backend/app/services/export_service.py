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

    # Check access: the employee, the manager of record, the employee's current
    # direct manager, or an admin may generate the individual report.
    from app.enums import UserRole
    from app.services.hierarchy_service import is_direct_manager
    requester = db.query(User).filter(User.id == requesting_user_id).first()
    is_admin = requester is not None and requester.role == UserRole.ADMIN
    allowed = (
        is_admin
        or form.employee_id == requesting_user_id
        or form.manager_of_record_id == requesting_user_id
        or is_direct_manager(db, requesting_user_id, form.employee_id)
    )
    if not allowed:
        raise PermissionError("Access denied — you are not authorized to export this review")

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

    workload = _compute_workload(db, form.employee_id)

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
        workload=workload,
    )

    filename = _sanitize_filename(employee_name, cycle_name)
    return html, filename


def render_upward(db: Session, cycle_id: int, manager_id: int, requesting_user_id: int) -> Tuple[str, str]:
    """Admin-only: render all upward feedback ABOUT a manager for a cycle as one HTML file."""
    from app.enums import UserRole
    from app.models.review import ReviewCycle

    requester = db.query(User).filter(User.id == requesting_user_id).first()
    if requester is None or requester.role != UserRole.ADMIN:
        raise PermissionError("Only administrators can export upward feedback")

    manager = db.query(User).filter(User.id == manager_id).first()
    if manager is None:
        raise LookupError("Manager not found")
    cycle = db.query(ReviewCycle).filter(ReviewCycle.id == cycle_id).first()
    cycle_name = cycle.cycle_name if cycle else f"Cycle #{cycle_id}"

    forms = db.query(ReviewForm).filter(
        ReviewForm.review_cycle_id == cycle_id,
        ReviewForm.manager_id == manager_id,
        ReviewForm.form_type == ReviewFormType.UPWARD_FEEDBACK,
    ).all()

    rows = []
    ratings = []
    for f in forms:
        rater = db.query(User).filter(User.id == f.employee_id).first()
        fd = f.form_data if isinstance(f.form_data, dict) else {}
        comment = fd.get("comment") or fd.get("comments") or fd.get("summary") or ""
        submitted = f.status == ReviewFormStatus.SUBMITTED
        if submitted and f.final_rating:
            ratings.append(f.final_rating)
        rows.append({
            "rater": rater.name if rater else f"Employee #{f.employee_id}",
            "rating": f.final_rating if submitted else None,
            "comment": comment if submitted else "",
            "submitted": submitted,
        })

    avg = round(sum(ratings) / len(ratings), 1) if ratings else None
    html = _build_upward_html(manager.name, cycle_name, rows, avg, len(ratings), len(rows))
    filename = f"upward_feedback_{_sanitize(manager.name)}_{_sanitize(cycle_name)}.html"
    return html, filename


def _esc(s) -> str:
    """Minimal HTML escaping for free-text fields."""
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def _build_upward_html(manager_name, cycle_name, rows, avg, submitted_count, total_count) -> str:
    cards = []
    for r in rows:
        if r["submitted"]:
            badge = f'<span class="rating">{r["rating"]}/5</span>'
            body = f'<p>{_esc(r["comment"]) or "<em>No comment provided.</em>"}</p>'
        else:
            badge = '<span class="pending">Not submitted</span>'
            body = '<p><em>This employee has not submitted their feedback yet.</em></p>'
        cards.append(
            f'<div class="card"><div class="cardhead"><strong>{_esc(r["rater"])}</strong>{badge}</div>{body}</div>'
        )
    cards_html = "".join(cards) if cards else "<p>No upward feedback for this manager.</p>"
    avg_html = f"{avg}/5" if avg is not None else "—"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Upward Feedback — {_esc(manager_name)}</title>
<style>
  body {{ font-family: 'Segoe UI', Arial, sans-serif; max-width: 820px; margin: 40px auto; padding: 0 20px; color: #1a1a2e; background: #f8f9fa; }}
  h1 {{ color: #4c1d95; border-bottom: 3px solid #7C3AED; padding-bottom: 12px; }}
  .meta {{ color: #555; margin-bottom: 8px; }}
  .summary {{ background: #f3e8ff; border: 1px solid #d8b4fe; border-radius: 10px; padding: 16px 20px; margin: 20px 0; }}
  .summary .big {{ font-size: 28px; font-weight: 800; color: #6d28d9; }}
  .note {{ font-size: 12px; color: #6b7280; margin-bottom: 24px; }}
  .card {{ background: #fff; border: 1px solid #e4e2dc; border-radius: 12px; padding: 16px 20px; margin-bottom: 12px; }}
  .cardhead {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }}
  .rating {{ font-weight: 800; color: #6d28d9; }}
  .pending {{ font-size: 12px; font-weight: 700; color: #d97706; text-transform: uppercase; }}
  p {{ line-height: 1.6; margin: 4px 0; color: #374151; }}
</style>
</head>
<body>
  <h1>Upward Feedback — {_esc(manager_name)}</h1>
  <div class="meta">Review cycle: <strong>{_esc(cycle_name)}</strong></div>
  <div class="summary">
    <div>Average rating from team</div>
    <div class="big">{avg_html}</div>
    <div>{submitted_count} of {total_count} report(s) submitted</div>
  </div>
  <div class="note">Confidential — compiled for administrators. Identifies each rater. The manager does not have access to this report.</div>
  {cards_html}
</body>
</html>"""


def _sanitize(s: str) -> str:
    """Replace non-alphanumeric chars with underscores."""
    return re.sub(r"[^a-zA-Z0-9]", "_", s)


def _sanitize_filename(employee_name: str, cycle_name: str) -> str:
    return f"review_{_sanitize(employee_name)}_{_sanitize(cycle_name)}.html"


def _compute_workload(db: Session, employee_id: int) -> dict:
    """Replicate the frontend workload metric: sum of active-goal weightage plus a
    small per-goal concurrency penalty, bucketed into a status band."""
    from app.models.goal import Goal
    from app.enums import GoalStatus

    active = db.query(Goal).filter(
        Goal.assignee_id == employee_id,
        Goal.status == GoalStatus.ACTIVE,
    ).all()
    load = sum((g.weightage or 0) for g in active) + len(active) * 5
    status = "Healthy"
    if load > 40:
        status = "Busy"
    if load > 70:
        status = "High Load"
    if load > 100:
        status = "Overloaded"
    return {
        "load": round(load),
        "status": status,
        "count": len(active),
        "goals": [{"title": g.title, "weightage": g.weightage or 0,
                   "completion": g.completion_percentage or 0,
                   "at_risk": bool(g.is_at_risk)} for g in active],
    }


def _build_html(
    employee_name, cycle_name, cycle_range, mor_name,
    self_text, mgr_comment, final_rating,
    summary, strengths, growth_areas, citations, workload,
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

    # Workload section
    wl = workload or {}
    wl_status = wl.get("status", "Healthy")
    wl_colors = {"Healthy": "#10b981", "Busy": "#d97706", "High Load": "#ea580c", "Overloaded": "#dc2626"}
    wl_color = wl_colors.get(wl_status, "#10b981")
    wl_rows = "".join(
        f"<tr><td>{_esc(g.get('title',''))}</td><td>{g.get('weightage',0)}</td>"
        f"<td>{g.get('completion',0)}%</td><td>{'⚠ At risk' if g.get('at_risk') else '—'}</td></tr>"
        for g in wl.get("goals", [])
    ) or "<tr><td colspan='4'>No active goals.</td></tr>"

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
  .wl-badge {{ display: inline-block; padding: 4px 12px; border-radius: 999px; color: #fff; font-weight: 700; font-size: 0.85rem; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 12px; }}
  th, td {{ text-align: left; padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 0.9rem; }}
  th {{ color: #555; text-transform: uppercase; font-size: 0.72rem; letter-spacing: 0.04em; }}
</style>
</head>
<body>
<h1>Performance Review</h1>
<div class="meta">
  <strong>Employee:</strong> {employee_name}<br>
  <strong>Cycle:</strong> {cycle_name} ({cycle_range})<br>
  <strong>Manager of Record:</strong> {mor_name}
</div>

<h2>Workload</h2>
<div class="section">
  <p>
    <span class="wl-badge" style="background:{wl_color}">{wl_status}</span>
    &nbsp; Load score: <strong>{wl.get('load', 0)}</strong> &nbsp;·&nbsp; {wl.get('count', 0)} active goal(s)
  </p>
  <table>
    <tr><th>Active Goal</th><th>Weightage</th><th>Completion</th><th>Risk</th></tr>
    {wl_rows}
  </table>
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
