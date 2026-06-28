from sqlalchemy import Column, Integer, Text, ForeignKey, Enum as SQLEnum, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base
from app.enums import GoalStatus


class GoalStatusHistory(Base):
    __tablename__ = "goal_status_history"

    id = Column(Integer, primary_key=True, index=True)
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=False, index=True)
    from_status = Column(SQLEnum(GoalStatus), nullable=True)   # null for initial creation
    to_status = Column(SQLEnum(GoalStatus), nullable=False)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    comment = Column(Text, nullable=True)

    goal = relationship("Goal", foreign_keys=[goal_id])
    actor = relationship("User", foreign_keys=[actor_id])
