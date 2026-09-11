# PMS

## Performance, goals, and growth in one place

PMS is a modern performance management platform for teams that want more than a once-a-year review. It connects goals, progress, feedback, reviews, recognition, readiness, and the context behind every decision in one focused workspace.

The platform is built around a simple idea:

> Great performance conversations are continuous, evidence-based, and human.

PMS gives members a clear view of what matters, gives managers the signals they need to coach well, and gives organizations a reliable record of how work evolves over time.

## What it does

### Goals that move forward

- Create and manage goals with priority, weightage, tags, dates, and progress.
- Use a guided workflow from draft to approval, active tracking, completion, feedback, and scoring.
- Break goals into subtasks and calculate progress from completed work.
- Detect at-risk goals when elapsed time and completion diverge.
- Preserve status transitions in goal history.

### Reviews with context

- Collect member self-feedback and evaluator feedback.
- Score performance across structured rating categories.
- Build review drafts with optional AI assistance.
- Export review information for reporting and follow-up.
- Surface feedback flags for administrator attention.

### A richer view of contribution

- Personal and team dashboards with performance signals.
- Timeline and work-trail views for a durable record of activity.
- Achievements and kudos for recognizing meaningful contributions.
- Readiness views for development and progression conversations.
- Probation tracking and review milestones.
- Notifications and scheduled reminders.
- Workload intelligence and organization-level administration.

## Product flow

```text
Set goals -> Approve -> Track progress -> Complete
	 |                                      |
	 +-> Timeline and history               +-> Feedback -> Score -> Review
																  |
											 Recognition, readiness, and growth signals
```

## Architecture

```text
								 +-----------------------+
								 | React + Vite frontend |
								 | localhost:3001        |
								 +-----------+-----------+
												 |
											 /api proxy
												 |
								 +-----------v-----------+
								 | FastAPI backend       |
								 | localhost:8000        |
								 +-----------+-----------+
												 |
								 +-----------v-----------+
								 | PostgreSQL / SQLite   |
								 +-----------------------+
```

### Technology

| Layer | Tools |
| --- | --- |
| Frontend | React 18, Vite, React Router, Zustand, Tailwind CSS, Lucide React |
| API | FastAPI, Uvicorn, Pydantic |
| Persistence | SQLAlchemy, PostgreSQL, SQLite for lightweight local runs |
| Security | JWT authentication, role-based access control, hierarchy-aware authorization |
| Operations | Docker Compose, APScheduler, OpenAPI documentation |
| Integrations | SMTP email, Resend, optional OpenAI-compatible AI provider |

## Repository map

```text
PMS/
├── backend/
│   └── gms-backend/
│       ├── app/
│       │   ├── routers/       # HTTP API boundaries
│       │   ├── services/      # Business rules and orchestration
│       │   ├── repositories/  # Data access
│       │   ├── models/        # SQLAlchemy entities
│       │   ├── schemas/       # Request and response contracts
│       │   └── main.py        # FastAPI application and route registration
│       └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/             # Product screens
│   │   ├── components/        # Shared UI and layout
│   │   ├── api/               # API clients
│   │   └── store/              # Client state
│   └── package.json
├── docker-compose.yml
└── README.md
```

## Run locally

### Prerequisites

- Python 3.10+
- Node.js 18+ and npm
- PostgreSQL 14+ for a durable local database, or SQLite for a quick start

### 1. Start the API

```bash
cd backend/gms-backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# SQLite is the quickest local option.
export DATABASE_URL="sqlite:///./pms.db"
export SECRET_KEY="replace-this-with-a-long-random-secret"

uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The API is available at:

- Application: http://localhost:8000
- Health check: http://localhost:8000/health
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 2. Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3001. The Vite proxy forwards `/api` requests to `http://127.0.0.1:8000` by default. To point the frontend at another API:

```bash
API_TARGET=http://localhost:8000 npm run dev
```

### 3. Start the complete Docker stack

```bash
docker compose up --build
```

The Compose stack includes PostgreSQL, the API, and the frontend. Its default host ports are:

- Frontend: http://localhost:3001
- API: http://localhost:8003
- PostgreSQL: `localhost:5435`

Stop the stack with:

```bash
docker compose down
```

## Configuration

Create `backend/gms-backend/.env` locally and keep it out of version control. At minimum:

```dotenv
DATABASE_URL=sqlite:///./pms.db
SECRET_KEY=use-a-long-random-value

EMAIL_ENABLED=false
EMAIL_BACKEND=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-address@example.com
SMTP_PASSWORD=your-app-password
SMTP_USE_TLS=true
MAIL_FROM=PMS Platform <your-address@example.com>

AI_PROVIDER_URL=https://api.openai.com/v1/chat/completions
AI_API_KEY=
GROQ_API_KEY=
```

Email and AI integrations are optional. Use provider-specific app passwords or API keys, never a personal account password. Any credentials that have been pasted into a committed, shared, or exposed `.env` file should be revoked and replaced immediately.

## API surface

The backend exposes versioned endpoints under `/api/v1`, including:

- `/auth` - authentication and tokens
- `/users` and `/teams` - people, roles, and team structure
- `/goals` - goals, progress, approvals, and history
- `/dashboard` - summary metrics and dashboards
- `/reviews` - feedback, scoring, AI drafts, and exports
- `/probation` - probation workflows
- `/notifications` - user notifications
- `/timeline` - work history and activity trails
- `/achievements` and `/kudos` - recognition
- `/readiness` - development and progression signals
- `/admin` - administration and feedback flags

The OpenAPI schema is generated automatically by FastAPI and is available at `/docs` when the backend is running.

## Roles and authorization

PMS supports role-aware workflows for administrators, managers, and members. Access is also shaped by organizational hierarchy: users can access their own information, managers can access appropriate reports, and cross-organization data is restricted by the API authorization layer.

## Development checks

Frontend production build:

```bash
cd frontend
npm run build
```

Backend smoke check:

```bash
cd backend/gms-backend
python -m pytest
```

For a fast service check, start the API and request:

```bash
curl http://127.0.0.1:8000/health
```

Expected response:

```json
{"status":"healthy","version":"2.0.0"}
```

## Security notes

- Never commit `.env` files, database files, JWT secrets, SMTP passwords, or provider API keys.
- Replace the sample `SECRET_KEY` before any shared or deployed environment.
- Restrict CORS origins before production deployment.
- Use PostgreSQL, HTTPS, secret management, and a production-grade email configuration outside local development.
- Rotate any credential that has been exposed in chat, screenshots, logs, or source control.

## Project status

The main product surfaces are implemented across the frontend and backend, including the core goal lifecycle and the expanded timeline, recognition, readiness, review, notification, and administration features. Test and validation notes are kept in the repository alongside the implementation so the project can be audited and extended without losing context.

## License

No license has been declared yet.
# PMS
