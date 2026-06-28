# Product: PMS — Performance & Goal Management Platform

PMS is an internal HR/engineering tool for managing employee performance, goals, and reviews within an organization.

## Core Capabilities

- **Goal Management**: Employees create goals with subtasks, track progress, and move them through an approval/feedback/scoring lifecycle
- **Performance Reviews**: Structured review cycles (quarterly, bi-annual) with self-assessment and manager feedback forms
- **Probation Tracking**: Manage employees on probation with trigger escalation and feedback workflows
- **Team Management**: Organize users into teams with manager assignments
- **Notifications**: In-app and email notifications for lifecycle events (approvals, feedback requests, etc.)
- **Dashboards & Reports**: Role-specific dashboards and performance reporting

## User Roles

- **Admin** — full platform control, user/team management, flag review
- **Manager** — approve goals, submit evaluator feedback, score goals, manage their team
- **Member** — create goals, submit self-feedback, complete review forms

## Goal Lifecycle

`draft → pending_approval → active → awaiting_feedback → scorable → scored`

Goals can also be `rejected` or marked `completed`.

## Priority / Weightage System

Goal priority maps to default weightage: Critical (40%), High (30%), Medium (20%), Low (10%).
