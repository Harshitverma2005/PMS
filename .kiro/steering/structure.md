# Project Structure

```
PMS/
├── docker-compose.yml          # Orchestrates postgres, backend, frontend
├── frontend/                   # React SPA
└── backend/
    └── gms-backend/            # Active backend (FastAPI) — use this, not backend/app/
```

> **Note**: `backend/app/` is an older, incomplete backend. All active development is in `backend/gms-backend/`.

---

## Backend: `backend/gms-backend/`

```
app/
├── main.py             # FastAPI app, router registration, startup/shutdown hooks
├── config.py           # Settings via pydantic-settings (reads .env)
├── database.py         # SQLAlchemy engine, SessionLocal, Base, get_db()
├── dependencies.py     # get_current_user() FastAPI dependency
├── permissions.py      # Role enforcement helpers (require_manager_or_admin, etc.)
├── jwt.py              # Token creation and verification
├── auth.py             # Auth utilities
├── enums.py            # All shared Enums (GoalStatus, UserRole, GoalPriority, etc.)
├── scheduler.py        # APScheduler jobs (review cycle automation)
│
├── models/             # SQLAlchemy ORM models (one file per domain entity)
│   ├── user.py, team.py, goal.py, subtask.py
│   ├── feedback.py, score.py, progress.py
│   ├── probation.py, review.py, notification.py
│
├── schemas/            # Pydantic v2 request/response schemas (mirrors models/)
│   ├── goal.py, user.py, team.py, feedback.py
│   ├── probation.py, review.py, score.py, notification.py, auth.py
│
├── repositories/       # Data access layer — thin wrappers around SQLAlchemy queries
│   ├── base.py         # Generic CRUD base repository
│   ├── goal.py, user.py, team.py
│
├── services/           # Business logic layer — called by routers
│   ├── goal.py, feedback.py, score.py
│   ├── user.py, team.py
│   ├── probation_service.py, review_service.py
│   ├── notification_service.py, red_flag_engine.py
│
├── routers/            # FastAPI route handlers (one file per domain)
│   ├── auth.py, users.py, teams.py, goals.py
│   ├── probation.py, reviews.py, notifications.py
│   ├── dashboard.py, admin.py, admin_flags.py, weightage.py
│
└── utils/
    └── email.py        # Email sending (SMTP / Resend / stub)

alembic/                # DB migration scripts
alembic.ini
requirements.txt
seed.py                 # Dev seed data
```

### Backend Layering Rules

- **Routers** handle HTTP concerns only — parse request, call service, return response
- **Services** contain all business logic — never call routers, may call repositories or other services
- **Repositories** handle raw DB queries — no business logic
- **Enums** (`enums.py`) are the single source of truth for all status/type values — never use raw strings
- **Permissions** are enforced via `permissions.py` helpers or inline role checks on `current_user.role`
- All routes require `get_current_user` dependency unless explicitly public
- API prefix: `/api/v1/<domain>`

---

## Frontend: `frontend/src/`

```
src/
├── main.jsx            # React entry point
├── App.jsx             # Router setup, route definitions, auth guard wiring
├── index.css           # Global styles
│
├── api/
│   ├── apiClient.js    # Axios instance with base URL, auth interceptor, 401 redirect
│   ├── apiEndpoints.js # Centralized URL constants
│   ├── index.js        # Re-exports all API modules
│   └── *.js            # One file per domain (goal.js, user.js, team.js, etc.)
│
├── store/
│   └── auth.js         # Zustand auth store (token, user, setAuth, logout, isAdmin, isManager)
│
├── components/
│   ├── Layout.jsx      # App shell (sidebar, nav)
│   └── ProtectedRoute.jsx  # Auth + role guard wrapper
│
└── pages/              # One file per route/view
    ├── Dashboard.jsx, Goals.jsx, CreateGoal.jsx, GoalDetail.jsx
    ├── Users.jsx, Teams.jsx, Cycles.jsx
    ├── PerformanceReview.jsx, FeedbackForm.jsx
    ├── Probation.jsx, ProbationDetail.jsx
    ├── Reports.jsx, Notifications.jsx, FeedbackFlags.jsx, Login.jsx
```

### Frontend Conventions

- All API calls go through `apiClient.js` — never use raw `fetch` or a separate axios instance
- Auth token is stored in `localStorage` and read by the Axios request interceptor automatically
- Role checks use `useAuthStore` helpers: `isAdmin()`, `isManager()`
- Route-level access control via `<ProtectedRoute requireAdmin>` prop
- UI components come from shadcn/ui — add new components via `npx shadcn add <component>`
- Toast notifications via `react-hot-toast` (`toast.success`, `toast.error`)
- Pages are flat under `src/pages/` — no nested page directories
