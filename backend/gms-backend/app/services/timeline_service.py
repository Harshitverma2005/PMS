"""
Timeline service — emit and query Performance_Timeline events.
"""

from datetime import date, datetime
from typing import Optional, List

from sqlalchemy.orm import Session

from app.enums import TimelineEventType, GoalStatus
from app.models.timeline import TimelineEvent
from app.schemas.timeline import TimelineResponse, TimelineEventResponse


# ---------------------------------------------------------------------------
# Emit
# ---------------------------------------------------------------------------

def emit(
    db: Session,
    employee_id: int,
    event_type: TimelineEventType,
    title: str,
    summary: Optional[str] = None,
    source_id: Optional[int] = None,
) -> TimelineEvent:
    """Insert a single TimelineEvent row for *employee_id*."""
    event = TimelineEvent(
        employee_id=employee_id,
        event_type=event_type,
        timestamp=datetime.utcnow(),
        title=title,
        summary=summary,
        source_id=source_id,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


# ---------------------------------------------------------------------------
# Query — paginated list
# ---------------------------------------------------------------------------

def get_timeline(
    db: Session,
    employee_id: int,
    type_filter: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    page: int = 1,
    page_size: int = 50,
) -> TimelineResponse:
    """Return a paginated, filtered list of timeline events for *employee_id*."""
    q = db.query(TimelineEvent).filter(TimelineEvent.employee_id == employee_id)

    if type_filter:
        q = q.filter(TimelineEvent.event_type == type_filter)
    if start_date:
        q = q.filter(TimelineEvent.timestamp >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        q = q.filter(TimelineEvent.timestamp <= datetime.combine(end_date, datetime.max.time()))

    total_count = q.count()
    events = (
        q.order_by(TimelineEvent.timestamp.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return TimelineResponse(
        total_count=total_count,
        page=page,
        page_size=page_size,
        events=[TimelineEventResponse.model_validate(e) for e in events],
    )


def get_all_events_for_export(
    db: Session,
    employee_id: int,
    type_filter: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> List[TimelineEvent]:
    """Return all events (no pagination) for CSV export."""
    q = db.query(TimelineEvent).filter(TimelineEvent.employee_id == employee_id)
    if type_filter:
        q = q.filter(TimelineEvent.event_type == type_filter)
    if start_date:
        q = q.filter(TimelineEvent.timestamp >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        q = q.filter(TimelineEvent.timestamp <= datetime.combine(end_date, datetime.max.time()))
    return q.order_by(TimelineEvent.timestamp.desc()).all()


# ---------------------------------------------------------------------------
# Work-trail — used by AI draft service
# ---------------------------------------------------------------------------

def get_work_trail(db: Session, employee_id: int, cycle) -> dict:
    """
    Return the complete work trail for *employee_id* within the cycle's date range.
    When *cycle* is None, return lifetime data.
    """
    from app.models.goal import Goal
    from app.models.achievement import Achievement
    from app.models.kudos import Kudos
    from app.models.feedback import Feedback
    from app.models.progress import Progress

    start = cycle.start_date if cycle else None
    end = cycle.end_date if cycle else None

    # Goals
    gq = db.query(Goal).filter(Goal.assignee_id == employee_id)
    if start:
        gq = gq.filter(Goal.created_at >= datetime.combine(start, datetime.min.time()))
    if end:
        gq = gq.filter(Goal.created_at <= datetime.combine(end, datetime.max.time()))
    goals = gq.all()

    # Progress updates (via goal)
    progress_list = []
    goal_ids = [g.id for g in goals]
    if goal_ids:
        pq = db.query(Progress).filter(Progress.goal_id.in_(goal_ids))
        if start:
            pq = pq.filter(Progress.created_at >= datetime.combine(start, datetime.min.time()))
        if end:
            pq = pq.filter(Progress.created_at <= datetime.combine(end, datetime.max.time()))
        progress_list = pq.all()

    # Feedback received
    fq = db.query(Feedback).filter(Feedback.goal_id.in_(goal_ids))
    if start:
        fq = fq.filter(Feedback.created_at >= datetime.combine(start, datetime.min.time()))
    if end:
        fq = fq.filter(Feedback.created_at <= datetime.combine(end, datetime.max.time()))
    feedback = fq.all() if goal_ids else []

    # Achievements
    aq = db.query(Achievement).filter(Achievement.employee_id == employee_id)
    if start:
        aq = aq.filter(Achievement.created_at >= datetime.combine(start, datetime.min.time()))
    if end:
        aq = aq.filter(Achievement.created_at <= datetime.combine(end, datetime.max.time()))
    achievements = aq.all()

    # Kudos received
    kq = db.query(Kudos).filter(Kudos.recipient_id == employee_id)
    if start:
        kq = kq.filter(Kudos.created_at >= datetime.combine(start, datetime.min.time()))
    if end:
        kq = kq.filter(Kudos.created_at <= datetime.combine(end, datetime.max.time()))
    kudos = kq.all()

    return {
        "goals": goals,
        "progress": progress_list,
        "feedback": feedback,
        "achievements": achievements,
        "kudos": kudos,
    }


# ---------------------------------------------------------------------------
# Stubs for future features (e.g. check-ins)
# ---------------------------------------------------------------------------

def stub_emit_checkin_submitted(db: Session, employee_id: int, checkin_id: int):
    """
    To be wired when the Check-ins / 1:1s feature lands.
    Should call emit(db, employee_id, TimelineEventType.CHECKIN_SUBMITTED, ...)
    """
    pass

