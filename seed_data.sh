#!/bin/bash
BASE="http://localhost:8003/api/v1"

# ── Auth ──────────────────────────────────────────────────────────────────────
ADMIN_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"vermajiharshi1@gmail.com","password":"test"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

echo "✅ Admin logged in"

# ── Create Users ──────────────────────────────────────────────────────────────
echo "--- Creating Users ---"

MGR2_ID=$(curl -s -X POST "$BASE/users/" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Priya Sharma","email":"priya.sharma@opstree.com","password":"test","role":"manager","department":"Product","date_of_joining":"2023-03-01","manager_id":1}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Manager 2 (Priya): $MGR2_ID"

EMP2_ID=$(curl -s -X POST "$BASE/users/" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"Rahul Mehta\",\"email\":\"rahul.mehta@opstree.com\",\"password\":\"test\",\"role\":\"member\",\"department\":\"Engineering\",\"date_of_joining\":\"2025-03-01\",\"manager_id\":2}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Employee 2 (Rahul): $EMP2_ID"

EMP3_ID=$(curl -s -X POST "$BASE/users/" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"Sneha Patel\",\"email\":\"sneha.patel@opstree.com\",\"password\":\"test\",\"role\":\"member\",\"department\":\"Product\",\"date_of_joining\":\"2024-06-15\",\"manager_id\":$MGR2_ID}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Employee 3 (Sneha): $EMP3_ID"

EMP4_ID=$(curl -s -X POST "$BASE/users/" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"Amit Kumar\",\"email\":\"amit.kumar@opstree.com\",\"password\":\"test\",\"role\":\"member\",\"department\":\"Engineering\",\"date_of_joining\":\"2024-09-01\",\"manager_id\":2}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Employee 4 (Amit): $EMP4_ID"

# Update passwords for new users
docker exec pms-postgres-1 psql -U gms_user -d gms_db -c \
  "UPDATE users SET password_hash = '\$2b\$12\$FoMxltT0Ub0FwsUVMvK1tOtzpDA1Jm9MsEWtKslgdQamz.Sgcjd9C' WHERE id IN ($MGR2_ID, $EMP2_ID, $EMP3_ID, $EMP4_ID);" > /dev/null

# ── Create Teams ──────────────────────────────────────────────────────────────
echo "--- Creating Teams ---"

TEAM1_ID=$(curl -s -X POST "$BASE/teams/" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Backend Engineering","description":"Core backend services and APIs","manager_id":2}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Team 1 (Backend): $TEAM1_ID"

TEAM2_ID=$(curl -s -X POST "$BASE/teams/" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"Product & Design\",\"description\":\"Product management and UX design\",\"manager_id\":$MGR2_ID}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Team 2 (Product): $TEAM2_ID"

# Assign users to teams
curl -s -X PATCH "$BASE/users/2" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"team_id\":$TEAM1_ID}" > /dev/null
curl -s -X PATCH "$BASE/users/3" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"team_id\":$TEAM1_ID}" > /dev/null
curl -s -X PATCH "$BASE/users/$EMP2_ID" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"team_id\":$TEAM1_ID}" > /dev/null
curl -s -X PATCH "$BASE/users/$MGR2_ID" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"team_id\":$TEAM2_ID}" > /dev/null
curl -s -X PATCH "$BASE/users/$EMP3_ID" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"team_id\":$TEAM2_ID}" > /dev/null
curl -s -X PATCH "$BASE/users/$EMP4_ID" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"team_id\":$TEAM1_ID}" > /dev/null
echo "✅ Users assigned to teams"

# ── Create Goals ──────────────────────────────────────────────────────────────
echo "--- Creating Goals ---"

# Company goal
CG1=$(curl -s -X POST "$BASE/goals/" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Achieve 99.9% Platform Uptime","description":"Ensure platform reliability and zero downtime deployments across all services","level":"company","tag":"quarterly","priority":"critical","start_date":"2026-01-01","assignee_id":1}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Company Goal 1: $CG1"

CG2=$(curl -s -X POST "$BASE/goals/" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Launch PMS v2.0 to Production","description":"Complete development, testing and production deployment of PMS v2.0","level":"company","tag":"quarterly","priority":"critical","start_date":"2026-01-01","assignee_id":1}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Company Goal 2: $CG2"

# Team goals
TG1=$(curl -s -X POST "$BASE/goals/" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"title\":\"Reduce API Response Time by 40%\",\"description\":\"Optimize database queries, add caching layer and improve backend performance\",\"level\":\"team\",\"tag\":\"quarterly\",\"priority\":\"high\",\"start_date\":\"2026-01-01\",\"assignee_id\":2,\"parent_id\":$CG1}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Team Goal 1: $TG1"

TG2=$(curl -s -X POST "$BASE/goals/" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"title\":\"Ship 3 Major Product Features\",\"description\":\"Design, develop and ship 3 high-impact product features this quarter\",\"level\":\"team\",\"tag\":\"quarterly\",\"priority\":\"high\",\"start_date\":\"2026-01-01\",\"assignee_id\":$MGR2_ID,\"parent_id\":$CG2}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Team Goal 2: $TG2"

# Individual goals
IG1=$(curl -s -X POST "$BASE/goals/" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"title\":\"Implement Redis Caching Layer\",\"description\":\"Add Redis caching for all high-frequency API endpoints to reduce DB load\",\"level\":\"individual\",\"tag\":\"monthly\",\"priority\":\"high\",\"start_date\":\"2026-01-01\",\"assignee_id\":3,\"parent_id\":$TG1}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Individual Goal 1: $IG1"

IG2=$(curl -s -X POST "$BASE/goals/" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"title\":\"Write Unit Tests for Auth Module\",\"description\":\"Achieve 90% test coverage for authentication and authorization module\",\"level\":\"individual\",\"tag\":\"monthly\",\"priority\":\"medium\",\"start_date\":\"2026-01-01\",\"assignee_id\":3}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Individual Goal 2: $IG2"

IG3=$(curl -s -X POST "$BASE/goals/" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"title\":\"Onboarding & Ramp-up Plan\",\"description\":\"Complete onboarding, understand codebase and deliver first feature independently\",\"level\":\"individual\",\"tag\":\"monthly\",\"priority\":\"high\",\"start_date\":\"2026-03-01\",\"assignee_id\":$EMP2_ID}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Individual Goal 3 (Rahul): $IG3"

IG4=$(curl -s -X POST "$BASE/goals/" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"title\":\"User Research for Dashboard Redesign\",\"description\":\"Conduct 10 user interviews and deliver research report with actionable insights\",\"level\":\"individual\",\"tag\":\"monthly\",\"priority\":\"high\",\"start_date\":\"2026-01-01\",\"assignee_id\":$EMP3_ID,\"parent_id\":$TG2}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Individual Goal 4 (Sneha): $IG4"

IG5=$(curl -s -X POST "$BASE/goals/" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"title\":\"Database Query Optimization\",\"description\":\"Identify and optimize top 20 slow queries, reduce average query time by 50%\",\"level\":\"individual\",\"tag\":\"monthly\",\"priority\":\"critical\",\"start_date\":\"2026-01-01\",\"assignee_id\":$EMP4_ID,\"parent_id\":$TG1}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Individual Goal 5 (Amit): $IG5"

echo "✅ Goals created"

# ── Submit & Approve Goals ────────────────────────────────────────────────────
echo "--- Submitting & Approving Goals ---"
for GID in $CG1 $CG2 $TG1 $TG2 $IG1 $IG2 $IG4 $IG5; do
  curl -s -X POST "$BASE/goals/$GID/submit" -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null
  curl -s -X POST "$BASE/goals/$GID/approve" -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" -d '{"approved":true,"comment":"Looks good, approved!"}' > /dev/null
done
echo "✅ Goals submitted and approved"

# ── Add Subtasks ──────────────────────────────────────────────────────────────
echo "--- Adding Subtasks ---"
curl -s -X POST "$BASE/goals/$IG1/subtasks" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Set up Redis instance on staging","description":"Configure Redis on staging environment"}' > /dev/null
curl -s -X POST "$BASE/goals/$IG1/subtasks" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Implement cache invalidation strategy","description":"Design TTL and invalidation logic"}' > /dev/null
curl -s -X POST "$BASE/goals/$IG1/subtasks" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Cache user auth tokens","description":"Cache JWT tokens to reduce DB lookups"}' > /dev/null

curl -s -X POST "$BASE/goals/$IG5/subtasks" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Run EXPLAIN ANALYZE on all queries","description":"Profile all queries in production"}' > /dev/null
curl -s -X POST "$BASE/goals/$IG5/subtasks" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Add missing indexes","description":"Add indexes on foreign keys and filter columns"}' > /dev/null
echo "✅ Subtasks added"

# ── Update Progress ───────────────────────────────────────────────────────────
echo "--- Updating Progress ---"
curl -s -X POST "$BASE/goals/$IG1/progress" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"completion_percentage":75,"notes":"Redis setup done, caching auth tokens in progress"}' > /dev/null
curl -s -X POST "$BASE/goals/$IG2/progress" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"completion_percentage":100,"notes":"All unit tests written, 92% coverage achieved"}' > /dev/null
curl -s -X POST "$BASE/goals/$TG1/progress" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"completion_percentage":60,"notes":"Caching layer 75% done, query optimization in progress"}' > /dev/null
curl -s -X POST "$BASE/goals/$IG4/progress" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"completion_percentage":100,"notes":"Completed 12 user interviews, report delivered"}' > /dev/null
curl -s -X POST "$BASE/goals/$IG5/progress" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"completion_percentage":50,"notes":"Profiled all queries, adding indexes now"}' > /dev/null
curl -s -X POST "$BASE/goals/$IG3/progress" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"completion_percentage":30,"notes":"Completed onboarding docs, exploring codebase"}' > /dev/null
echo "✅ Progress updated"

# ── Complete Goals & Add Feedback ─────────────────────────────────────────────
echo "--- Completing Goals & Adding Feedback ---"

# Complete IG2 (100%)
curl -s -X POST "$BASE/goals/$IG2/complete" -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null
curl -s -X POST "$BASE/goals/$IG2/feedback/member" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"deliverables":"Wrote 47 unit tests covering auth module with 92% code coverage. All edge cases handled.","improvements":"Could improve test naming conventions for better readability"}' > /dev/null
curl -s -X POST "$BASE/goals/$IG2/feedback/evaluator" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"quality_rating":5,"timeliness_rating":4,"innovation_rating":4,"collaboration_rating":5,"impact_rating":4,"evaluator_comment":"Excellent work on test coverage. Gourav showed great attention to detail and delivered ahead of schedule."}' > /dev/null
curl -s -X POST "$BASE/goals/$IG2/score" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"rating":4.4}' > /dev/null

# Complete IG4 (100%)
curl -s -X POST "$BASE/goals/$IG4/complete" -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null
curl -s -X POST "$BASE/goals/$IG4/feedback/member" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"deliverables":"Conducted 12 user interviews, synthesized findings into 25-page research report with 8 actionable recommendations","improvements":"Would benefit from more quantitative data in future research"}' > /dev/null
curl -s -X POST "$BASE/goals/$IG4/feedback/evaluator" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"quality_rating":5,"timeliness_rating":5,"innovation_rating":4,"collaboration_rating":5,"impact_rating":5,"evaluator_comment":"Outstanding research quality. Sneha went above and beyond with 12 interviews vs 10 required. Insights directly shaped product roadmap."}' > /dev/null
curl -s -X POST "$BASE/goals/$IG4/score" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"rating":4.8}' > /dev/null

echo "✅ Goals completed with feedback and scores"

# ── Review Cycles ─────────────────────────────────────────────────────────────
echo "--- Creating Review Cycles ---"

# Closed cycle (Q4 2025)
RC_CLOSED=$(curl -s -X POST "$BASE/review-cycles/" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"cycle_name":"Q4 2025 Performance Review","cycle_type":"quarterly","start_date":"2025-10-01","end_date":"2025-12-31","self_review_deadline":"2025-12-20","manager_review_deadline":"2025-12-28"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Closed Cycle: $RC_CLOSED"

# Active cycle (Q1 2026)
RC_ACTIVE=$(curl -s -X POST "$BASE/review-cycles/" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"cycle_name":"Q1 2026 Performance Review","cycle_type":"quarterly","start_date":"2026-01-01","end_date":"2026-03-31","self_review_deadline":"2026-03-20","manager_review_deadline":"2026-03-28"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Active Cycle: $RC_ACTIVE"

# Bi-annual cycle
RC_BIANNUAL=$(curl -s -X POST "$BASE/review-cycles/" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"cycle_name":"H1 2026 Bi-Annual Review","cycle_type":"bi_annual","start_date":"2026-01-01","end_date":"2026-06-30","self_review_deadline":"2026-06-15","manager_review_deadline":"2026-06-25"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Bi-Annual Cycle: $RC_BIANNUAL"

# Trigger active cycle to create review forms
curl -s -X POST "$BASE/review-cycles/$RC_ACTIVE/trigger" -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null
echo "✅ Review cycles created and triggered"

# ── Probation Records ─────────────────────────────────────────────────────────
echo "--- Creating Probation Records ---"

# Rahul - new joiner on probation
curl -s -X POST "$BASE/probation/" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"employee_id\":$EMP2_ID,\"date_of_joining\":\"2026-03-01\"}" > /dev/null
echo "Probation for Rahul: created"

# Amit - probation nearing completion
curl -s -X POST "$BASE/probation/" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"employee_id\":$EMP4_ID,\"date_of_joining\":\"2024-09-01\"}" > /dev/null
echo "Probation for Amit: created"

echo "✅ Probation records created"

# ── Notifications ─────────────────────────────────────────────────────────────
echo "--- Creating Notifications ---"
docker exec pms-postgres-1 psql -U gms_user -d gms_db -c "
INSERT INTO notifications (recipient_id, title, message, notification_type, is_read, created_at) VALUES
(1, 'Review Cycle Started', 'Q1 2026 Performance Review cycle has been triggered for all employees', 'REVIEW_CYCLE', false, NOW() - INTERVAL '2 days'),
(1, 'Goal Completed', 'Gourav Singh completed goal: Write Unit Tests for Auth Module with score 4.4/5', 'GOAL_COMPLETED', false, NOW() - INTERVAL '1 day'),
(1, 'Probation Alert', 'Rahul Mehta probation review is due in 30 days', 'PROBATION', false, NOW() - INTERVAL '3 hours'),
(2, 'Goal Approved', 'Your team goal Reduce API Response Time has been approved by admin', 'GOAL_APPROVED', true, NOW() - INTERVAL '5 days'),
(2, 'Review Reminder', 'Please complete manager reviews for your team by March 28, 2026', 'REVIEW_REMINDER', false, NOW() - INTERVAL '1 day'),
(3, 'Goal Approved', 'Your goal Implement Redis Caching Layer has been approved', 'GOAL_APPROVED', true, NOW() - INTERVAL '4 days'),
(3, 'Review Cycle', 'Your self-assessment for Q1 2026 is due by March 20, 2026', 'REVIEW_CYCLE', false, NOW() - INTERVAL '6 hours'),
(3, 'Score Received', 'You received a score of 4.4/5 for Write Unit Tests for Auth Module', 'SCORE', true, NOW() - INTERVAL '2 days')
;" > /dev/null
echo "✅ Notifications created"

echo ""
echo "🎉 ALL SEED DATA INSERTED SUCCESSFULLY!"
echo ""
echo "Summary:"
echo "  Users:          7 (1 admin, 2 managers, 4 employees)"
echo "  Teams:          3"
echo "  Goals:          9 (company, team, individual at various stages)"
echo "  Review Cycles:  3 (closed, active, bi-annual)"
echo "  Probation:      3 records"
echo "  Notifications:  8"
