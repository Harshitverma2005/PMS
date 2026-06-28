# Design Document: UPMS Pro Features

## Overview

This document describes the technical design for eleven pro features that transform the UPMS into an
evidence-first performance management system. The core thesis: every review line is backed by a
citable event from the employee's year-long work trail, not recollection from the last week.

The eleven features are layered on top of the existing FastAPI + React + PostgreSQL stack
(`backend/gms-backend/` + `frontend/src/`) without altering the existing goal lifecycle, review
cycle triggers, or auth system. The design follows the project's established layering rules:
routers → services → repositories → models.

### Design Principles

1. **Append-only evidence trail** — Achievements and Kudos are immutable records once created. This
   guarantees the audit trail used to generate AI drafts cannot be retroactively altered.
2. **Manager-of-Record snapshot** — The reporting relationship is frozen at cycle activation so
   historical reviews remain accurate through org changes.
3. **Recursive hierarchy at query time** — Skip-level access is derived from the existing
   `manager_id` chain with no additional tables or permission flags.
4. **Atomic draft regeneration** — AI drafts replace the previous draft only when the new one is
   fully written. Readers never see a partial draft.
5. **Self-contained exports** — HTML exports carry inline CSS and no external dependencies so they
   are archival-quality documents.

---

## Architecture

### High-Level Component Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│  React SPA (frontend/src/)                                              │
│                                                                         │
│  Pages: Timeline · Goals · ReviewStudio · Readiness · Achievements     │
│         Kudos · Export                                                  │
│  Store:  auth.js (Zustand)                                              │
│  API:    timeline.js · achievements.js · kudos.js · readiness.js       │
│          aiDraft.js  · export.js  (new modules in src/api/)            │
└────────────────────┬────────────────────────────────────────────────────┘
                     │  /api/v1/*  (Vite proxy → port 8003)
┌────────────────────▼────────────────────────────────────────────────────┐
│  FastAPI  (backend/gms-backend/app/)                                    │
│                                                                         │
│  Routers:  timeline · achievements · kudos · readiness · ai_draft      │
│            goal_history · export (new router files)                    │
│  Services: timeline_service · achievement_service · kudos_service      │
│            readiness_service · ai_draft_service · export_service       │
│            cycle_snapshot_service (new service files)                  │
│  Models:   TimelineEvent · Achievement · Kudos · GoalStatusHistory     │
│            (AIDraft stored as JSON on ReviewForm)                      │
└────────────────────┬────────────────────────────────────────────────────┘
                     │  SQLAlchemy sync sessions
┌────────────────────▼────────────────────────────────────────────────────┐
│  PostgreSQL 16                                                          │
│  New tables:  timeline_events · achievements · kudos                   │
│               goal_status_history                                       │
│  Altered:     review_forms (manager_of_record_id · citations JSON)     │
└─────────────────────────────────────────────────────────────────────────┘
                     ↕  HTTP  (30 s timeout)
                  AI Provider (OpenAI-compatible API)
                  Called only from ai_draft_service
```

### Request Flow for AI Draft Generation

```
Manager → POST /api/v1/reviews/forms/{id}/draft
  → ai_draft router
    → check role (403 if member)
    → ai_draft_service.generate(db, form_id, manager_id)
      → load ReviewForm; 404 if not active cycle
      → timeline_service.get_work_trail(db, employee_id, cycle)
      → 422 if no active/completed goals
      → call AI provider (30 s timeout; 503 on failure)
      → write new AIDraft atomically (replace old)
      → return structured draft + citations
  ← 200 DraftResponse
```

### New Enum Values (to add to `app/enums.py`)

```python
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
```

---

## Components and Interfaces

### Backend Routers (new files under `app/routers/`)

| File | Prefix | Key Endpoints |
|------|--------|---------------|
| `timeline.py` | `/api/v1/timeline` | `GET /{employee_id}`, `GET /{employee_id}/export` |
| `goal_history.py` | `/api/v1/goals` | `GET /{goal_id}/history`, `POST /{goal_id}/archive` |
| `achievements.py` | `/api/v1/achievements` | `POST /`, `GET /` |
| `kudos.py` | `/api/v1/kudos` | `POST /`, `GET /feed` |
| `readiness.py` | `/api/v1/readiness` | `GET /{employee_id}`, `GET /team` |
| `ai_draft.py` | `/api/v1/reviews` | `POST /forms/{form_id}/draft` |
| `export.py` | `/api/v1/reviews` | `GET /forms/{form_id}/export` |

### Backend Services (new files under `app/services/`)

| Service | Responsibilities |
|---------|-----------------|
| `timeline_service.py` | Aggregate events from all nine sources; filter, paginate, sort; emit events |
| `achievement_service.py` | Validate and persist Achievements; enforce append-only; emit timeline events |
| `kudos_service.py` | Validate and persist Kudos; enforce self-kudos guard; emit timeline events |
| `readiness_service.py` | Compute Readiness_Score from five signals; scope to active cycle; build prompts |
| `ai_draft_service.py` | Fetch work trail; call AI provider; write draft atomically; handle timeout |
| `export_service.py` | Render completed review as self-contained HTML; sanitize filenames |
| `cycle_snapshot_service.py` | Set `manager_of_record_id` atomically on cycle activation |
| `hierarchy_service.py` | Traverse `manager_id` chain recursively; check read and write access |

### Frontend Pages (new files under `src/pages/`)

| File | Route | Roles |
|------|-------|-------|
| `Timeline.jsx` | `/timeline` | member (own), manager (reports) |
| `Achievements.jsx` | `/achievements` | member |
| `Kudos.jsx` | `/kudos` | all authenticated |
| `Readiness.jsx` | `/readiness` | manager only |
| `ReviewStudio.jsx` | `/review-studio/:formId` | manager |

### Frontend API Modules (new files under `src/api/`)

| File | Functions |
|------|-----------|
| `timeline.js` | `getTimeline(employeeId, params)`, `exportTimeline(employeeId)` |
| `achievements.js` | `createAchievement(data)`, `getAchievements(params)` |
| `kudos.js` | `createKudos(data)`, `getKudosFeed(page)` |
| `readiness.js` | `getReadiness(employeeId)`, `getTeamReadiness()` |
| `aiDraft.js` | `generateDraft(formId)` |
| `exportApi.js` | `exportReview(formId)` |

---

## Data Models

### New Table: `timeline_events`

```python
# app/models/timeline.py
class TimelineEvent(Base):
    __tablename__ = "timeline_events"

    id          = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    event_type  = Column(SQLEnum(TimelineEventType), nullable=False)
    timestamp   = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    title       = Column(String(500), nullable=False)
    summary     = Column(Text, nullable=True)
    source_id   = Column(Integer, nullable=True)   # FK to the originating record

    employee = relationship("User", foreign_keys=[employee_id])
```

Indexed on `(employee_id, timestamp DESC)` for fast timeline queries.  
Indexed on `(employee_id, event_type)` for type-filtered queries.

### New Table: `achievements`

```python
# app/models/achievement.py
class Achievement(Base):
    __tablename__ = "achievements"

    id           = Column(Integer, primary_key=True, index=True)
    employee_id  = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title        = Column(String(200), nullable=False)
    description  = Column(Text, nullable=False)
    category     = Column(SQLEnum(AchievementCategory), nullable=False)
    evidence_url = Column(String(2048), nullable=True)
    goal_id      = Column(Integer, ForeignKey("goals.id"), nullable=True)
    created_at   = Column(DateTime, nullable=False, default=datetime.utcnow)

    employee = relationship("User", foreign_keys=[employee_id])
    goal     = relationship("Goal", foreign_keys=[goal_id])
```

Append-only: the router registers no `PUT`/`PATCH`/`DELETE` handlers; a middleware guard returns
405 for any such method on `/api/v1/achievements/{id}`.

### New Table: `kudos`

```python
# app/models/kudos.py
class Kudos(Base):
    __tablename__ = "kudos"

    id           = Column(Integer, primary_key=True, index=True)
    sender_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message      = Column(String(500), nullable=False)
    created_at   = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    sender    = relationship("User", foreign_keys=[sender_id])
    recipient = relationship("User", foreign_keys=[recipient_id])
```

Append-only: same guard pattern as achievements.

### New Table: `goal_status_history`

```python
# app/models/goal_history.py
class GoalStatusHistory(Base):
    __tablename__ = "goal_status_history"

    id          = Column(Integer, primary_key=True, index=True)
    goal_id     = Column(Integer, ForeignKey("goals.id"), nullable=False, index=True)
    from_status = Column(SQLEnum(GoalStatus), nullable=True)   # null for initial creation
    to_status   = Column(SQLEnum(GoalStatus), nullable=False)
    actor_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    timestamp   = Column(DateTime, nullable=False, default=datetime.utcnow)
    comment     = Column(Text, nullable=True)

    goal  = relationship("Goal", foreign_keys=[goal_id])
    actor = relationship("User", foreign_keys=[actor_id])
```

### Altered Table: `review_forms`

Two new columns added via Alembic migration:

```python
# Migration: alembic revision --autogenerate -m "add_manager_of_record_and_citations"
manager_of_record_id = Column(Integer, ForeignKey("users.id"), nullable=True)
citations            = Column(JSON, nullable=True)   # persisted citations map from AI draft
ai_draft             = Column(JSON, nullable=True)   # full AI draft payload

manager_of_record = relationship("User", foreign_keys=[manager_of_record_id])
```

`manager_of_record_id` is set once on cycle activation and never written again by any service.
The `cycle_snapshot_service` is the only writer; all other services treat it as read-only.

### Pydantic Schemas (key shapes)

```python
# app/schemas/timeline.py
class TimelineEventResponse(BaseModel):
    id: int
    event_type: TimelineEventType
    timestamp: datetime
    title: str
    summary: str | None
    source_id: int | None

class TimelineResponse(BaseModel):
    total_count: int
    page: int
    page_size: int
    events: list[TimelineEventResponse]

# app/schemas/achievement.py
class AchievementCreate(BaseModel):
    title: str = Field(..., max_length=200)
    description: str = Field(..., max_length=2000)
    category: AchievementCategory
    evidence_url: HttpUrl | None = None
    goal_id: int | None = None

class AchievementResponse(AchievementCreate):
    id: int
    employee_id: int
    created_at: datetime

# app/schemas/kudos.py
class KudosCreate(BaseModel):
    recipient_id: int
    message: str = Field(..., max_length=500)

class KudosResponse(BaseModel):
    id: int
    sender_id: int
    sender_name: str
    recipient_id: int
    recipient_name: str
    message: str
    created_at: datetime

# app/schemas/readiness.py
class ReadinessSignal(BaseModel):
    name: str
    passed: bool
    label: str | None   # prompt string when passed=False; null when passed=True

class ReadinessResponse(BaseModel):
    score: int           # 0–100 in steps of 20
    signals: list[ReadinessSignal]
    cycle_active: bool
    prompts: list[str]   # empty when score == 100

# app/schemas/ai_draft.py
class Citation(BaseModel):
    event_type: str
    event_date: str      # ISO 8601
    event_title: str
    source_id: int

class AIDraftResponse(BaseModel):
    summary: str
    strengths: list[str]        # min 2 items
    growth_areas: list[str]     # min 1 item
    suggested_rating: int       # 1–5
    citations: dict[str, list[Citation]]

# app/schemas/review.py (additions)
class ReviewFormResponse(BaseModel):
    # ... existing fields ...
    manager_of_record_id: int | None
    manager_of_record_name: str | None
    ai_draft: AIDraftResponse | None
    citations: dict | None
```

---

## API Design

### Requirement 1 — Unified Performance Timeline

```
GET  /api/v1/timeline/{employee_id}
  Query: type, start_date, end_date, page (default 1), page_size (default 50, max 200)
  Auth: any authenticated user
  200: TimelineResponse  |  403  |  404  |  422

GET  /api/v1/timeline/{employee_id}/export
  Auth: authorized user (same access rules)
  200: text/csv with Content-Disposition: attachment  |  403  |  404
```

Access control is enforced by `hierarchy_service.can_read(db, requesting_user, employee_id)`:
- Returns `True` if requester is the employee, a direct manager, or any skip-level manager.
- Returns `False` otherwise → 403.

### Requirement 2 — Goal Lifecycle History

```
GET  /api/v1/goals/{goal_id}/history
  200: list[GoalStatusHistoryResponse]  |  403  |  404

POST /api/v1/goals/{goal_id}/approve
  Body: { "approved": bool, "comment": str (non-empty) }
  200: GoalResponse  |  403  |  422

POST /api/v1/goals/{goal_id}/archive
  Body: { "archive_reason": str (non-empty) }
  200: GoalResponse  |  403  |  422
```

Every status change calls `timeline_service.emit(db, employee_id, GOAL_STATUS_CHANGED, ...)`.

### Requirement 3 — AI Draft

```
POST /api/v1/reviews/forms/{form_id}/draft
  Auth: manager or admin only
  200: AIDraftResponse  |  403  |  404  |  422  |  503
```

`ai_draft_service` fetches the Member's work trail (Goals, Progress, Feedback, Achievements, Kudos)
within the cycle date range, builds a prompt, calls the AI provider with a 30-second timeout, and
writes the draft atomically:

```python
# Atomic replacement pattern in ai_draft_service
new_draft = call_ai(prompt)          # may raise if timeout
form.ai_draft    = new_draft         # replace only after full response
form.citations   = new_draft["citations"]
db.commit()
```

The AI provider URL and key are read from `settings.ai_provider_url` / `settings.ai_api_key`.

### Requirement 4 — Separate Review Records

```
POST /api/v1/review-forms/{form_id}/submit
  Body: ReviewFormSubmit (comment, form_data, final_rating for manager type)
  200: ReviewFormResponse  |  403  |  422
```

The existing `review_service.submit_form()` already enforces ownership and cross-share logic.
New additions:
- Member cannot submit `manager_feedback` form → 403.
- Manager submission validates `comment` non-empty and `final_rating` in `[1, 5]` → 422 otherwise.
- Manager-of-record name resolved from `manager_of_record_id` in all GET responses.

### Requirement 5 — Readiness Dashboard

```
GET /api/v1/readiness/{employee_id}
  Auth: manager for direct reports; member for self
  200: ReadinessResponse  |  403  |  404

GET /api/v1/readiness/team
  Auth: manager only
  200: list[ReadinessResponse] sorted ascending by score
```

Score is recomputed on every call (no caching). Five signals evaluated against the most recent
active cycle's date range. If no active cycle exists, evaluated against lifetime data.

### Requirement 6 — Achievements

```
POST /api/v1/achievements
  Auth: member
  201: AchievementResponse  |  422

GET  /api/v1/achievements
  Query: employee_id (optional, manager only for direct reports)
  200: list[AchievementResponse]  |  403

PUT/PATCH/DELETE /api/v1/achievements/{id}
  405 (no handler registered)
```

### Requirement 7 — Kudos

```
POST /api/v1/kudos
  Auth: any authenticated user
  201: KudosResponse  |  422 (self-kudos)

GET  /api/v1/kudos/feed
  Query: page (default 1), page_size (default 50)
  200: { total_count, page, page_size, items: list[KudosResponse] }

PUT/PATCH/DELETE /api/v1/kudos/{id}
  405
```

### Requirements 9 / Cycle Snapshot

Cycle activation is already handled in `review_service.trigger_cycle()`. The new
`cycle_snapshot_service.snapshot_manager_of_record(db, cycle_id)` is called inside the same
transaction to set `manager_of_record_id` on all forms atomically.

### Requirement 11 — Export

```
GET /api/v1/reviews/forms/{form_id}/export
  Auth: employee_id or manager_of_record_id
  200: text/html self-contained  |  401  |  403  |  422
```

`export_service.render(db, form_id)` builds a Python string using an HTML template with inline
`<style>` block. All data is loaded from the database; no external HTTP calls are made.

---

## Frontend Components

### Timeline Page (`src/pages/Timeline.jsx`)

- Fetches `GET /api/v1/timeline/{employeeId}` on mount and on filter change.
- Filter bar: type dropdown (nine values + "All"), date range pickers (date-fns), paginator.
- Renders events as a vertical `<ol>` with a coloured icon per `event_type` (lucide-react icons).
- "Export CSV" button triggers `exportTimeline(employeeId)` → browser download via Blob.
- Manager view: employee picker from `GET /api/v1/users` filtered to direct reports.

### Review Studio Page (`src/pages/ReviewStudio.jsx`)

Two-column layout:
- **Left panel**: AI Draft — summary, strengths, growth areas with superscript citation markers.
  "Regenerate Draft" button calls `generateDraft(formId)`.
- **Right panel**: Evidence Sidebar — list of cited `TimelineEvent` cards. Clicking a citation
  marker in the left panel scrolls the sidebar to and highlights the corresponding card.
- **Bottom**: self-assessment read-only panel (different `bg-muted` background), manager comment
  `<textarea>` (React Hook Form), rating selector (1–5 stars), Submit and Export buttons.
- Export button disabled unless `form.status === "submitted"`.

### Readiness Dashboard Page (`src/pages/Readiness.jsx`)

- Fetches `GET /api/v1/readiness/team` on mount.
- Renders one card per direct report sorted by score ascending.
- Score badge: Tailwind `bg-red-100` (0–39), `bg-amber-100` (40–69), `bg-green-100` (70–100).
- Five signal icons: filled `CheckCircle` / hollow `Circle` (lucide-react).
- Expandable section per card shows prompt strings.
- When `self_review_deadline` is within 14 days, prompts are prefixed with ⚠️ banner.
- Route guard: if role is `member`, redirect to `/`; if role is `admin`, redirect to `/admin`.

### Achievements Page (`src/pages/Achievements.jsx`)

- Fetches `GET /api/v1/achievements` on mount.
- "Log Achievement" sheet (shadcn `Sheet` component): title, description, category select,
  evidence_url input, optional goal picker.
- Cards display title, `<Badge>` for category, description, date, evidence link, linked goal title.
- No edit/delete controls rendered (matches append-only backend).

### Kudos Page (`src/pages/Kudos.jsx`)

- Fetches `GET /api/v1/kudos/feed` (page 1) on mount; "Load more" appends next page.
- Feed items: sender name → recipient name with message and relative date (date-fns `formatDistanceToNow`).
- "Give Kudos" button opens a `Dialog`: recipient searchable `Combobox`, message `Textarea`.
  On success, prepend new item to feed state (optimistic update with `react-hot-toast` success).

### Dashboard Widget (`src/pages/Dashboard.jsx` — existing, new section)

- New "Review Readiness" card added for members: calls `GET /api/v1/readiness/{currentUserId}`.
- Displays score percentage with ring indicator and prompt list.
- Always renders regardless of whether an active cycle exists.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a
system — essentially, a formal statement about what the system should do. Properties serve as the
bridge between human-readable specifications and machine-verifiable correctness guarantees.*

---

### Property 1: Timeline ordering invariant

*For any* set of Timeline_Events belonging to an employee, calling `GET /api/v1/timeline/{id}`
must return the events ordered strictly by descending `timestamp`; no two adjacent events in the
response should violate the ordering.

**Validates: Requirements 1.1**

---

### Property 2: Timeline authorization — own timeline always accessible

*For any* authenticated user, calling the timeline endpoint with their own `id` as `employee_id`
must always return HTTP 200 with the full event list.

**Validates: Requirements 1.2**

---

### Property 3: Timeline authorization — manager chain read access

*For any* manager-member pair connected by a chain of one or more `manager_id` hops, the manager
at the top of the chain must receive HTTP 200 when reading the timeline of any member below them
in the chain. This applies regardless of chain depth.

**Validates: Requirements 1.3, 1.4, 8.1, 8.2**

---

### Property 4: Timeline authorization — cross-org access is forbidden

*For any* two users with no `manager_id` chain connecting them in either direction, calling the
timeline endpoint for one user from the other's session must return HTTP 403.

**Validates: Requirements 1.6, 8.3**

---

### Property 5: Timeline type filter correctness

*For any* event list containing events of mixed `event_type` values, filtering the timeline by a
specific `type` value must return only events whose `event_type` matches that value
(case-insensitively); no event of a different type must appear in the filtered result.

**Validates: Requirements 1.7**

---

### Property 6: Timeline date filter — inclusive bounds

*For any* event list with events at various dates and any `start_date`/`end_date` pair, the
filtered timeline must contain exactly those events whose `timestamp` falls within
`[start_date, end_date]` inclusive; no out-of-range event must appear and no in-range event must
be missing.

**Validates: Requirements 1.8**

---

### Property 7: Timeline pagination — correct slice and metadata

*For any* total of N timeline events and any valid `page`/`page_size` combination, the response
must contain the correct slice of events and `total_count` must equal N regardless of which page
is requested.

**Validates: Requirements 1.9**

---

### Property 8: Timeline CSV export — structure invariant

*For any* authorized call to the export endpoint, the returned CSV must have a header row
containing exactly the columns `timestamp`, `type`, `title`, `summary`, and the
`Content-Disposition` header must match `attachment; filename="timeline_{id}_{YYYY-MM-DD}.csv"`.

**Validates: Requirements 1.10**

---

### Property 9: Goal status history — ordered and complete

*For any* goal that has undergone N status transitions, `GET /api/v1/goals/{id}/history` must
return exactly N entries ordered by ascending `timestamp`; no transition must be missing or
duplicated.

**Validates: Requirements 2.2**

---

### Property 10: Goal approval/rejection rejects whitespace-only comments

*For any* string composed entirely of whitespace characters (including the empty string), passing
it as the `comment` in an approve or reject request must return HTTP 422 and leave the goal's
status and history unchanged.

**Validates: Requirements 2.3, 2.4**

---

### Property 11: Goal transition emits Timeline_Event

*For any* valid goal status transition, exactly one `goal_status_changed` Timeline_Event must be
appended to the assignee's timeline with `title` equal to the goal's title and `summary` equal to
`"{from_status} → {to_status} — {comment}"`.

**Validates: Requirements 2.8**

---

### Property 12: AI draft structural constraints

*For any* non-empty work trail, the AI draft response must always contain: a non-empty `summary`
string, a `strengths` list with at least two items, a `growth_areas` list with at least one item,
a `suggested_rating` integer in `[1, 5]`, and a `citations` map where every key has at least one
Citation object.

**Validates: Requirements 3.2, 3.4**

---

### Property 13: AI draft data isolation

*For any* two distinct employees whose work trails both exist in the system, the draft generated
for employee A must not contain any data (in any field including citations) that originates from
employee B's Timeline_Events or records.

**Validates: Requirements 3.5**

---

### Property 14: AI draft atomic replacement

*For any* review form that already has a stored draft, calling the draft endpoint again must result
in exactly one complete draft being stored after the call completes — either the prior draft
unchanged (if the new generation fails) or the fully-written new draft; a partial draft must never
be observable.

**Validates: Requirements 3.8**

---

### Property 15: AI draft citations persisted on submission

*For any* review form submission that includes a `citations` map, reading that form back after
submission must return the same `citations` map with no data loss.

**Validates: Requirements 3.10**

---

### Property 16: Separate review form records

*For any* activated review cycle and any eligible employee, exactly two ReviewForm records must
exist for that employee in that cycle — one with `form_type = self_assessment` and one with
`form_type = manager_feedback` — and they must never be merged or have their content combined.

**Validates: Requirements 4.1**

---

### Property 17: Self-assessment immutability after submission

*For any* member and self-assessment ReviewForm, once the form reaches `submitted` status, any
subsequent submit request on that form must return an error and the form's content and status must
remain unchanged.

**Validates: Requirements 4.2**

---

### Property 18: Manager form validation — comment and rating required

*For any* manager ReviewForm submission missing a non-empty `comment` or with `final_rating`
outside `[1, 5]`, the request must return HTTP 422 and the form's `status` must remain unchanged.

**Validates: Requirements 4.3**

---

### Property 19: Manager content hidden until submission

*For any* member reading their own review before the manager ReviewForm reaches `submitted` status,
the response must not include the manager's `comment` or `final_rating`.

**Validates: Requirements 4.8**

---

### Property 20: Readiness score formula

*For any* combination of the five binary signals, the computed `score` must equal
`(count of true signals) × 20`, always producing an integer in `{0, 20, 40, 60, 80, 100}`.

**Validates: Requirements 5.1, 10.1**

---

### Property 21: Team readiness — sorted ascending by score

*For any* manager with N direct reports whose readiness scores are not all equal, `GET
/api/v1/readiness/team` must return exactly N entries sorted in non-decreasing order of `score`.

**Validates: Requirements 5.5**

---

### Property 22: Readiness prompt strings — exact text and count

*For any* employee with K signals in the `false` state (0 ≤ K ≤ 5), the `prompts` array in the
readiness response must contain exactly K strings, each matching the specified prompt text for its
corresponding signal.

**Validates: Requirements 5.8, 10.2**

---

### Property 23: Deadline warning prefix

*For any* active ReviewCycle whose `self_review_deadline` is within 14 calendar days of the
current date, every prompt string in the readiness response must begin with
`"⚠ Review deadline approaching — "`.

**Validates: Requirements 10.6**

---

### Property 24: Achievement employee_id is always the token user

*For any* authenticated user creating an Achievement, the `employee_id` persisted on the record
must equal the authenticated user's `id` regardless of any `employee_id` value included in the
request body.

**Validates: Requirements 6.2**

---

### Property 25: Achievement append-only semantics

*For any* Achievement record, issuing `PUT`, `PATCH`, or `DELETE` requests must return HTTP 405
regardless of the requesting user's role.

**Validates: Requirements 6.4, 7.3**

---

### Property 26: Achievement ordering

*For any* member with N achievements, `GET /api/v1/achievements` must return all N achievements
ordered by descending `created_at`; no achievement must be missing or appear out of order.

**Validates: Requirements 6.5**

---

### Property 27: Achievement emits timeline event

*For any* new Achievement, exactly one `achievement_logged` Timeline_Event must be appended to
the employee's timeline with `title` equal to the achievement's `title` and `summary` equal to
the `category` value.

**Validates: Requirements 6.7**

---

### Property 28: Kudos self-give guard

*For any* authenticated user, submitting a Kudos where `recipient_id` equals their own `id` must
always return HTTP 422 with `{"detail": "Cannot give kudos to yourself"}` and must not persist
any record.

**Validates: Requirements 7.1, 7.2**

---

### Property 29: Kudos feed ordering

*For any* N kudos records in the system, `GET /api/v1/kudos/feed` must return entries ordered by
descending `created_at`; each entry must include `sender_name` and `recipient_name`.

**Validates: Requirements 7.4**

---

### Property 30: Kudos emits timeline event on recipient

*For any* new Kudos, exactly one `kudos_received` Timeline_Event must be appended to the
recipient's (not the sender's) timeline with `title = "Kudos from {sender_name}"` and
`summary` equal to the kudos `message`.

**Validates: Requirements 7.5**

---

### Property 31: Manager-of-record immutability

*For any* ReviewForm whose `manager_of_record_id` has been set at cycle activation, changing the
employee's `manager_id` afterward must not alter the `manager_of_record_id` value on that form;
subsequent API responses must continue to resolve `manager_of_record_name` from the original
`manager_of_record_id`.

**Validates: Requirements 9.1, 9.5**

---

### Property 32: Cycle snapshot atomicity

*For any* ReviewCycle activation, after the activation call completes successfully, every
ReviewForm generated for that cycle must have `manager_of_record_id` set; if the activation
fails, no ReviewForm in that batch must have `manager_of_record_id` set.

**Validates: Requirements 9.2**

---

### Property 33: Export requires authenticated user (401 guard)

*For any* call to `GET /api/v1/reviews/forms/{form_id}/export` made without a valid JWT, the
response must be HTTP 401.

**Validates: Requirements 11.1**

---

### Property 34: Export blocked for non-finalised reviews

*For any* ReviewForm whose manager ReviewForm has not yet reached `submitted` status, calling the
export endpoint must return HTTP 422 with
`{"detail": "Review is not yet finalised; export is available only after the manager submits"}`.

**Validates: Requirements 11.4**

---

### Property 35: Export filename sanitization

*For any* employee name and cycle name containing non-alphanumeric characters, the
`Content-Disposition` filename in the export response must replace every non-alphanumeric
character in both name segments with underscores.

**Validates: Requirements 11.3**

---

### Property 36: Export HTML self-contained

*For any* exported HTML string, it must contain no `src` or `href` attribute values pointing to
external URLs; all styling must be inline or within a `<style>` block in `<head>`.

**Validates: Requirements 11.10**

---

## Error Handling

### Backend Error Strategy

All routers follow the existing pattern of catching `ValueError` from services and raising
`HTTPException`. New services add these specific error conditions:

| Condition | Status | Detail |
|-----------|--------|--------|
| `employee_id` not found | 404 | `"Employee not found"` |
| Access outside management chain | 403 | `"Forbidden"` |
| Skip-level write attempt | 403 | `"Action requires direct manager relationship"` |
| Whitespace-only comment on goal action | 422 | `"comment must not be empty"` |
| Self-kudos | 422 | `"Cannot give kudos to yourself"` |
| Invalid `goal_id` on achievement | 422 | `"Goal not found"` or `"Goal does not belong to this employee"` |
| Mutation on append-only resource | 405 | `"Method Not Allowed"` |
| ReviewForm not in active cycle | 404 | `"ReviewForm not found or cycle is not active"` |
| Empty work trail for AI draft | 422 | `"Insufficient evidence: no completed or active goals found for this employee in the review period"` |
| AI provider timeout (>30 s) or error | 503 | `"Draft generation temporarily unavailable; please try again"` |
| Export before manager submits | 422 | `"Review is not yet finalised; export is available only after the manager submits"` |
| Invalid timeline `type` query param | 422 | `"Invalid type. Valid values: [...]"` |
| Invalid date format | 422 | Pydantic validation detail |
| `page` or `page_size` out of range | 422 | Pydantic validation detail |

### AI Provider Failure Isolation

`ai_draft_service` wraps the AI call in a `try/except` with a 30-second `httpx` timeout:

```python
try:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(AI_URL, json=payload, headers=headers)
        response.raise_for_status()
        new_draft = response.json()
except (httpx.TimeoutException, httpx.HTTPStatusError, Exception):
    raise HTTPException(503, detail="Draft generation temporarily unavailable; please try again")

# Only update DB after successful AI response
form.ai_draft  = new_draft
form.citations = new_draft["citations"]
db.commit()
```

No partial state is written. Existing drafts are never cleared before the new one is confirmed.

### Frontend Error Handling

- All API calls use the centralized `apiClient.js` (Axios interceptors).
- 401 responses trigger `auth.logout()` and redirect to `/login`.
- 403 responses show `toast.error("You don't have permission to do that")`.
- 503 responses on draft endpoint show `toast.error("Draft generation temporarily unavailable; please try again")`.
- Failed export calls show `toast.error("Export failed — please try again")` with no navigation.
- 422 responses display field-level errors inline via React Hook Form's `setError`.

### Hierarchy Traversal Safety

The recursive `manager_id` chain traversal in `hierarchy_service` includes a depth limit (default
20) to prevent infinite loops from circular `manager_id` references in bad data:

```python
def get_management_chain(db, user_id, max_depth=20):
    visited, current, depth = set(), user_id, 0
    while current and depth < max_depth:
        if current in visited:
            break   # circular reference guard
        visited.add(current)
        user = db.query(User).filter(User.id == current).first()
        if not user:
            break
        current = user.manager_id
        depth += 1
    return visited
```

---

## Testing Strategy

### Property-Based Testing

The property-based testing library for this project is **[Hypothesis](https://hypothesis.readthedocs.io/)**
(Python), which integrates naturally with the FastAPI + pytest stack already used in
`backend/gms-backend/`.

Each correctness property in this document maps to one Hypothesis test. The tests run in-process
against a real SQLite test database (matching the existing local fallback pattern) so there are
no external network calls. The AI provider is mocked for all AI draft tests.

**Configuration**: Each property test runs a minimum of 100 examples (`@settings(max_examples=100)`).

**Tag format**: Each test is annotated with:
```python
# Feature: upms-pro-features, Property {N}: {property_text}
```

**Example test shape** (Property 20 — readiness score formula):

```python
from hypothesis import given, settings
from hypothesis import strategies as st

# Feature: upms-pro-features, Property 20: Readiness score formula
@given(signals=st.lists(st.booleans(), min_size=5, max_size=5))
@settings(max_examples=100)
def test_readiness_score_formula(signals, db_session):
    score = readiness_service.compute_score(signals)
    assert score == sum(signals) * 20
    assert score in {0, 20, 40, 60, 80, 100}
```

**Example test shape** (Property 5 — timeline type filter):

```python
# Feature: upms-pro-features, Property 5: Timeline type filter correctness
@given(
    events=st.lists(timeline_event_strategy(), min_size=0, max_size=50),
    filter_type=st.sampled_from(list(TimelineEventType))
)
@settings(max_examples=100)
def test_timeline_type_filter(events, filter_type, db_session, test_client, member_user):
    seed_events(db_session, events, member_user.id)
    resp = test_client.get(
        f"/api/v1/timeline/{member_user.id}",
        params={"type": filter_type.value},
        headers=auth_header(member_user)
    )
    assert resp.status_code == 200
    result = resp.json()["events"]
    assert all(e["event_type"] == filter_type.value for e in result)
```

### Unit Tests

Unit tests cover specific examples, edge cases, and integration boundaries. Written in pytest and
stored under `backend/gms-backend/tests/`.

Key unit test areas:
- `test_timeline.py` — 404/403 access control cases, invalid date formats, page out of range
- `test_achievements.py` — invalid URLs, non-owned goal_id, 405 on mutation attempts
- `test_kudos.py` — self-kudos, 405 on mutation attempts
- `test_ai_draft.py` — 503 on AI timeout (mocked), 422 on empty work trail, atomic replacement
- `test_export.py` — HTML structure, filename sanitization with special chars, 422 before submission
- `test_cycle_snapshot.py` — null manager_id case, late-join member case
- `test_readiness.py` — no active cycle (lifetime mode), multiple overlapping cycles

### Integration Tests

End-to-end integration tests run against a Docker Compose stack (existing pattern in the project):
- Full AI draft generation with a real AI provider (limited to a few examples)
- Export download verifying the HTML file opens correctly
- Review Studio workflow: generate draft → manager submit → member export

### Frontend Tests

No new testing framework is introduced. Frontend verification relies on:
- Manual smoke tests for all new pages
- shadcn/ui snapshot tests for the ReadinessCard, AchievementCard, KudosCard components
  (using Vitest + jsdom, matching any existing frontend test setup)

### Database Migration Testing

Each Alembic migration is tested by running `alembic upgrade head` and `alembic downgrade -1`
against a clean SQLite database before merging, following the existing project convention.
