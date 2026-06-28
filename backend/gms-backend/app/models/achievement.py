from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base
from app.enums import AchievementCategory


class Achievement(Base):
    __tablename__ = "achievements"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(SQLEnum(AchievementCategory), nullable=False)
    evidence_url = Column(String(2048), nullable=True)
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    employee = relationship("User", foreign_keys=[employee_id])
    goal = relationship("Goal", foreign_keys=[goal_id])
