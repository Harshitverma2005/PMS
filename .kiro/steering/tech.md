# Tech Stack

## Backend (`backend/gms-backend/`)

- **Runtime**: Python 3.11
- **Framework**: FastAPI 0.115
- **ORM**: SQLAlchemy 2.0 (sync sessions)
- **Migrations**: Alembic 1.14
- **Database**: PostgreSQL 16 (production via Docker), SQLite (local fallback)
- **DB Driver**: psycopg 3 (`psycopg[binary]`)
- **Auth**: JWT via `python-jose`, password hashing via `passlib[bcrypt]`
- **Validation**: Pydantic v2 + pydantic-settings
- **Scheduling**: APScheduler 3.10 (background jobs for review cycle automation)
- **Email**: SMTP or Resend (`resend==2.4.0`), configurable via `EMAIL_BACKEND` env var
- **ASGI Server**: Uvicorn

## Frontend (`frontend/`)

- **Runtime**: Node 20
- **Framework**: React 18 + Vite 5
- **Routing**: React Router DOM v6
- **State Management**: Zustand
- **HTTP Client**: Axios (via centralized `apiClient.js`)
- **UI Components**: shadcn/ui + Radix UI primitives
- **Styling**: Tailwind CSS v4
- **Forms**: React Hook Form
- **Notifications**: react-hot-toast
- **Icons**: lucide-react
- **Date utilities**: date-fns

## Infrastructure

- **Containerization**: Docker + Docker Compose
- **Services**: `postgres`, `gms-backend` (port 8003), `frontend` (port 3001)
- **Reverse proxy / public tunnels**: serveo / ngrok (dev only)

---

## Common Commands

### Docker (full stack)
```bash
# Start all services
docker-compose up --build

# Start in background
docker-compose up -d

# Stop all services
docker-compose down
```

### Backend (local dev)
```bash
cd backend/gms-backend

# Install dependencies
pip install -r requirements.txt

# Run dev server (default port 8000)
uvicorn app.main:app --reload

# Database migrations
alembic upgrade head
alembic revision --autogenerate -m "description"

# Seed data
python seed.py
```

### Frontend (local dev)
```bash
cd frontend

# Install dependencies
npm install

# Run dev server (default port 5173, proxied to backend)
npm run dev

# Production build
npm run build
```

### Testing (backend)
```bash
cd backend/gms-backend

# Run individual test modules
python test_goal_cases.py
python test_auth_cases.py
python test_prob_cases.py

# Run all tests
python run_all_tests.py
```

---

## Environment Configuration

Backend reads from `backend/gms-backend/.env`. Key variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL or SQLite connection string |
| `SECRET_KEY` | JWT signing secret (min 32 chars) |
| `EMAIL_BACKEND` | `stub` / `smtp` / `resend` |
| `SMTP_USER` / `SMTP_PASSWORD` | Gmail app password credentials |
| `RESEND_API_KEY` | Resend API key (if using Resend) |

Frontend proxies API requests to backend via Vite config (`/api/v1` → backend).
