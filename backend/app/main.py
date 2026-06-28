from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.db.database import create_tables, SessionLocal
from app.db.seed import seed
from app.routers import auth, users, goals, probation, cycles, feedback, admin, notifications, chat


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    create_tables()
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()
    yield
    # Shutdown (nothing to clean up for SQLite)


app = FastAPI(
    title="PMS — Performance & Goal Management Platform",
    description="Unified API for probation tracking, performance reviews, and goal management.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(goals.router, prefix="/api")
app.include_router(probation.router, prefix="/api")
app.include_router(cycles.router, prefix="/api")
app.include_router(feedback.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(chat.router, prefix="/api")


@app.get("/")
def root():
    return {"message": "PMS API is running 🚀", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
