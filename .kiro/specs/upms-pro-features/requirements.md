# Requirements Document

## Introduction

This document specifies the requirements for UPMS Pro Features — eleven capabilities that transform
the Unified Performance Management Platform into an **evidence-first performance system**. The core
differentiator: capture work continuously, then auto-assemble it into a believable, citable review.
Every review line must be backed by evidence from the year, not memory from the last week.

Market context: Lattice, 15Five, and Culture Amp all have goals and reviews. None of them fully own
the exact wedge — "the review is assembled from the evidence trail, with every claim cited back to a
real event." That is the sharpest angle for this build.

These requirements build on the existing FastAPI + React + PostgreSQL foundation (goal CRUD, review
cycles, JWT auth, RBAC) without re-specifying what already exists.

---

## Glossary

- **Achievement**: An immutable, employee-submitted record of a work outcome, tagged with a category and optionally linked to a Goal.
- **AchievementCategory**: One of five values: `technical_impact`, `cost_savings`, `delivery`, `leadership`, `collaboration`.
- **Admin**: A user with role `admin` — configures review cycles, manages the system. Cannot edit goals, feedback entries, or ratings.
- **AI_Draft_Generator**: The backend service that composes a structured review draft from a Member's Work_Trail, citing the specific Timeline_Events that support each claim.
- **Citation**: A reference embedded in the AI_Draft linking a specific claim back to the Timeline_Event(s) that support it.
- **Evidence_Sidebar**: The panel in the Review_Studio listing the specific Timeline_Events cited in the AI draft.
- **Kudos**: A public, append-only positive recognition record created by any user for any other user.
- **Manager**: A user with role `manager` — approves goals, writes final review comments, selects ratings for direct reports only.
- **Manager_of_Record**: The `manager_id` value snapshotted onto a ReviewForm at cycle activation, preserved immutably for historical accuracy.
- **Member**: A user with role `member` — creates goals, logs achievements, writes self-assessments.
- **Performance_Timeline**: A unified, append-only, chronological feed of all performance-relevant events for a single Member.
- **Readiness_Dashboard**: The manager-facing page showing review readiness status for every direct report.
- **Readiness_Score**: An integer percentage (0–100) computed from five equally-weighted signals.
- **Readiness_Calculator**: The backend service that computes the Readiness_Score.
- **Review_Studio**: The frontend page where a Manager views the AI_Draft with citations, adds a final comment, selects a rating, and submits.
- **Skip_Level_Manager**: A Manager whose direct reports are themselves Managers; has read-only visibility into their reports' reports.
- **System**: The UPMS backend (FastAPI) and frontend (React) collectively, unless a specific layer is named.
- **Timeline_Event**: A single entry in the Performance_Timeline; has `id`, `type`, `timestamp`, `title`, `summary`, and `source_id`.
- **Work_Trail**: The complete set of Goals, Progress updates, Feedback records, Achievements, and Kudos associated with a Member within a review period.

---

## Requirements

---

### Requirement 1: Unified Performance Timeline

**User Story:** As a Member, I want a single chronological feed of every performance-relevant event in my record, so that I can see my complete work trail and understand what evidence will feed my review. As a Manager, I want to view a direct report's timeline to assess evidence quality before writing a review.

#### Acceptance Criteria

1. THE System SHALL persist Timeline_Events and expose a `GET /api/v1/timeline/{employee_id}` endpoint aggregating the following nine event types for the specified Member into a list ordered by descending `timestamp`: `goal_created`, `goal_approved`, `goal_completed`, `goal_archived`, `progress_updated`, `feedback_submitted`, `achievement_logged`, `kudos_received`, `checkin_submitted`.
2. WHEN a Member requests their own timeline (`employee_id` equals the authenticated user's `id`), THE System SHALL return all Timeline_Events with HTTP status 200.
3. WHEN a Manager requests the timeline for a direct report (a Member whose `manager_id` equals the requesting Manager's `id`), THE System SHALL return that Member's full timeline with HTTP status 200.
4. WHEN a Skip_Level_Manager requests the timeline for a Member anywhere in their management chain, THE System SHALL return that Member's timeline with HTTP status 200.
5. IF the `employee_id` in the path does not correspond to any user in the system, THEN THE System SHALL return HTTP status 404.
6. IF a user requests the timeline of a Member who is neither themselves, their direct report, nor anywhere in their management chain, THEN THE System SHALL return HTTP status 403.
7. WHEN the timeline endpoint is called with a `type` query parameter, THE System SHALL match the value case-insensitively and return only matching Timeline_Events; IF the `type` value is not one of the nine valid types, THE System SHALL return HTTP status 422 with the list of valid values.
8. WHEN the timeline endpoint is called with `start_date` and/or `end_date` query parameters in `YYYY-MM-DD` format, THE System SHALL apply an inclusive date filter; a single bound applies no constraint on the other end; IF either parameter is not a valid `YYYY-MM-DD` date, THE System SHALL return HTTP status 422.
9. WHEN the timeline endpoint is called with `page` (default 1) and `page_size` (default 50, max 200) query parameters, THE System SHALL return the requested page and include `total_count`, `page`, and `page_size` in the response envelope; IF `page` or `page_size` is out of range, THE System SHALL return HTTP status 422.
10. THE System SHALL expose a `GET /api/v1/timeline/{employee_id}/export` endpoint; WHEN called by an authorized user, THE System SHALL return all Timeline_Events as a UTF-8 CSV with a header row and columns `timestamp`, `type`, `title`, `summary`, and set `Content-Disposition: attachment; filename="timeline_{employee_id}_{YYYY-MM-DD}.csv"` where the date is the UTC calendar date of the request; IF the requesting user lacks read access per criteria 2–6, THE System SHALL return HTTP status 403.


---

### Requirement 2: Goal Lifecycle with Full Status Visibility

**User Story:** As a Member, I want to see every goal's current status and its full transition history so I have a transparent audit trail. As a Manager, I want to approve, reject, or archive goals with a comment so every decision is recorded.

#### Acceptance Criteria

1. THE System SHALL display a status badge on every Goal showing the current `GoalStatus` value in the Goals list and Goal Detail pages.
2. THE System SHALL expose a `GET /api/v1/goals/{goal_id}/history` endpoint returning an ordered list of all status transitions, each containing: `from_status`, `to_status`, `actor_id`, `actor_name`, `timestamp`, and `comment`.
3. WHEN a Manager approves or rejects a Goal in `pending_approval` status, THE System SHALL require a non-empty `comment` in the request body; IF the comment is absent or whitespace-only, THE System SHALL return HTTP status 422 and SHALL NOT persist the transition.
4. WHEN a Member requests archival of one of their own Goals, THE System SHALL require a non-empty `archive_reason`; IF absent or whitespace-only, THE System SHALL return HTTP status 422 and SHALL NOT archive the goal.
5. WHEN a Manager archives a Goal belonging to one of their direct reports, THE System SHALL require a non-empty `archive_reason`; the archived transition SHALL be recorded in the goal history with the Manager's `id` as `actor_id`.
6. IF a Manager attempts to approve, reject, or archive a Goal that belongs to a Member who is NOT their direct report, THEN THE System SHALL return HTTP status 403.
7. THE Goal Detail page SHALL render the status transition history as a vertical timeline showing each transition's date, actor name, new status, and comment (if any).
8. WHEN a Goal transitions to any status, THE System SHALL append a `goal_status_changed` Timeline_Event to the assignee's Performance_Timeline with `title` set to the goal title and `summary` set to `"{from_status} → {to_status} — {comment}"`.

---

### Requirement 3: Evidence-Backed AI Review Draft

**User Story:** As a Manager, I want an AI-generated review draft that cites the specific work events supporting every claim, so that the review is credible and defensible rather than based on recollection. This is the core differentiator: "every review line is backed by evidence from the year, not memory from the last week."

#### Acceptance Criteria

1. THE System SHALL expose a `POST /api/v1/reviews/forms/{form_id}/draft` endpoint accessible to users with role `manager` or `admin`; IF the requesting user has role `member`, THE System SHALL return HTTP status 403 before any AI processing begins.
2. WHEN a Manager calls the draft endpoint for a ReviewForm in an active ReviewCycle, THE AI_Draft_Generator SHALL produce a structured draft containing: an overall summary paragraph, a strengths list (minimum 2 items), a growth areas list (minimum 1 item), a suggested numeric rating (1–5), and a `citations` map.
3. IF the `form_id` does not belong to a ReviewForm in an active ReviewCycle (`status = active`), THEN THE System SHALL return HTTP status 404 with `{"detail": "ReviewForm not found or cycle is not active"}`.
4. THE `citations` map SHALL be a JSON object where each key is a claim string from the summary, strengths, or growth areas, and each value is an array of Citation objects; each Citation SHALL contain `event_type`, `event_date` (ISO 8601), `event_title`, and `source_id`; THE AI_Draft_Generator SHALL NOT produce any claim without at least one Citation.
5. WHEN the AI_Draft_Generator is invoked, THE AI_Draft_Generator SHALL source all input data exclusively from Timeline_Events belonging to the Member identified by `ReviewForm.employee_id` within the ReviewCycle's `start_date` to `end_date` inclusive; data from other Members SHALL NOT appear in any draft field or Citation.
6. WHEN the Work_Trail for a Member contains zero active or completed Goals within the review period, THE AI_Draft_Generator SHALL return HTTP status 422 with `{"detail": "Insufficient evidence: no completed or active goals found for this employee in the review period"}`; THE Review_Studio SHALL display this as a dismissible banner and SHALL still allow the Manager to write comments and select a rating manually.
7. IF the AI provider returns an error or the request exceeds 30 seconds, THEN THE AI_Draft_Generator SHALL return HTTP status 503 with `{"detail": "Draft generation temporarily unavailable; please try again"}` without persisting any partial draft.
8. WHEN a Manager calls the draft endpoint for a form with an existing draft, THE AI_Draft_Generator SHALL regenerate the draft atomically (replacing the old draft only after the new one is fully written) using the current Work_Trail including all Goals, Progress records, Feedback, Achievements, and Kudos added since the prior generation.
9. THE Review_Studio SHALL display the Evidence_Sidebar alongside the draft; the Evidence_Sidebar SHALL list each cited Timeline_Event as a card showing event type icon, date, title, and summary; WHEN a Manager clicks a citation marker in the draft text, THE Review_Studio SHALL scroll the Evidence_Sidebar to and highlight the corresponding event card.
10. WHEN a Manager submits the finalised review, THE System SHALL persist the `citations` map alongside the manager comment and final rating so citation data is available for export and audit.


---

### Requirement 4: Self-Assessment and Manager Final Voice as Separate Records

**User Story:** As an employee, I want my self-assessment to appear as my own distinct voice, not merged into the manager's text. As a Manager, I want my final comment and rating to appear clearly as mine. As a viewer of the completed review, I want to see both voices side by side once the manager submits.

#### Acceptance Criteria

1. THE System SHALL store self-assessment content on the ReviewForm with `form_type = self_assessment` and manager final content on a separate ReviewForm with `form_type = manager_feedback` for the same `employee_id` and `review_cycle_id`; the two records SHALL NOT be merged at any point.
2. WHEN a Member submits their self-assessment, THE System SHALL set the form's `status` to `submitted` and record `submitted_at`; the Member SHALL NOT be able to edit or resubmit the self-assessment after it reaches `submitted` status.
3. WHEN a Manager submits the manager ReviewForm, THE System SHALL require a non-empty `comment` and a `final_rating` integer between 1 and 5 inclusive; IF either is missing or out of range, THE System SHALL return HTTP status 422 without changing the form's status.
4. IF a user with role `member` attempts to submit or modify a ReviewForm with `form_type = manager_feedback`, THEN THE System SHALL return HTTP status 403.
5. IF a Manager attempts to submit a ReviewForm for an employee who is NOT their direct report, THEN THE System SHALL return HTTP status 403.
6. WHEN a Manager's ReviewForm reaches `submitted` status, THE System SHALL make both the self-assessment content and the manager's comment and rating visible to both the Manager and the Member.
7. THE Review_Studio SHALL render the employee's self-assessment text as read-only in a visually distinct panel (different background or border colour) before the Manager's editable comment area; the two SHALL NOT be merged into a single field.
8. WHEN a Member views a completed review, THE System SHALL display the self-assessment under "Employee Self-Assessment" and the manager content under "Manager Review" in clearly labelled sections; THE System SHALL NOT show the manager's comment or rating to the Member before the manager ReviewForm reaches `submitted` status.

---

### Requirement 5: Review Readiness Dashboard

**User Story:** As a Manager, I want a single page showing which direct reports are review-ready, which are missing evidence, and which are overdue, so I can act before the cycle closes rather than discovering gaps on submission day.

#### Acceptance Criteria

1. THE Readiness_Calculator SHALL compute the Readiness_Score as an integer percentage (0–100) using five equally-weighted signals worth 20 points each: (a) at least one active or completed Goal exists, (b) at least one Progress update was logged within the cycle period, (c) at least one Feedback record was received, (d) at least one Achievement was logged, (e) the self-assessment ReviewForm is in `submitted` status.
2. WHEN an active ReviewCycle exists (status = `active` with a date range overlapping today), THE Readiness_Calculator SHALL scope all five signals to events within that cycle's `start_date` and `end_date`; IF multiple active cycles overlap, THE Readiness_Calculator SHALL use the cycle with the most recent `start_date`; WHEN no active ReviewCycle exists, THE Readiness_Calculator SHALL compute against lifetime data and return `"cycle_active": false`.
3. THE System SHALL expose a `GET /api/v1/readiness/{employee_id}` endpoint returning: `score` (integer 0–100), `signals` (array of five objects each with `name`, `passed` boolean, and `label` prompt string for failed signals), and `cycle_active` (boolean).
4. WHEN a Manager calls `GET /api/v1/readiness/{employee_id}` for a direct report, THE System SHALL return the full readiness payload; IF the requested employee is not the Manager's direct report, THE System SHALL return HTTP status 403.
5. THE System SHALL expose a `GET /api/v1/readiness/team` endpoint for users with role `manager`; THE System SHALL return one readiness payload per direct report sorted ascending by `score`; IF the Manager has no direct reports, THE System SHALL return an empty array.
6. THE Readiness_Dashboard page (`/readiness`) SHALL be accessible to Managers only; IF a Member navigates to `/readiness`, THE System SHALL redirect to `/dashboard`; IF an Admin navigates to `/readiness`, THE System SHALL redirect to `/admin`.
7. THE Readiness_Dashboard SHALL render one card per direct report showing: employee name, Readiness_Score percentage with colour-coded indicator (0–39 red, 40–69 amber, 70–100 green), a row of five signal icons (filled when passed, hollow when failed), and the prompt text for each failed signal.
8. THE prompt labels SHALL be: (a) "No active or completed goal this cycle — create or activate one", (b) "No progress update in 30 days — add one now", (c) "No feedback received this cycle — request feedback from your manager", (d) "No achievements logged this cycle — log at least one", (e) "Self-assessment not yet submitted — submit before the deadline".
9. THE Readiness_Calculator SHALL compute the score fresh on every API call; no result SHALL be cached between requests.
10. IF the requested `employee_id` does not exist, THEN THE System SHALL return HTTP status 404 with `{"detail": "Employee not found"}`.


---

### Requirement 6: Achievements and Evidence Log

**User Story:** As a Member, I want to log work achievements with a category, description, and optional evidence link so I have a structured, append-only record my manager and the AI draft can reference.

#### Acceptance Criteria

1. THE System SHALL persist an Achievement with: `id`, `employee_id` (FK Users), `title` (non-empty, max 200 chars), `description` (non-empty, max 2000 chars), `category` (one of `technical_impact`, `cost_savings`, `delivery`, `leadership`, `collaboration`), `evidence_url` (nullable; if provided, must be a valid HTTP/HTTPS URL), `goal_id` (nullable FK Goals), `created_at` (UTC timestamp, set at creation, immutable).
2. WHEN a Member submits a new Achievement, THE System SHALL set `employee_id` to the authenticated user's `id` regardless of any `employee_id` in the request body.
3. WHEN a Member provides a `goal_id` that does not exist, THE System SHALL return HTTP status 422 with `{"detail": "Goal not found"}`; WHEN a Member provides a `goal_id` for a Goal whose `assignee_id` does not match the Member's `id`, THE System SHALL return HTTP status 422 with `{"detail": "Goal does not belong to this employee"}`.
4. THE System SHALL enforce append-only semantics: once created, an Achievement SHALL NOT be updated or deleted by any role including Admin; IF a `PUT`, `PATCH`, or `DELETE` is called on an Achievement, THE System SHALL return HTTP status 405.
5. WHEN a Member calls `GET /api/v1/achievements`, THE System SHALL return all their Achievements ordered by descending `created_at`.
6. WHEN a Manager calls `GET /api/v1/achievements?employee_id={id}` for a direct report, THE System SHALL return that Member's Achievements ordered by descending `created_at`; IF the `employee_id` is not the Manager's direct report, THE System SHALL return HTTP status 403.
7. THE System SHALL emit an `achievement_logged` Timeline_Event for every new Achievement with `title` equal to the Achievement's `title` and `summary` equal to the `category` value.
8. WHEN the AI_Draft_Generator constructs a review draft, THE AI_Draft_Generator SHALL include all Achievement records for the Member within the review period as input context and SHALL produce at least one Citation referencing an Achievement when at least one Achievement exists in the period.
9. THE Achievements page (`/achievements`) SHALL be accessible to Members and SHALL display each Achievement as a card showing title, category badge, description, date logged, evidence link (if present), and linked goal title (if present).

---

### Requirement 7: Kudos and Recognition Feed

**User Story:** As any user, I want to give a public shout-out to a colleague so that positive moments are captured continuously as evidence. As a recipient, I want kudos to appear in my timeline so the AI draft can cite them.

#### Acceptance Criteria

1. THE System SHALL persist a Kudos record with: `id`, `sender_id` (FK Users), `recipient_id` (FK Users, must differ from `sender_id`), `message` (non-empty, max 500 chars), `created_at` (UTC timestamp, immutable).
2. WHEN a user submits a Kudos with `recipient_id` equal to their own `id`, THE System SHALL return HTTP status 422 with `{"detail": "Cannot give kudos to yourself"}`.
3. THE System SHALL enforce append-only semantics for Kudos: IF a `PUT`, `PATCH`, or `DELETE` is called on a Kudos record by any role, THE System SHALL return HTTP status 405.
4. THE System SHALL expose `GET /api/v1/kudos/feed` accessible to all authenticated users, returning Kudos ordered by descending `created_at`; each record SHALL include `sender_name`, `recipient_name`, `message`, and `created_at`.
5. THE System SHALL emit a `kudos_received` Timeline_Event on the recipient's Performance_Timeline for every new Kudos with `title` = `"Kudos from {sender_name}"` and `summary` = the Kudos `message`.
6. WHEN the AI_Draft_Generator constructs a review draft, THE AI_Draft_Generator SHALL include all Kudos received by the Member within the review period as input context; each Kudos record SHALL be eligible as a Citation source.
7. THE Kudos feed page (`/kudos`) SHALL be accessible to all authenticated users; THE System SHALL render each entry showing sender name, recipient name, message, and relative date; the page SHALL load the 50 most recent entries by default with a "Load more" control for subsequent pages.
8. THE Kudos feed page SHALL provide a "Give Kudos" form with a searchable `recipient_id` picker and a `message` field; WHEN submitted successfully, the new entry SHALL appear at the top of the feed without a full page reload.

---

### Requirement 8: Read-Only Skip-Level Visibility

**User Story:** As a skip-level manager, I want read-only access to my reports' reports automatically so I have full organisational visibility without needing a special role.

#### Acceptance Criteria

1. THE System SHALL derive skip-level relationships recursively from the `manager_id` column on the User record; a user U is in the management chain of user V if there exists a path `V.manager_id → ... → U` through one or more hops; this traversal SHALL be computed at query time and SHALL NOT require a separate database table.
2. WHEN a Skip_Level_Manager requests a Member's timeline, goals, achievements, readiness score, or review data via any read endpoint, THE System SHALL return the requested data with HTTP status 200.
3. IF a Skip_Level_Manager attempts to approve, reject, archive, rate, or edit any record belonging to a Member who is NOT their direct report, THEN THE System SHALL return HTTP status 403 with `{"detail": "Action requires direct manager relationship"}`.
4. THE System SHALL NOT expose a separate skip-level role or permission flag; visibility is derived entirely from the `manager_id` chain.
5. WHEN the `manager_id` of a User changes, THE System SHALL reflect the updated chain immediately on subsequent API calls; no hierarchy cache SHALL serve stale access decisions.


---

### Requirement 9: Cycle Snapshot (Manager of Record)

**User Story:** As an Admin, I want the reporting relationship captured at cycle activation to be preserved permanently so that historical reviews remain accurate even after employees change managers.

#### Acceptance Criteria

1. THE ReviewForm model SHALL store a `manager_of_record_id` field (nullable integer FK to Users) that is set at the moment the ReviewCycle transitions from `pending` to `active`; once set, `manager_of_record_id` SHALL NOT be modified by any operation or role.
2. WHEN a ReviewCycle is activated, THE System SHALL set `manager_of_record_id` on all ReviewForms generated for that cycle atomically; if the write fails for any form, no form in that batch SHALL have `manager_of_record_id` set.
3. IF a Member's `manager_id` is `null` at the time a ReviewCycle is activated, THE System SHALL still generate the ReviewForm with `manager_of_record_id = null`; such forms SHALL be flagged in the Admin dashboard with the label "No manager assigned at cycle start" and SHALL remain actionable.
4. IF a Member joins after a ReviewCycle has already been activated, THE System SHALL generate their ReviewForm with `manager_of_record_id` set to the Member's `manager_id` at the time of form generation, using the same null-handling rule as criterion 3.
5. WHEN a ReviewForm is displayed to any user, THE System SHALL resolve the reviewer's name from `manager_of_record_id` (not from the Member's current `manager_id`) and include `manager_of_record_id` and `manager_of_record_name` in the API response; IF `manager_of_record_id` is null, THE System SHALL return `manager_of_record_name: null`.

---

### Requirement 10: Smart "What's Missing?" Prompts

**User Story:** As a Member, I want contextual prompts on my dashboard telling me exactly what to do to improve my review readiness so I act before the window closes. As a Manager, I want the same prompts per team member on the Readiness Dashboard.

#### Acceptance Criteria

1. THE System SHALL compute prompts by evaluating the same five signals defined in Requirement 5, criterion 1; for each signal that is `false`, THE System SHALL include exactly one prompt string in the response.
2. THE prompt strings SHALL be: (a) "No active or completed goal this cycle — create or activate one before review season", (b) "No progress update in the last 30 days — add one to show momentum", (c) "No feedback received this cycle — ask your manager for a check-in", (d) "You have 0 achievements logged this cycle — log at least one to improve your review readiness", (e) "Self-assessment not yet submitted — complete it before the deadline".
3. WHEN a Member's Readiness_Score is 100, THE System SHALL return an empty prompts array; THE Member dashboard SHALL display "You are review-ready — great work!" in the prompts section.
4. THE Member dashboard (`/`) SHALL include a "Review Readiness" card displaying the Readiness_Score percentage and the list of prompt strings on every page load regardless of whether an active ReviewCycle exists.
5. THE Readiness_Dashboard (Requirement 5) SHALL surface the same per-member prompts in the Manager view; prompts SHALL be visible when a Manager expands a team member's readiness card.
6. WHEN an active ReviewCycle has a `self_review_deadline` within 14 days of the current date, THE System SHALL prepend `"⚠ Review deadline approaching — "` to each prompt string.

---

### Requirement 11: One-Click Review Export

**User Story:** As a Manager or Member, I want to export a completed review as a downloadable file so the review feels like a real, portable deliverable rather than just a screen.

#### Acceptance Criteria

1. THE System SHALL expose a `GET /api/v1/reviews/forms/{form_id}/export` endpoint; IF the requesting user is unauthenticated, THE System SHALL return HTTP status 401.
2. THE endpoint SHALL return the completed review as a self-contained HTML file including: employee name, review cycle name and date range, Manager_of_Record name, self-assessment text, manager comment, final rating, and the AI draft (summary, strengths, growth areas) with numbered superscript citation markers linking to a references section listing each cited event.
3. THE HTML export SHALL set `Content-Type: text/html; charset=utf-8` and `Content-Disposition: attachment; filename="review_{employee_name}_{cycle_name}.html"` where all non-alphanumeric characters in both name segments are replaced with underscores.
4. IF the manager ReviewForm for the same employee and cycle has not reached `submitted` status, THEN THE System SHALL return HTTP status 422 with `{"detail": "Review is not yet finalised; export is available only after the manager submits"}`.
5. WHEN a Manager calls the export endpoint for a form whose `manager_of_record_id` equals the Manager's `id`, THE System SHALL return the HTML file with HTTP status 200.
6. WHEN a Member calls the export endpoint for their own ReviewForm (`employee_id` equals the Member's `id`) and the review is finalised, THE System SHALL return the HTML file with HTTP status 200.
7. IF a user calls the export endpoint for a ReviewForm where they are neither `manager_of_record_id` nor `employee_id`, THEN THE System SHALL return HTTP status 403.
8. THE Review_Studio page SHALL include an "Export Review" button; WHEN the review is in `submitted` status, the button SHALL be enabled and trigger a browser download via the export endpoint; WHEN the review is not yet submitted, the button SHALL be disabled.
9. IF the export API request fails, THE System SHALL display an error toast `"Export failed — please try again"` and SHALL NOT navigate away from the Review_Studio.
10. THE exported HTML file SHALL be self-contained with no external CSS or JavaScript dependencies; styling SHALL use only inline CSS or a `<style>` block in the document `<head>` so the file renders correctly when opened offline.

---

## Out of Scope (Roadmap — Do Not Build)

The following are valid product ideas but are explicitly excluded from this build to protect the evidence-first wedge:

- Workload intelligence, capacity gauges, strain index
- Bottom-up goal requests / goal proposal queue
- HR org-wide analytics dashboard
- Full calibration workflows
- Compensation or payroll links
- 9-box talent matrix
- Complex notification engines
- Deep BI or analytics
- Full enterprise permission branching
