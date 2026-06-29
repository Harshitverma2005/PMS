from enum import Enum

class GoalStatus(str, Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    ACTIVE = "active"
    COMPLETED = "completed"
    AWAITING_FEEDBACK = "awaiting_feedback"
    SCORABLE = "scorable"
    SCORED = "scored"
    REJECTED = "rejected"
    ARCHIVED = "archived"

class UserRole(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    MEMBER = "member"

class GoalLevel(str, Enum):
    COMPANY = "company"
    TEAM = "team"
    INDIVIDUAL = "individual"

class GoalTag(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"

class GoalPriority(str, Enum):
    CRITICAL = "critical"    # 40% weightage
    HIGH = "high"            # 30% weightage
    MEDIUM = "medium"        # 20% weightage
    LOW = "low"              # 10% weightage

class FeedbackType(str, Enum):
    MEMBER = "member"
    EVALUATOR = "evaluator"

class PerformanceRating(str, Enum):
    BELOW_EXPECTATIONS = "below_expectations"
    MEETS_EXPECTATIONS = "meets_expectations"
    ABOVE_EXPECTATIONS = "above_expectations"

class ProbationStatus(str, Enum):
    IN_PROBATION = "in_probation"
    COMPLETED = "completed"
    REJECTED = "rejected"
    PAUSED = "paused"

class ProbationTriggerStatus(str, Enum):
    TRIGGERED = "triggered"
    SUBMITTED = "submitted"
    ESCALATED = "escalated"
    BLOCKED = "blocked"  # No manager assigned

class ProbationFeedbackType(str, Enum):
    SELF = "self"
    MANAGER = "manager"

class ReviewCycleType(str, Enum):
    QUARTERLY = "quarterly"
    BI_ANNUAL = "bi_annual"

class ReviewCycleStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    CLOSED = "closed"

class ReviewFormType(str, Enum):
    SELF_ASSESSMENT = "self_assessment"
    MANAGER_FEEDBACK = "manager_feedback"
    UPWARD_FEEDBACK = "upward_feedback"  # employee rates their manager (admin-only visibility)

class ReviewFormStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    WAIVED = "waived"

class TimelineEventType(str, Enum):
    GOAL_CREATED        = "goal_created"
    GOAL_APPROVED       = "goal_approved"
    GOAL_COMPLETED      = "goal_completed"
    GOAL_ARCHIVED       = "goal_archived"
    PROGRESS_UPDATED    = "progress_updated"
    FEEDBACK_SUBMITTED  = "feedback_submitted"
    ACHIEVEMENT_LOGGED  = "achievement_logged"
    KUDOS_RECEIVED      = "kudos_received"
    CHECKIN_SUBMITTED   = "checkin_submitted"
    GOAL_STATUS_CHANGED = "goal_status_changed"

class AchievementCategory(str, Enum):
    TECHNICAL_IMPACT = "technical_impact"
    COST_SAVINGS     = "cost_savings"
    DELIVERY         = "delivery"
    LEADERSHIP       = "leadership"
    COLLABORATION    = "collaboration"
