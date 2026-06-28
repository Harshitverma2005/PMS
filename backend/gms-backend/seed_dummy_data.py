"""
Run: python seed_dummy_data.py
Creates realistic mock data for goals, achievements, kudos, and review cycles.
"""
import sys
import os
import random
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal, engine, Base
from app.models.user import User
from app.models.team import Team
from app.models.goal import Goal
from app.models.goal_history import GoalStatusHistory
from app.models.achievement import Achievement
from app.models.kudos import Kudos
from app.models.review import ReviewCycle, ReviewForm
from app.models.timeline import TimelineEvent
from app.models.subtask import Subtask
from app.models.progress import Progress
from app.models.feedback import Feedback
from app.models.score import Score
from app.enums import (
    UserRole, GoalStatus, GoalPriority, GoalTag, GoalLevel, 
    AchievementCategory, TimelineEventType, ReviewCycleType, ReviewCycleStatus, ReviewFormStatus, ReviewFormType
)

db = SessionLocal()

def generate_data():
    users = db.query(User).all()
    if not users:
        print("Please run seed.py first to create users.")
        return

    admin = next(u for u in users if u.role == UserRole.ADMIN)
    manager = next(u for u in users if u.role == UserRole.MANAGER)
    members = [u for u in users if u.role == UserRole.MEMBER]

    print("Generating Goals...")
    # Company Goal
    company_goal = Goal(
        title="Increase Annual Recurring Revenue by 25%",
        description="Expand enterprise client base and upsell existing accounts.",
        category="Financial",
        tag=GoalTag.YEARLY,
        priority=GoalPriority.CRITICAL,
        level=GoalLevel.COMPANY,
        weightage=40,
        status=GoalStatus.ACTIVE,
        completion_percentage=65.0,
        start_date=datetime.utcnow().date() - timedelta(days=120),
        due_date=datetime.utcnow().date() + timedelta(days=245),
        creator_id=admin.id,
        assignee_id=admin.id,
    )
    db.add(company_goal)
    db.flush()

    # Team Goals
    team_goal = Goal(
        title="Launch UPMS Pro Features v1",
        description="Ship the new performance management suite to production.",
        category="Engineering",
        tag=GoalTag.QUARTERLY,
        priority=GoalPriority.HIGH,
        level=GoalLevel.TEAM,
        weightage=30,
        status=GoalStatus.ACTIVE,
        completion_percentage=80.0,
        start_date=datetime.utcnow().date() - timedelta(days=60),
        due_date=datetime.utcnow().date() + timedelta(days=30),
        creator_id=manager.id,
        assignee_id=manager.id,
        team_id=manager.team_id,
        parent_id=company_goal.id
    )
    db.add(team_goal)
    db.flush()

    # Individual Goals
    for idx, member in enumerate(members):
        g1 = Goal(
            title=f"Complete Backend Refactoring for Module {idx+1}",
            description="Migrate legacy endpoints to the new architecture.",
            category="Technical",
            tag=GoalTag.MONTHLY,
            priority=GoalPriority.MEDIUM,
            level=GoalLevel.INDIVIDUAL,
            weightage=20,
            status=GoalStatus.ACTIVE,
            completion_percentage=random.choice([25.0, 50.0, 75.0]),
            start_date=datetime.utcnow().date() - timedelta(days=30),
            due_date=datetime.utcnow().date() + timedelta(days=60),
            creator_id=member.id,
            assignee_id=member.id,
            parent_id=team_goal.id
        )
        g2 = Goal(
            title=f"Earn AWS Certification",
            description="Complete the AWS Solutions Architect exam.",
            category="Growth",
            tag=GoalTag.YEARLY,
            priority=GoalPriority.LOW,
            level=GoalLevel.INDIVIDUAL,
            weightage=10,
            status=GoalStatus.COMPLETED,
            completion_percentage=100.0,
            start_date=datetime.utcnow().date() - timedelta(days=90),
            due_date=datetime.utcnow().date() - timedelta(days=10),
            creator_id=member.id,
            assignee_id=member.id,
        )
        db.add_all([g1, g2])
    
    print("Generating Achievements & Kudos...")
    for member in members:
        a = Achievement(
            employee_id=member.id,
            title="Q3 Top Contributor",
            description="Recognized for exceptional delivery velocity.",
            category=AchievementCategory.TECHNICAL_IMPACT,
            evidence_url="https://example.com/certificate"
        )
        db.add(a)

        k = Kudos(
            sender_id=manager.id,
            recipient_id=member.id,
            message=f"Huge thanks for jumping in to fix that production bug on Saturday! Really appreciate your dedication."
        )
        db.add(k)

    print("Generating Review Cycle...")
    cycle = ReviewCycle(
        cycle_name="H1 2024 Performance Review",
        cycle_type=ReviewCycleType.BI_ANNUAL,
        start_date=datetime.utcnow().date() - timedelta(days=15),
        end_date=datetime.utcnow().date() + timedelta(days=45),
        self_review_deadline=datetime.utcnow().date() + timedelta(days=7),
        manager_review_deadline=datetime.utcnow().date() + timedelta(days=21),
        status=ReviewCycleStatus.ACTIVE,
        created_by_id=admin.id
    )
    db.add(cycle)
    db.flush()

    for member in members:
        f = ReviewForm(
            review_cycle_id=cycle.id,
            employee_id=member.id,
            manager_id=manager.id,
            manager_of_record_id=manager.id,
            form_type=ReviewFormType.SELF_ASSESSMENT,
            status=ReviewFormStatus.IN_PROGRESS,
            form_data={
                "achievements": "Delivered 3 major features.",
                "challenges": "Faced technical debt in the legacy codebase.",
                "support_needed": "More pair programming sessions.",
                "goals_for_next_cycle": "Learn Kubernetes."
            }
        )
        db.add(f)
        
        # Trigger Timeline Events
        t = TimelineEvent(
            employee_id=member.id,
            event_type=TimelineEventType.GOAL_CREATED,
            title="Assigned to Review Cycle",
            summary="Assigned to new performance review cycle.",
            source_id=cycle.id
        )
        db.add(t)

    db.commit()
    print("✅ Realistic Dummy Data Successfully Injected!")

try:
    generate_data()
except Exception as e:
    print(f"Error seeding data: {e}")
finally:
    db.close()
