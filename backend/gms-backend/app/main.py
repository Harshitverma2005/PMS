from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import ALL models so SQLAlchemy creates all tables
from app.models import user, team, goal, subtask, progress, feedback, score
from app.models import probation, review, notification
from app.models import timeline, achievement, kudos, goal_history

from app.routers import users, teams, goals, weightage, auth
from app.routers import probation as probation_router
from app.routers import reviews as reviews_router
from app.routers import notifications as notifications_router
from app.routers import dashboard as dashboard_router
from app.routers import admin as admin_router
from app.routers import admin_flags as admin_flags_router
from app.routers import timeline as timeline_router
from app.routers import achievements as achievements_router
from app.routers import kudos as kudos_router
from app.routers import readiness as readiness_router
from app.routers import goal_history as goal_history_router
from app.routers import ai_draft as ai_draft_router
from app.routers import export as export_router
from app.routers import chat as chat_router

app = FastAPI(title="PMS — Performance & Goal Management Platform", version="2.0.0")

@app.middleware("http")
async def log_requests(request, call_next):
    print(f"[DEBUG] {request.method} {request.url.path}")
    return await call_next(request)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# ── Existing routes ────────────────────────────────────────────────────────
app.include_router(auth.router,      prefix="/api/v1/auth",      tags=["auth"])
app.include_router(teams.router,     prefix="/api/v1/teams",     tags=["teams"])
app.include_router(users.router,     prefix="/api/v1/users",     tags=["users"])
app.include_router(goals.router,     prefix="/api/v1/goals",     tags=["goals"])
app.include_router(weightage.router, prefix="/api/v1",           tags=["weightage"])

# ── New PMS routes ─────────────────────────────────────────────────────────
app.include_router(probation_router.router,     prefix="/api/v1/probation",      tags=["probation"])
app.include_router(reviews_router.router,       prefix="/api/v1",                tags=["reviews"])
app.include_router(notifications_router.router, prefix="/api/v1/notifications",  tags=["notifications"])
app.include_router(dashboard_router.router,     prefix="/api/v1/dashboard",      tags=["dashboard"])
app.include_router(admin_router.router,         prefix="/api/v1/admin",          tags=["admin"])
app.include_router(admin_flags_router.router,   prefix="/api/v1/admin",          tags=["admin-flags"])

# ── Pro feature routes ────────────────────────────────────────────────────
app.include_router(timeline_router.router,      prefix="/api/v1/timeline",       tags=["timeline"])
app.include_router(achievements_router.router,  prefix="/api/v1/achievements",   tags=["achievements"])
app.include_router(kudos_router.router,         prefix="/api/v1/kudos",          tags=["kudos"])
app.include_router(readiness_router.router,     prefix="/api/v1/readiness",      tags=["readiness"])
app.include_router(goal_history_router.router,  prefix="/api/v1/goals",          tags=["goal-history"])
app.include_router(ai_draft_router.router,      prefix="/api/v1/reviews",        tags=["ai-draft"])
app.include_router(export_router.router,        prefix="/api/v1/reviews",        tags=["export"])
app.include_router(chat_router.router,          prefix="/api/v1")


@app.on_event("startup")
def startup():
    from app.database import Base, engine
    from app.scheduler import start_scheduler

    Base.metadata.create_all(bind=engine)
    try:
        start_scheduler()
    except Exception as e:
        print(f"[SCHEDULER] Failed to start: {e}")


@app.on_event("shutdown")
def shutdown():
    from app.scheduler import stop_scheduler
    stop_scheduler()


@app.get("/health")
def health():
    return {"status": "healthy", "version": "2.0.0"}
