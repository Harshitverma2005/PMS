from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum as SQLEnum, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
from app.enums import TimelineEventType


class TimelineEvent(Base):
    __tablename__ = "timeline_events"

    id          = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    event_type  = Column(SQLEnum(TimelineEventType), nullable=False)
    timestamp   = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    title       = Column(String(500), nullable=False)
    summary     = Column(Text, nullable=True)
    source_id   = Column(Integer, nullable=True)  # FK to the originating record (polymorphic)

    # Composite indexes for efficient timeline queries
    __table_args__ = (
        Index("ix_timeline_events_employee_timestamp", "employee_id", "timestamp"),
        Index("ix_timeline_events_employee_event_type", "employee_id", "event_type"),
    )

    # Relationships
    employee = relationship("User", foreign_keys=[employee_id])
