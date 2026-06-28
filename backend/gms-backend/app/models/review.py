from sqlalchemy import Column, Integer, String, Text, Date, DateTime, Float, ForeignKey, Enum as SQLEnum, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
from app.enums import ReviewCycleType, ReviewCycleStatus, ReviewFormType, ReviewFormStatus


class ReviewCycle(Base):
    __tablename__ = "review_cycles"

    id = Column(Integer, primary_key=True, index=True)
    cycle_name = Column(String, nullable=False)
    cycle_type = Column(SQLEnum(ReviewCycleType), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    self_review_deadline = Column(Date, nullable=False)
    manager_review_deadline = Column(Date, nullable=False)
    status = Column(SQLEnum(ReviewCycleStatus), nullable=False, default=ReviewCycleStatus.PENDING)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    created_by = relationship("User", foreign_keys=[created_by_id])
    forms = relationship("ReviewForm", back_populates="cycle", cascade="all, delete-orphan")


class ReviewForm(Base):
    __tablename__ = "review_forms"

    id = Column(Integer, primary_key=True, index=True)
    review_cycle_id = Column(Integer, ForeignKey("review_cycles.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    manager_of_record_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Snapshotted at cycle activation
    form_type = Column(SQLEnum(ReviewFormType), nullable=False)
    status = Column(SQLEnum(ReviewFormStatus), nullable=False, default=ReviewFormStatus.PENDING)
    form_data = Column(JSON, nullable=True)
    final_rating = Column(Integer, nullable=True)   # 1–5
    submitted_at = Column(DateTime, nullable=True)
    cross_shared_at = Column(DateTime, nullable=True)  # When both forms revealed
    is_flagged = Column(Integer, default=0)  # 0=no flag, 1=soft flag, 2=red flag
    flag_reason = Column(Text, nullable=True)  # Why flagged
    flag_reviewed_at = Column(DateTime, nullable=True)
    flag_reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    ai_draft = Column(JSON, nullable=True)   # AI-generated draft payload
    citations = Column(JSON, nullable=True)  # Persisted citations map
    created_at = Column(DateTime, default=datetime.utcnow)

    cycle = relationship("ReviewCycle", back_populates="forms")
    employee = relationship("User", foreign_keys=[employee_id])
    manager = relationship("User", foreign_keys=[manager_id])
    manager_of_record = relationship("User", foreign_keys=[manager_of_record_id])
    flag_reviewer = relationship("User", foreign_keys=[flag_reviewed_by])


class ReviewPerformanceHistory(Base):
    __tablename__ = "review_performance_history"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    review_cycle_id = Column(Integer, ForeignKey("review_cycles.id"), nullable=False)
    performance_score = Column(Float, nullable=True)
    rating = Column(String, nullable=True)
    feedback_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship("User", foreign_keys=[employee_id])
    cycle = relationship("ReviewCycle", foreign_keys=[review_cycle_id])
