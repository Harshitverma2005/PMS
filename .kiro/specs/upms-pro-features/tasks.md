# Implementation Plan: UPMS Pro Features

## Overview

Eleven pro features layered onto the existing FastAPI + React + PostgreSQL stack
(`backend/gms-backend/` + `frontend/src/`). The build follows the established
routers → services → repositories → models layering. New backend code lives in
`backend/gms-backend/app/`; new frontend code in `frontend/src/`. All property
tests use Hypothesis + pytest and live in `backend/gms-backend/tests/`.

---

## Tasks

- [x] 1. Foundation — enums, shared models, and database migrations
  - [x] 1.1 Extend `app/enums.py` with new enum classes
    - Add `TimelineEventType` (10 values: `goal_created`, `goal_approved`, `goal_completed`,
      `goal_archived`, `progress_updated`, `feedback_submitted`, `achievement_logged`,
      `kudos_received`, `checkin_submitted`, `goal_status_changed`)
    - Add `AchievementCategory` (5 values: `technical_impact`, `cost_savings`, `delivery`,
      `leadership`, `collaboration`)
    - _Requirements: 1.1, 6.1, 7.1_

  - [x] 1.2 Create `app/models/timeline.py` — `TimelineEvent` ORM model
    - Fields: `id`, `employee_id` (FK users), `event_type` (SQLEnum), `timestamp` (indexed),
      `title` (String 500), `summary` (Text nullable), `source_id` (Integer nullable)
    - Composite index on `(employee_id, timestamp DESC)` and `(employee_id, event_type)`
    - _Requirements: 1.1_

  - [x] 1.3 Create `app/models/achievement.py` — `Achievement` ORM model
    - Fields: `id`, `employee_id`, `title` (String 200), `description` (Text), `category`
      (SQLEnum AchievementCategory), `evidence_url` (String 2048 nullable),
      `goal_id` (FK goals nullable), `created_at` (immutable UTC timestamp)
    - _Requirements: 6.1_

  - [x] 1.4 Create `app/models/kudos.py` — `Kudos` ORM model
    - Fields: `id`, `sender_id` (FK users), `recipient_id` (FK users), `message` (String 500),
      `created_at` (indexed UTC timestamp)
    - Self-referential FK constraint — both sender and recipient point to `users.id`
    - _Requirements: 7.1_

  - [x] 1.5 Create `app/models/goal_history.py` — `GoalStatusHistory` ORM model
    - Fields: `id`, `goal_id` (FK goals, indexed), `from_status` (SQLEnum nullable),
      `to_status` (SQLEnum), `actor_id` (FK users), `timestamp` (UTC), `comment` (Text nullable)
    - _Requirements: 2.2_

  - [x] 1.6 Write Alembic migration for all four new tables and `review_forms` alterations
    - Add tables: `timeline_events`, `achievements`, `kudos`, `goal_status_history`
    - Alter `review_forms`: add `manager_of_record_id` (FK users nullable),
      `citations` (JSON nullable), `ai_draft` (JSON nullable)
    - Verify `alembic upgrade head` and `alembic downgrade -1` succeed on a clean SQLite DB
    - _Requirements: 1.1, 2.2, 3.10, 6.1, 7.1, 9.1_

  - [x] 1.7 Register new models in `app/main.py` startup imports
    - Import `timeline`, `achievement`, `kudos`, `goal_history` in the model import block
    - _Requirements: 1.1_

- [ ] 2. Hierarchy service and shared access-control layer
  - [x] 2.1 Create `app/services/hierarchy_service.py`
    - Implement `get_management_chain(db, user_id, max_depth=20) → set[int]`: walk `manager_id`
      chain upward, guard against circular references, return all ancestor user IDs
    - Implement `can_read(db, requesting_user, target_employee_id) → bool`: True if requester
      is the employee, a direct manager, or any skip-level ancestor
    - Implement `is_direct_manager(db, manager_id, employee_id) → bool`: True only for
      exactly one hop
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ] 2.2 Write property test for hierarchy chain read access (Property 3)
    - **Property 3: Timeline authorization — manager chain read access**
    - **Validates: Requirements 1.3, 1.4, 8.1, 8.2**
    - Build arbitrarily deep `manager_id` chains via Hypothesis; assert `can_read` returns
      `True` for every ancestor regardless of depth (up to max_depth)
    - `# Feature: upms-pro-features, Property 3`

  - [ ] 2.3 Write property test for cross-org access forbidden (Property 4)
    - **Property 4: Timeline authorization — cross-org access is forbidden**
    - **Validates: Requirements 1.6, 8.3**
    - Generate two users with no management chain relationship; assert `can_read` returns
      `False` in both directions
    - `# Feature: upms-pro-features, Property 4`

  - [ ] 2.4 Write unit tests for hierarchy service edge cases
    - Test circular `manager_id` reference does not infinite-loop
    - Test `manager_id = null` terminates chain correctly
    - Test depth-limit cutoff at `max_depth=20`
    - _Requirements: 8.1, 8.5_

- [ ] 3. Checkpoint — foundation and hierarchy
  - Ensure all migration and hierarchy service unit tests pass, ask the user if questions arise.

- [ ] 4. Timeline service and API (Requirement 1)
  - [ ] 4.1 Create `app/services/timeline_service.py`
    - Implement `emit(db, employee_id, event_type, title, summary, source_id)`: insert a
      `TimelineEvent` row; used by all downstream services when they produce side effects
    - Implement `get_timeline(db, employee_id, type_filter, start_date, end_date, page,
      page_size)`: query `timeline_events` with filters; return paginated
      `TimelineResponse` (total_count, page, page_size, events ordered DESC timestamp)
    - Implement `get_work_trail(db, employee_id, cycle)`: return all Goals, Progress, Feedback,
      Achievements, Kudos for the employee within a cycle's date range (used by AI draft)
    - _Requirements: 1.1, 1.7, 1.8, 1.9_

  - [ ] 4.2 Create `app/schemas/timeline.py`
    - `TimelineEventResponse`: id, event_type, timestamp, title, summary, source_id
    - `TimelineResponse`: total_count, page, page_size, events list
    - Validate `type` against `TimelineEventType` enum (case-insensitive); raise 422 with
      valid-values list on unknown value
    - Validate `start_date`/`end_date` as `date` fields; Pydantic returns 422 on bad format
    - Validate `page ≥ 1`, `page_size` in `[1, 200]`; raise 422 otherwise
    - _Requirements: 1.7, 1.8, 1.9_

  - [ ] 4.3 Create `app/routers/timeline.py` with two endpoints
    - `GET /api/v1/timeline/{employee_id}`: call `hierarchy_service.can_read`; 404 if employee
      not found, 403 if unauthorized; delegate to `timeline_service.get_timeline`
    - `GET /api/v1/timeline/{employee_id}/export`: same auth; stream all matching events as
      UTF-8 CSV with header `timestamp,type,title,summary`; set
      `Content-Disposition: attachment; filename="timeline_{id}_{YYYY-MM-DD}.csv"`
    - Register router in `app/main.py` with prefix `/api/v1/timeline`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.10_

  - [ ] 4.4 Write property test for timeline ordering (Property 1)
    - **Property 1: Timeline ordering invariant**
    - **Validates: Requirements 1.1**
    - Seed N random `TimelineEvent` rows via Hypothesis; call the GET endpoint; assert returned
      events are strictly descending by `timestamp`
    - `# Feature: upms-pro-features, Property 1`

  - [ ] 4.5 Write property test for own-timeline always accessible (Property 2)
    - **Property 2: Timeline authorization — own timeline always accessible**
    - **Validates: Requirements 1.2**
    - For any authenticated user, assert GET with their own `employee_id` returns HTTP 200
    - `# Feature: upms-pro-features, Property 2`

  - [ ] 4.6 Write property test for timeline type filter correctness (Property 5)
    - **Property 5: Timeline type filter correctness**
    - **Validates: Requirements 1.7**
    - Seed mixed event types; filter by each `TimelineEventType`; assert all returned events
      match the filter type and none of a different type appear
    - `# Feature: upms-pro-features, Property 5`

  - [ ] 4.7 Write property test for timeline date filter inclusive bounds (Property 6)
    - **Property 6: Timeline date filter — inclusive bounds**
    - **Validates: Requirements 1.8**
    - Generate events at random dates and random `start_date`/`end_date` pairs; assert
      response contains exactly those events within `[start_date, end_date]` inclusive
    - `# Feature: upms-pro-features, Property 6`

  - [ ] 4.8 Write property test for timeline pagination metadata (Property 7)
    - **Property 7: Timeline pagination — correct slice and metadata**
    - **Validates: Requirements 1.9**
    - Generate N events; for arbitrary valid page/page_size, assert slice length and
      `total_count == N` are correct
    - `# Feature: upms-pro-features, Property 7`

  - [ ] 4.9 Write property test for CSV export structure (Property 8)
    - **Property 8: Timeline CSV export — structure invariant**
    - **Validates: Requirements 1.10**
    - For any authorized export call, assert header row contains exactly
      `timestamp,type,title,summary` and `Content-Disposition` filename matches pattern
    - `# Feature: upms-pro-features, Property 8`

  - [ ] 4.10 Write unit tests for timeline access control edge cases
    - Test 404 on unknown `employee_id`
    - Test 403 on cross-org request
    - Test 422 on invalid `type` query param with valid-values in detail
    - Test 422 on invalid date format
    - Test 422 on `page_size > 200`
    - _Requirements: 1.5, 1.6, 1.7, 1.8, 1.9_

- [ ] 5. Goal lifecycle history and status transitions (Requirement 2)
  - [ ] 5.1 Create `app/services/goal_history_service.py`
    - Implement `record_transition(db, goal_id, from_status, to_status, actor_id, comment)`:
      insert `GoalStatusHistory` row; call `timeline_service.emit` with
      `event_type=GOAL_STATUS_CHANGED`, title = goal title,
      summary = `"{from_status} → {to_status} — {comment}"`
    - Implement `get_history(db, goal_id) → list[GoalStatusHistoryResponse]` ordered
      ascending by timestamp
    - _Requirements: 2.2, 2.8_

  - [ ] 5.2 Create `app/schemas/goal_history.py`
    - `GoalStatusHistoryResponse`: from_status, to_status, actor_id, actor_name,
      timestamp, comment
    - `GoalApproveRequest`: approved (bool), comment (str, non-empty validator)
    - `GoalArchiveRequest`: archive_reason (str, non-empty validator)
    - Non-empty validator: strip whitespace; raise `ValueError` if result is empty string
    - _Requirements: 2.3, 2.4, 2.5_

  - [ ] 5.3 Create `app/routers/goal_history.py` with three endpoints
    - `GET /api/v1/goals/{goal_id}/history`: open to member (own goal), manager (direct
      report's goal); return `list[GoalStatusHistoryResponse]`; 404 if goal not found
    - `POST /api/v1/goals/{goal_id}/approve`: manager only; validate direct-manager
      relationship (403 otherwise); validate comment non-empty (422 otherwise); call
      `goal_history_service.record_transition`; update goal `status`
    - `POST /api/v1/goals/{goal_id}/archive`: member (own) or manager (direct report);
      validate `archive_reason` non-empty; record transition; update status to `archived`
    - Register router in `app/main.py` with prefix `/api/v1/goals`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ] 5.4 Update `app/routers/goals.py` status badge exposure
    - Ensure `GoalResponse` and goal list schemas include `status` field so UI can
      render the status badge
    - _Requirements: 2.1, 2.7_

  - [ ] 5.5 Write property test for goal history completeness and ordering (Property 9)
    - **Property 9: Goal status history — ordered and complete**
    - **Validates: Requirements 2.2**
    - Perform N random valid transitions on a goal; assert history returns exactly N entries
      ordered ascending by timestamp with no duplicates
    - `# Feature: upms-pro-features, Property 9`

  - [ ] 5.6 Write property test for whitespace comment rejection (Property 10)
    - **Property 10: Goal approval/rejection rejects whitespace-only comments**
    - **Validates: Requirements 2.3, 2.4**
    - Generate strings composed entirely of whitespace (including empty); assert approve/
      reject/archive returns 422 and goal status is unchanged
    - `# Feature: upms-pro-features, Property 10`

  - [ ] 5.7 Write property test for goal transition timeline event (Property 11)
    - **Property 11: Goal transition emits Timeline_Event**
    - **Validates: Requirements 2.8**
    - After each valid status transition, query timeline for the assignee; assert exactly
      one `goal_status_changed` event with correct title and summary format
    - `# Feature: upms-pro-features, Property 11`

  - [ ] 5.8 Write unit tests for goal history edge cases
    - Test 403 when manager tries to approve goal of a non-report
    - Test 404 when goal_id not found
    - Test member cannot approve (403)
    - _Requirements: 2.3, 2.5, 2.6_

- [ ] 6. Checkpoint — timeline and goal history
  - Ensure all timeline and goal history tests pass, ask the user if questions arise.

- [ ] 7. Achievements service and API (Requirement 6)
  - [ ] 7.1 Create `app/services/achievement_service.py`
    - Implement `create_achievement(db, data, employee_id) → Achievement`:
      - Force `employee_id` from token (ignore any value in request body)
      - Validate `goal_id` if provided: 422 if goal not found; 422 if goal belongs to
        different employee
      - Validate `evidence_url` is HTTP/HTTPS if provided
      - Insert `Achievement` row
      - Call `timeline_service.emit` with `event_type=ACHIEVEMENT_LOGGED`,
        title = achievement title, summary = category value
    - Implement `list_achievements(db, requesting_user, employee_id=None)`:
      - Member: return own achievements ordered DESC `created_at`
      - Manager: if `employee_id` provided, check direct-manager (403); return that
        employee's achievements
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 6.6, 6.7_

  - [ ] 7.2 Create `app/schemas/achievement.py`
    - `AchievementCreate`: title (max_length=200, non-empty), description (max_length=2000,
      non-empty), category (AchievementCategory), evidence_url (HttpUrl nullable),
      goal_id (int nullable)
    - `AchievementResponse`: all Create fields + id, employee_id, created_at
    - _Requirements: 6.1_

  - [ ] 7.3 Create `app/routers/achievements.py`
    - `POST /api/v1/achievements` → 201 `AchievementResponse`; member only
    - `GET /api/v1/achievements` → list; member (own) or manager (with employee_id param)
    - Register NO `PUT`, `PATCH`, `DELETE` handlers; add a catch-all route for
      `/api/v1/achievements/{id}` that returns HTTP 405 for mutation methods
    - Register router in `app/main.py`
    - _Requirements: 6.4, 6.5, 6.6_

  - [ ] 7.4 Write property test for achievement employee_id override (Property 24)
    - **Property 24: Achievement employee_id is always the token user**
    - **Validates: Requirements 6.2**
    - Submit achievements with arbitrary `employee_id` values in the body; assert the
      persisted `employee_id` always equals the authenticated user's id
    - `# Feature: upms-pro-features, Property 24`

  - [ ] 7.5 Write property test for achievement append-only semantics (Property 25)
    - **Property 25: Achievement append-only semantics**
    - **Validates: Requirements 6.4**
    - For any achievement id, assert `PUT`, `PATCH`, `DELETE` all return HTTP 405
    - `# Feature: upms-pro-features, Property 25`

  - [ ] 7.6 Write property test for achievement ordering (Property 26)
    - **Property 26: Achievement ordering**
    - **Validates: Requirements 6.5**
    - Create N achievements; call GET; assert descending `created_at` order with no
      missing entries
    - `# Feature: upms-pro-features, Property 26`

  - [ ] 7.7 Write property test for achievement timeline emission (Property 27)
    - **Property 27: Achievement emits timeline event**
    - **Validates: Requirements 6.7**
    - After creating an achievement, query the employee timeline; assert exactly one
      `achievement_logged` event with matching title and category summary
    - `# Feature: upms-pro-features, Property 27`

  - [ ] 7.8 Write unit tests for achievement edge cases
    - Test 422 on non-existent `goal_id`
    - Test 422 when `goal_id` belongs to different employee
    - Test 422 on invalid `evidence_url` (non-HTTP scheme)
    - Test manager 403 when requesting non-direct-report's achievements
    - _Requirements: 6.3, 6.6_

- [ ] 8. Kudos service and API (Requirement 7)
  - [ ] 8.1 Create `app/services/kudos_service.py`
    - Implement `create_kudos(db, data, sender_id) → Kudos`:
      - 422 if `recipient_id == sender_id`
      - 422 if `recipient_id` user does not exist
      - Insert `Kudos` row
      - Call `timeline_service.emit` on the **recipient's** timeline with
        `event_type=KUDOS_RECEIVED`, title = `"Kudos from {sender_name}"`,
        summary = kudos message
    - Implement `get_feed(db, page, page_size) → paginated KudosResponse list`
      ordered DESC `created_at`, including `sender_name` and `recipient_name`
    - _Requirements: 7.1, 7.2, 7.4, 7.5_

  - [ ] 8.2 Create `app/schemas/kudos.py`
    - `KudosCreate`: recipient_id (int), message (max_length=500, non-empty)
    - `KudosResponse`: id, sender_id, sender_name, recipient_id, recipient_name,
      message, created_at
    - _Requirements: 7.1, 7.4_

  - [ ] 8.3 Create `app/routers/kudos.py`
    - `POST /api/v1/kudos` → 201 `KudosResponse`; any authenticated user
    - `GET /api/v1/kudos/feed` → paginated kudos feed; any authenticated user
    - Register NO `PUT`, `PATCH`, `DELETE` handlers; catch-all 405 for
      `/api/v1/kudos/{id}` mutation methods
    - Register router in `app/main.py`
    - _Requirements: 7.3, 7.4, 7.7_

  - [ ] 8.4 Write property test for kudos self-give guard (Property 28)
    - **Property 28: Kudos self-give guard**
    - **Validates: Requirements 7.1, 7.2**
    - For any authenticated user, assert POST with `recipient_id == sender_id` returns
      HTTP 422 with exact detail message and no record is persisted
    - `# Feature: upms-pro-features, Property 28`

  - [ ] 8.5 Write property test for kudos feed ordering (Property 29)
    - **Property 29: Kudos feed ordering**
    - **Validates: Requirements 7.4**
    - Create N kudos records; call feed endpoint; assert descending `created_at` order and
      each entry includes `sender_name` and `recipient_name`
    - `# Feature: upms-pro-features, Property 29`

  - [ ] 8.6 Write property test for kudos timeline event on recipient (Property 30)
    - **Property 30: Kudos emits timeline event on recipient**
    - **Validates: Requirements 7.5**
    - After creating a kudos, query recipient's timeline; assert exactly one
      `kudos_received` event with title `"Kudos from {sender_name}"` and correct summary;
      assert sender's timeline is unchanged
    - `# Feature: upms-pro-features, Property 30`

  - [ ] 8.7 Write unit tests for kudos edge cases
    - Test 405 on PUT/PATCH/DELETE
    - Test 422 on unknown recipient_id
    - _Requirements: 7.1, 7.3_

- [ ] 9. Checkpoint — achievements and kudos
  - Ensure all achievement and kudos tests pass, ask the user if questions arise.

- [ ] 10. Readiness service and dashboard API (Requirements 5 & 10)
  - [ ] 10.1 Create `app/services/readiness_service.py`
    - Implement `get_active_cycle(db) → ReviewCycle | None`: return the active cycle with
      the most recent `start_date`; if none, return `None` (lifetime mode)
    - Implement `evaluate_signals(db, employee_id, cycle) → list[bool]` for five signals:
      - Signal a: ≥1 active or completed goal in cycle period
      - Signal b: ≥1 progress update logged within cycle period
      - Signal c: ≥1 feedback record received in cycle period
      - Signal d: ≥1 achievement logged in cycle period
      - Signal e: self-assessment ReviewForm is `submitted`
      - When `cycle is None`, evaluate signals against lifetime data
    - Implement `compute_score(signals) → int`: `sum(signals) * 20`
    - Implement `build_prompts(signals, cycle) → list[str]`: for each `False` signal,
      include the exact prompt string from Req 10.2; if `self_review_deadline` within
      14 days, prepend `"⚠ Review deadline approaching — "` to each prompt
    - Implement `get_readiness(db, employee_id) → ReadinessResponse`
    - Implement `get_team_readiness(db, manager_id) → list[ReadinessResponse]` sorted
      ascending by score
    - Score is always computed fresh — no caching
    - _Requirements: 5.1, 5.2, 5.9, 10.1, 10.2, 10.3, 10.6_

  - [ ] 10.2 Create `app/schemas/readiness.py`
    - `ReadinessSignal`: name (str), passed (bool), label (str | None)
    - `ReadinessResponse`: score (int 0–100), signals (list[ReadinessSignal]),
      cycle_active (bool), prompts (list[str])
    - _Requirements: 5.3_

  - [ ] 10.3 Create `app/routers/readiness.py`
    - `GET /api/v1/readiness/team`: manager only; return list sorted by score; empty
      list if no direct reports
    - `GET /api/v1/readiness/{employee_id}`: manager for direct report or member for self;
      403 if requesting manager's non-direct-report; 404 if employee not found
    - Register router in `app/main.py`
    - _Requirements: 5.3, 5.4, 5.5, 5.10_

  - [ ] 10.4 Write property test for readiness score formula (Property 20)
    - **Property 20: Readiness score formula**
    - **Validates: Requirements 5.1, 10.1**
    - For all 2^5 signal combinations generated by Hypothesis, assert
      `score == sum(signals) * 20` and `score in {0, 20, 40, 60, 80, 100}`
    - `# Feature: upms-pro-features, Property 20`

  - [ ] 10.5 Write property test for team readiness sort order (Property 21)
    - **Property 21: Team readiness — sorted ascending by score**
    - **Validates: Requirements 5.5**
    - Create a manager with N direct reports with varying signals; call `/readiness/team`;
      assert scores are in non-decreasing order and length equals N
    - `# Feature: upms-pro-features, Property 21`

  - [ ] 10.6 Write property test for prompt strings count and text (Property 22)
    - **Property 22: Readiness prompt strings — exact text and count**
    - **Validates: Requirements 5.8, 10.2**
    - For any K failed signals (0 ≤ K ≤ 5), assert prompts array has exactly K strings
      each matching the specified exact text for its signal
    - `# Feature: upms-pro-features, Property 22`

  - [ ] 10.7 Write property test for deadline warning prefix (Property 23)
    - **Property 23: Deadline warning prefix**
    - **Validates: Requirements 10.6**
    - For an active cycle with `self_review_deadline` within 14 days, assert every
      prompt string begins with `"⚠ Review deadline approaching — "`
    - `# Feature: upms-pro-features, Property 23`

  - [ ] 10.8 Write unit tests for readiness edge cases
    - Test no-active-cycle returns `cycle_active: false` and uses lifetime data
    - Test multiple overlapping active cycles selects the most recent `start_date`
    - Test 404 on unknown `employee_id`
    - Test member redirected (403) if accessing another member's readiness
    - _Requirements: 5.2, 5.4, 5.10_

- [ ] 11. Cycle snapshot service — Manager of Record (Requirement 9)
  - [ ] 11.1 Create `app/services/cycle_snapshot_service.py`
    - Implement `snapshot_manager_of_record(db, cycle_id)`:
      - Load all `ReviewForm` rows for the given cycle
      - For each form, set `manager_of_record_id` to the employee's current `manager_id`
        (may be `null`)
      - Execute all updates atomically in one transaction; rollback entirely if any row
        fails — no form gets a partial snapshot
    - `manager_of_record_id` is written here and treated as read-only everywhere else
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ] 11.2 Wire `cycle_snapshot_service` into cycle activation
    - In `app/services/review_service.py` method `trigger_cycle()`, call
      `cycle_snapshot_service.snapshot_manager_of_record(db, cycle_id)` inside the same
      transaction immediately after setting cycle status to `active`
    - _Requirements: 9.2_

  - [ ] 11.3 Handle late-join members in cycle snapshot
    - When a new `ReviewForm` is generated for a member who joins after cycle activation
      (e.g., via admin endpoint), set `manager_of_record_id` to the member's current
      `manager_id` at form-generation time using the same null-handling rule
    - _Requirements: 9.4_

  - [ ] 11.4 Update `ReviewFormResponse` schema and review endpoints
    - Add `manager_of_record_id` (int | None) and `manager_of_record_name` (str | None) to
      `app/schemas/review.py` `ReviewFormResponse`
    - Resolve `manager_of_record_name` from `manager_of_record_id` FK (not from
      employee's current `manager_id`)
    - Admin dashboard: flag forms with `manager_of_record_id = null` with label
      "No manager assigned at cycle start"
    - _Requirements: 9.3, 9.5_

  - [ ] 11.5 Write property test for manager-of-record immutability (Property 31)
    - **Property 31: Manager-of-record immutability**
    - **Validates: Requirements 9.1, 9.5**
    - After cycle activation, change an employee's `manager_id`; assert
      `manager_of_record_id` on the ReviewForm remains the original value and API
      responses resolve the original manager name
    - `# Feature: upms-pro-features, Property 31`

  - [ ] 11.6 Write property test for cycle snapshot atomicity (Property 32)
    - **Property 32: Cycle snapshot atomicity**
    - **Validates: Requirements 9.2**
    - Simulate a partial DB failure mid-snapshot; assert either all forms have
      `manager_of_record_id` set or none do
    - `# Feature: upms-pro-features, Property 32`

  - [ ] 11.7 Write unit tests for cycle snapshot edge cases
    - Test member with `manager_id = null` produces form with `manager_of_record_id = null`
      and admin flag label
    - Test late-join member form uses current `manager_id` at generation time
    - _Requirements: 9.3, 9.4_

- [ ] 12. Checkpoint — readiness and cycle snapshot
  - Ensure readiness and cycle snapshot tests pass, ask the user if questions arise.

- [ ] 13. Self-assessment and Manager Final Voice as separate records (Requirement 4)
  - [ ] 13.1 Update `app/services/review_service.py` — enforce separate record rules
    - In `submit_form()`:
      - If `form_type == manager_feedback` and requesting user is `member` → raise 403
      - If `form_type == manager_feedback` and requesting user is not direct manager
        of the employee → raise 403 (use `is_direct_manager` from hierarchy_service)
      - If `form_type == self_assessment` and form status is already `submitted` →
        raise 422 (immutable after submission)
      - For `manager_feedback` submission: validate `comment` non-empty and
        `final_rating` in `[1, 5]`; raise 422 otherwise; set status to `submitted`,
        record `submitted_at`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ] 13.2 Implement review cross-share visibility rule
    - In review GET endpoints, enforce: member cannot see manager's `comment` or
      `final_rating` until the manager's `ReviewForm` reaches `submitted` status
    - When manager form is `submitted`, both forms become visible to manager and member
    - _Requirements: 4.6, 4.8_

  - [ ] 13.3 Write property test for separate form records (Property 16)
    - **Property 16: Separate review form records**
    - **Validates: Requirements 4.1**
    - For any activated cycle and eligible employee, assert exactly two ReviewForms
      exist — one `self_assessment` and one `manager_feedback` — and their content is
      never merged
    - `# Feature: upms-pro-features, Property 16`

  - [ ] 13.4 Write property test for self-assessment immutability after submission (Property 17)
    - **Property 17: Self-assessment immutability after submission**
    - **Validates: Requirements 4.2**
    - After a self-assessment is submitted, attempt another submit; assert error response
      and form content/status are unchanged
    - `# Feature: upms-pro-features, Property 17`

  - [ ] 13.5 Write property test for manager form validation (Property 18)
    - **Property 18: Manager form validation — comment and rating required**
    - **Validates: Requirements 4.3**
    - Submit manager forms with missing comment or `final_rating` outside `[1, 5]`; assert
      HTTP 422 and form status unchanged
    - `# Feature: upms-pro-features, Property 18`

  - [ ] 13.6 Write property test for manager content hidden until submission (Property 19)
    - **Property 19: Manager content hidden until submission**
    - **Validates: Requirements 4.8**
    - While manager form is not `submitted`, assert member's GET response contains no
      `comment` or `final_rating`
    - `# Feature: upms-pro-features, Property 19`

  - [ ] 13.7 Write unit tests for review form submission edge cases
    - Test member 403 on manager_feedback form
    - Test manager 403 on non-direct-report employee's form
    - _Requirements: 4.4, 4.5_

- [ ] 14. AI Draft service (Requirement 3)
  - [ ] 14.1 Add AI provider config to `app/config.py`
    - Add `ai_provider_url: str` and `ai_api_key: str` to the `Settings` pydantic model,
      read from environment variables `AI_PROVIDER_URL` and `AI_API_KEY`
    - _Requirements: 3.1_

  - [ ] 14.2 Create `app/services/ai_draft_service.py`
    - Implement `generate(db, form_id, requesting_user_id) → AIDraftResponse`:
      - 403 if requesting user role is `member`
      - Load `ReviewForm`; 404 if form not found or cycle not active
        (`status != active`)
      - Call `timeline_service.get_work_trail(db, employee_id, cycle)` to get all
        Goals, Progress, Feedback, Achievements, Kudos within the cycle date range
      - 422 if no active or completed goals in the period
      - Build prompt string from work trail; call AI provider via `httpx.AsyncClient`
        with 30-second timeout; 503 on any exception (timeout, HTTP error, parse error)
      - Ensure data isolation: only include records for the target employee
      - Only after full successful AI response: update `form.ai_draft = new_draft`
        and `form.citations = new_draft["citations"]` then `db.commit()` (atomic replace)
      - Return structured `AIDraftResponse`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ] 14.3 Create `app/schemas/ai_draft.py`
    - `Citation`: event_type (str), event_date (str ISO 8601), event_title (str),
      source_id (int)
    - `AIDraftResponse`: summary (str non-empty), strengths (list[str] min 2 items),
      growth_areas (list[str] min 1 item), suggested_rating (int 1–5),
      citations (dict[str, list[Citation]] — every key has ≥1 Citation)
    - _Requirements: 3.2, 3.4_

  - [ ] 14.4 Create `app/routers/ai_draft.py`
    - `POST /api/v1/reviews/forms/{form_id}/draft`: role guard (403 for member before
      any processing); delegate to `ai_draft_service.generate`
    - Register router in `app/main.py` under prefix `/api/v1/reviews`
    - _Requirements: 3.1, 3.3, 3.6, 3.7_

  - [ ] 14.5 Ensure citations are persisted on review submission
    - In `review_service.submit_form()`, preserve `form.citations` value as-is when
      manager submits; do not clear the field
    - _Requirements: 3.10_

  - [ ] 14.6 Write property test for AI draft structural constraints (Property 12)
    - **Property 12: AI draft structural constraints**
    - **Validates: Requirements 3.2, 3.4**
    - Mock AI provider to return random valid payloads via Hypothesis; assert every
      response has non-empty summary, ≥2 strengths, ≥1 growth area, rating in [1,5],
      and every citation key has ≥1 Citation object
    - `# Feature: upms-pro-features, Property 12`

  - [ ] 14.7 Write property test for AI draft data isolation (Property 13)
    - **Property 13: AI draft data isolation**
    - **Validates: Requirements 3.5**
    - Create two employees A and B with distinct work trails; generate draft for A; assert
      no `source_id` or event in any field or citation belongs to B's records
    - `# Feature: upms-pro-features, Property 13`

  - [ ] 14.8 Write property test for AI draft atomic replacement (Property 14)
    - **Property 14: AI draft atomic replacement**
    - **Validates: Requirements 3.8**
    - With a form that already has a stored draft, simulate an AI provider failure
      mid-generation; assert the original draft is unchanged (not partially overwritten)
    - `# Feature: upms-pro-features, Property 14`

  - [ ] 14.9 Write property test for citations persisted on submission (Property 15)
    - **Property 15: AI draft citations persisted on submission**
    - **Validates: Requirements 3.10**
    - After manager submits with a `citations` map, read the form back; assert citations
      map is byte-for-byte identical to what was submitted
    - `# Feature: upms-pro-features, Property 15`

  - [ ] 14.10 Write unit tests for AI draft edge cases
    - Test 503 on AI provider timeout (mock httpx timeout)
    - Test 422 on empty work trail (no active/completed goals)
    - Test 403 if requesting user is member
    - Test 404 if form_id doesn't exist or cycle isn't active
    - _Requirements: 3.1, 3.3, 3.6, 3.7_

- [ ] 15. Export service and API (Requirement 11)
  - [ ] 15.1 Create `app/services/export_service.py`
    - Implement `render(db, form_id, requesting_user_id) → tuple[str, str]` returning
      (html_string, filename):
      - 401 if unauthenticated (handled by FastAPI dependency)
      - Load manager ReviewForm (`form_type=manager_feedback`) for same employee/cycle;
        422 if it has not reached `submitted` status
      - 403 if requesting user is neither `employee_id` nor `manager_of_record_id`
      - Build self-contained HTML string with inline `<style>` block; no `src` or `href`
        pointing to external URLs
      - Include: employee name, cycle name + date range, `manager_of_record_name`,
        self-assessment text, manager comment, final rating, AI draft summary/strengths/
        growth areas with superscript citation markers, references section listing each
        cited event
      - Sanitize filename: replace every non-alphanumeric character in employee name and
        cycle name with underscores; format:
        `review_{employee_name}_{cycle_name}.html`
    - _Requirements: 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.10_

  - [ ] 15.2 Create `app/routers/export.py`
    - `GET /api/v1/reviews/forms/{form_id}/export`:
      - 401 if no valid JWT (via `get_current_user` dependency)
      - Delegate to `export_service.render`
      - Return `Response(content=html, media_type="text/html; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=\"{filename}\""})`
    - Register router in `app/main.py` under prefix `/api/v1/reviews`
    - _Requirements: 11.1, 11.3_

  - [ ] 15.3 Write property test for export 401 guard (Property 33)
    - **Property 33: Export requires authenticated user (401 guard)**
    - **Validates: Requirements 11.1**
    - For any valid `form_id`, call the export endpoint without a JWT; assert HTTP 401
    - `# Feature: upms-pro-features, Property 33`

  - [ ] 15.4 Write property test for export blocked before finalisation (Property 34)
    - **Property 34: Export blocked for non-finalised reviews**
    - **Validates: Requirements 11.4**
    - While manager form is not `submitted`, call export; assert HTTP 422 with exact
      detail message
    - `# Feature: upms-pro-features, Property 34`

  - [ ] 15.5 Write property test for export filename sanitization (Property 35)
    - **Property 35: Export filename sanitization**
    - **Validates: Requirements 11.3**
    - Generate arbitrary employee names and cycle names with non-alphanumeric characters;
      assert the `Content-Disposition` filename replaces every non-alphanumeric char with
      underscores in both segments
    - `# Feature: upms-pro-features, Property 35`

  - [ ] 15.6 Write property test for export HTML self-contained (Property 36)
    - **Property 36: Export HTML self-contained**
    - **Validates: Requirements 11.10**
    - Parse returned HTML; assert no `src` or `href` attribute contains an external URL;
      assert all styling is inline or within a `<style>` block in `<head>`
    - `# Feature: upms-pro-features, Property 36`

  - [ ] 15.7 Write unit tests for export access control
    - Test 403 when neither employee nor manager_of_record requests
    - Test 200 for employee requesting own review
    - Test 200 for manager_of_record requesting their review
    - _Requirements: 11.5, 11.6, 11.7_

- [ ] 16. Checkpoint — AI draft and export
  - Ensure all AI draft and export tests pass, ask the user if questions arise.

- [ ] 17. Frontend API modules (all 11 features)
  - [ ] 17.1 Create `frontend/src/api/timeline.js`
    - `getTimeline(employeeId, params)`: GET `/api/v1/timeline/{employeeId}` with query
      params (type, start_date, end_date, page, page_size) via `apiClient`
    - `exportTimeline(employeeId)`: GET `/api/v1/timeline/{employeeId}/export` with
      `responseType: 'blob'`; trigger browser download via `URL.createObjectURL`
    - _Requirements: 1.1, 1.10_

  - [ ] 17.2 Create `frontend/src/api/achievements.js`
    - `createAchievement(data)`: POST `/api/v1/achievements`
    - `getAchievements(params)`: GET `/api/v1/achievements` with optional `employee_id`
    - _Requirements: 6.5, 6.6_

  - [ ] 17.3 Create `frontend/src/api/kudos.js`
    - `createKudos(data)`: POST `/api/v1/kudos`
    - `getKudosFeed(page)`: GET `/api/v1/kudos/feed?page={page}&page_size=50`
    - _Requirements: 7.4, 7.7_

  - [ ] 17.4 Create `frontend/src/api/readiness.js`
    - `getReadiness(employeeId)`: GET `/api/v1/readiness/{employeeId}`
    - `getTeamReadiness()`: GET `/api/v1/readiness/team`
    - _Requirements: 5.3, 5.5_

  - [ ] 17.5 Create `frontend/src/api/aiDraft.js`
    - `generateDraft(formId)`: POST `/api/v1/reviews/forms/{formId}/draft`
    - Handle 503 response: throw error with message `"Draft generation temporarily
      unavailable; please try again"` for caller to surface as toast
    - _Requirements: 3.1_

  - [ ] 17.6 Create `frontend/src/api/exportApi.js`
    - `exportReview(formId)`: GET `/api/v1/reviews/forms/{formId}/export` with
      `responseType: 'blob'`; trigger browser download
    - Handle errors: throw error with message `"Export failed — please try again"`
    - _Requirements: 11.1, 11.9_

  - [ ] 17.7 Update `frontend/src/api/index.js` to re-export all new modules
    - _Requirements: all_

- [ ] 18. Frontend — Timeline page (Requirement 1)
  - [ ] 18.1 Create `frontend/src/pages/Timeline.jsx`
    - On mount, detect role: member fetches own timeline; manager gets an employee
      picker (from `GET /api/v1/users` filtered to direct reports) then fetches selected
      employee's timeline
    - Filter bar: type dropdown (nine values + "All"), start/end date pickers using
      `date-fns`, paginator component
    - Render events as a vertical `<ol>` with one distinct `lucide-react` icon per
      `event_type` (e.g., Target → goal, Star → achievement, Heart → kudos)
    - "Export CSV" button calls `exportTimeline(employeeId)` → browser download via Blob
    - Handle 403 with `toast.error("You don't have permission to do that")`
    - _Requirements: 1.1, 1.7, 1.8, 1.9, 1.10_

  - [ ] 18.2 Add `/timeline` route and nav link in `App.jsx` and `Layout.jsx`
    - Route accessible to members (own) and managers; guard via `<ProtectedRoute>`
    - _Requirements: 1.2, 1.3_

- [ ] 19. Frontend — Goal History UI (Requirement 2)
  - [ ] 19.1 Update `frontend/src/pages/GoalDetail.jsx`
    - Add status badge rendering the current `GoalStatus` value with colour-coded pill
      (e.g., active = green, rejected = red, archived = gray)
    - Fetch `GET /api/v1/goals/{goalId}/history` and render a vertical timeline below
      goal details showing date, actor name, new status badge, and comment (if any)
    - _Requirements: 2.1, 2.7_

  - [ ] 19.2 Add approve/reject/archive controls for managers in `GoalDetail.jsx`
    - Show "Approve" and "Reject" buttons only if current user is a manager of the
      goal's assignee and goal status is `pending_approval`
    - Both actions open a `Dialog` requiring a non-empty comment (React Hook Form
      validation); submit via `POST /api/v1/goals/{id}/approve`
    - Show "Archive" button for managers or goal owner; open `Dialog` requiring
      non-empty `archive_reason`; submit via `POST /api/v1/goals/{id}/archive`
    - Display field-level errors inline via React Hook Form `setError` on 422 responses
    - _Requirements: 2.3, 2.4, 2.5, 2.6_

- [ ] 20. Frontend — Achievements page (Requirement 6)
  - [ ] 20.1 Create `frontend/src/pages/Achievements.jsx`
    - Fetch and render member's achievements as cards showing: title, category
      `<Badge>` (shadcn), description (truncated), date logged, evidence link (if
      present, opens in new tab), linked goal title (if present)
    - "Log Achievement" button opens a shadcn `Sheet` with React Hook Form:
      title input (max 200), description textarea (max 2000), category `<Select>`,
      evidence_url input (optional), goal picker `<Select>` (from user's goals)
    - On success, prepend new achievement to list state; show `toast.success`
    - No edit/delete controls rendered
    - _Requirements: 6.1, 6.9_

  - [ ] 20.2 Add `/achievements` route in `App.jsx`
    - Member-only via `<ProtectedRoute>`; redirect managers to `/dashboard` if they
      navigate here without `employee_id` context
    - _Requirements: 6.9_

- [ ] 21. Frontend — Kudos feed page (Requirement 7)
  - [ ] 21.1 Create `frontend/src/pages/Kudos.jsx`
    - Fetch page 1 of kudos feed on mount; render each entry: sender name → recipient
      name, message, relative date via `date-fns formatDistanceToNow`
    - "Load more" button appends next page to feed state
    - "Give Kudos" button opens a shadcn `Dialog`: recipient searchable `Combobox`
      (from `GET /api/v1/users`), message `Textarea` (max 500 chars)
    - On success, prepend new kudos to feed state (optimistic update); show
      `toast.success`; handle 422 (self-kudos) with `toast.error`
    - _Requirements: 7.4, 7.7, 7.8_

  - [ ] 21.2 Add `/kudos` route in `App.jsx` accessible to all authenticated users
    - _Requirements: 7.7_

- [ ] 22. Frontend — Readiness Dashboard page (Requirements 5 & 10)
  - [ ] 22.1 Create `frontend/src/pages/Readiness.jsx`
    - Fetch `GET /api/v1/readiness/team` on mount; render one card per direct report
      sorted ascending by score
    - Score badge: Tailwind `bg-red-100 text-red-700` (0–39), `bg-amber-100
      text-amber-700` (40–69), `bg-green-100 text-green-700` (70–100) with percentage
    - Five signal icons per card: filled `CheckCircle` (passed) / hollow `Circle`
      (failed) from `lucide-react`
    - Expandable section per card shows prompt strings; when `self_review_deadline`
      within 14 days, show ⚠️ banner at top of prompts
    - _Requirements: 5.7, 5.8_

  - [ ] 22.2 Add route guard for `/readiness` in `App.jsx`
    - If role is `member`, redirect to `/`; if role is `admin`, redirect to `/admin`
    - _Requirements: 5.6_

  - [ ] 22.3 Add "Review Readiness" card to `frontend/src/pages/Dashboard.jsx`
    - New section for members: call `GET /api/v1/readiness/{currentUserId}` on page load
    - Display score as a ring/progress indicator with colour coding
    - List prompt strings below; if score is 100, show "You are review-ready — great
      work!" text instead
    - Renders regardless of whether an active cycle exists
    - _Requirements: 10.3, 10.4_

- [ ] 23. Frontend — Review Studio page (Requirements 3, 4, 11)
  - [ ] 23.1 Create `frontend/src/pages/ReviewStudio.jsx` — layout and data loading
    - Route: `/review-studio/:formId`; manager only
    - On mount, fetch `GET /api/v1/review-forms/{formId}` for form data (including
      manager_of_record_name, ai_draft, citations, employee self-assessment)
    - Two-column layout: left panel for AI draft, right panel for Evidence Sidebar
    - Bottom area: self-assessment read-only panel with distinct `bg-muted` background,
      manager comment `<textarea>` (React Hook Form), 1–5 star rating selector, Submit
      and Export buttons
    - _Requirements: 3.9, 4.7_

  - [ ] 23.2 Implement AI draft left panel in `ReviewStudio.jsx`
    - Display summary paragraph, strengths list, growth areas list, each with
      superscript citation markers (`[1]`, `[2]`, etc.)
    - "Regenerate Draft" button calls `generateDraft(formId)`; show loading spinner;
      on 503 show `toast.error("Draft generation temporarily unavailable; please try
      again")`; on 422 (no goals) show dismissible banner but keep form editable
    - _Requirements: 3.6, 3.9_

  - [ ] 23.3 Implement Evidence Sidebar right panel in `ReviewStudio.jsx`
    - List each cited `TimelineEvent` as a card: event-type icon, date, title, summary
    - When a citation marker in the left panel is clicked, scroll the sidebar to and
      highlight the corresponding event card using `useRef` + `scrollIntoView`
    - _Requirements: 3.9_

  - [ ] 23.4 Implement manager submit and export in `ReviewStudio.jsx`
    - Submit button: validate comment non-empty and rating 1–5 (React Hook Form);
      POST to `/api/v1/review-forms/{formId}/submit`; show 422 field errors inline
    - Export button: enabled only when `form.status === "submitted"`; disabled otherwise;
      calls `exportReview(formId)` → browser download; on error show
      `toast.error("Export failed — please try again")` with no navigation
    - _Requirements: 4.3, 11.8, 11.9_

  - [ ] 23.5 Add `/review-studio/:formId` route in `App.jsx`
    - Manager only via `<ProtectedRoute requireManager>`
    - _Requirements: 3.1_

- [ ] 24. Checkpoint — frontend pages
  - Ensure all frontend pages render correctly in the browser and API calls succeed.
  - Manually smoke-test the main flows: log achievement, give kudos, view timeline,
    view readiness dashboard, generate AI draft, submit manager review, export review.
  - Ask the user if questions arise.

- [ ] 25. Skip-level visibility enforcement (Requirement 8)
  - [ ] 25.1 Apply `hierarchy_service.can_read` to all read endpoints
    - Ensure `GET /api/v1/timeline/{employee_id}`, `GET /api/v1/goals` (employee filter),
      `GET /api/v1/achievements?employee_id`, `GET /api/v1/readiness/{employee_id}`, and
      `GET /api/v1/review-forms` all call `can_read` and return 403 when it returns False
    - Verify write endpoints (`approve`, `archive`, `submit`) use `is_direct_manager`
      (one hop only) and return 403 with `"Action requires direct manager relationship"`
      for skip-level managers
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ] 25.2 Ensure `manager_id` chain is evaluated at query time without caching
    - Confirm no in-memory hierarchy cache is used in `hierarchy_service`; each API
      call re-queries the `users` table for the chain
    - _Requirements: 8.5_

  - [ ] 25.3 Write unit tests for skip-level read vs write boundary
    - Test skip-level manager reads timeline of a 2-hop subordinate → 200
    - Test skip-level manager attempts to approve a goal of 2-hop subordinate → 403
    - Test hierarchy updates reflect immediately on next request
    - _Requirements: 8.2, 8.3, 8.5_

- [ ] 26. Wire emit calls into existing event sources
  - [ ] 26.1 Emit `goal_created` in `app/services/goal.py` (or goals router) on goal creation
    - Call `timeline_service.emit(db, employee_id, GOAL_CREATED, goal.title, ...)`
    - _Requirements: 1.1_

  - [ ] 26.2 Emit `goal_approved` / `goal_completed` / `goal_archived` from goal lifecycle
    - In existing goal status transitions (approve, complete), call `timeline_service.emit`
      with appropriate `event_type`
    - _Requirements: 1.1_

  - [ ] 26.3 Emit `progress_updated` from progress update endpoint
    - In `app/routers/goals.py` or progress service, call `timeline_service.emit` with
      `event_type=PROGRESS_UPDATED`, title = goal title, summary = progress note
    - _Requirements: 1.1_

  - [ ] 26.4 Emit `feedback_submitted` from feedback service
    - In `app/services/feedback.py` after persisting a feedback record, call
      `timeline_service.emit` on the recipient employee's timeline
    - _Requirements: 1.1_

  - [ ] 26.5 Emit `checkin_submitted` from check-in submission path (if exists)
    - If a check-in/1:1 submission endpoint exists, hook in `timeline_service.emit`
    - If it does not exist, create a stub that can be wired when the feature lands
    - _Requirements: 1.1_

- [ ] 27. Final checkpoint — full integration
  - Ensure all 36 property tests and all unit tests pass (`pytest backend/gms-backend/tests/`)
  - Verify `alembic upgrade head` applies cleanly
  - Confirm all new routers are registered in `app/main.py`
  - Confirm all new frontend API modules are re-exported from `src/api/index.js`
  - Confirm all new routes appear in `App.jsx` with correct role guards
  - Ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use Hypothesis (`@given`, `@settings(max_examples=100)`) and live in
  `backend/gms-backend/tests/`; tag each test with
  `# Feature: upms-pro-features, Property {N}: {property_text}`
- All backend code in `backend/gms-backend/app/`; **do not** modify `backend/app/`
- All frontend code in `frontend/src/`; all API calls go through `apiClient.js`
- The `manager_of_record_id` field is set once by `cycle_snapshot_service` and treated
  as read-only by every other service; never write to it outside that service
- Append-only resources (Achievements, Kudos) must have no `PUT`/`PATCH`/`DELETE`
  handlers registered; use a catch-all route returning 405
- AI provider is mocked in all tests using `unittest.mock.patch` or pytest fixtures


## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5"] },
    { "id": 1, "tasks": ["1.6", "1.7"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4", "4.1", "4.2", "5.1", "5.2", "7.1", "7.2", "8.1", "8.2", "10.1", "10.2", "11.1", "14.1"] },
    { "id": 4, "tasks": ["4.3", "5.3", "7.3", "8.3", "10.3", "11.2", "11.3", "11.4", "14.2", "14.3"] },
    { "id": 5, "tasks": ["4.4", "4.5", "4.6", "4.7", "4.8", "4.9", "4.10", "5.4", "5.5", "5.6", "5.7", "5.8", "7.4", "7.5", "7.6", "7.7", "7.8", "8.4", "8.5", "8.6", "8.7", "10.4", "10.5", "10.6", "10.7", "10.8", "11.5", "11.6", "11.7", "13.1", "14.4"] },
    { "id": 6, "tasks": ["13.2", "13.3", "13.4", "13.5", "13.6", "13.7", "14.5", "14.6", "14.7", "14.8", "14.9", "14.10", "15.1"] },
    { "id": 7, "tasks": ["15.2", "15.3", "15.4", "15.5", "15.6", "15.7", "17.1", "17.2", "17.3", "17.4", "17.5", "17.6"] },
    { "id": 8, "tasks": ["17.7", "25.1", "25.2", "26.1", "26.2", "26.3", "26.4", "26.5"] },
    { "id": 9, "tasks": ["18.1", "19.1", "20.1", "21.1", "22.1", "22.3", "25.3"] },
    { "id": 10, "tasks": ["18.2", "19.2", "20.2", "21.2", "22.2", "23.1"] },
    { "id": 11, "tasks": ["23.2", "23.3"] },
    { "id": 12, "tasks": ["23.4", "23.5"] }
  ]
}
```
