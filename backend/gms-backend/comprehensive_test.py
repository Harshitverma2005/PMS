#!/usr/bin/env python3
import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8003/api/v1"

# Test users
ADMIN = {"email": "sandeep@opstree.com", "password": "test"}
MANAGER = {"email": "deepak@opstree.com", "password": "test"}
EMPLOYEE = {"email": "harshit@opstree.com", "password": "test"}

tokens = {}
test_results = {"passed": 0, "failed": 0, "errors": []}

def login(user, role):
    resp = requests.post(f"{BASE_URL}/auth/login", json=user)
    if resp.status_code == 200:
        tokens[role] = resp.json()["access_token"]
        print(f"✓ {role.upper()} logged in")
        return True
    print(f"✗ {role.upper()} login failed")
    return False

def test(name, method, endpoint, role, expected_status, data=None, params=None):
    headers = {"Authorization": f"Bearer {tokens.get(role, '')}"}
    try:
        if method == "GET":
            resp = requests.get(f"{BASE_URL}{endpoint}", headers=headers, params=params)
        elif method == "POST":
            resp = requests.post(f"{BASE_URL}{endpoint}", headers=headers, json=data)
        elif method == "PUT":
            resp = requests.put(f"{BASE_URL}{endpoint}", headers=headers, json=data)
        elif method == "DELETE":
            resp = requests.delete(f"{BASE_URL}{endpoint}", headers=headers)
        
        if resp.status_code == expected_status:
            test_results["passed"] += 1
            print(f"✓ {name}")
            return resp.json() if resp.text else None
        else:
            test_results["failed"] += 1
            test_results["errors"].append(f"{name}: Expected {expected_status}, got {resp.status_code} - {resp.text[:100]}")
            print(f"✗ {name}: Expected {expected_status}, got {resp.status_code}")
            return None
    except Exception as e:
        test_results["failed"] += 1
        test_results["errors"].append(f"{name}: {str(e)}")
        print(f"✗ {name}: {str(e)}")
        return None

# Store created IDs
ids = {}

print("\n=== AUTHENTICATION TESTS ===")
login(ADMIN, "admin")
login(MANAGER, "manager")
login(EMPLOYEE, "employee")

print("\n=== USER TESTS ===")
test("Get current user (employee)", "GET", "/users/me", "employee", 200)
test("Get current user (manager)", "GET", "/users/me", "manager", 200)
test("Get current user (admin)", "GET", "/users/me", "admin", 200)
users = test("List all users (admin)", "GET", "/users/", "admin", 200)
test("List users (employee - forbidden)", "GET", "/users/", "employee", 403)
if users:
    test("Get user by ID (admin)", "GET", f"/users/{users[0]['id']}", "admin", 200)

print("\n=== TEAM TESTS ===")
teams = test("List teams (employee)", "GET", "/teams/", "employee", 200)
team_data = {"name": f"Test Team {datetime.now().timestamp()}", "description": "Test team"}
new_team = test("Create team (admin)", "POST", "/teams/", "admin", 200, team_data)
if new_team:
    ids["team"] = new_team["id"]
    test("Get team by ID", "GET", f"/teams/{ids['team']}", "employee", 200)
    test("Update team (admin)", "PUT", f"/teams/{ids['team']}", "admin", 200, {"name": "Updated Team"})
    test("Create team (employee - forbidden)", "POST", "/teams/", "employee", 403, team_data)

print("\n=== GOAL TESTS (HIERARCHY) ===")
# Company goal
company_goal = test("Create company goal (admin)", "POST", "/goals/", "admin", 200, {
    "title": "Company Revenue Target",
    "description": "Achieve $10M revenue",
    "goal_type": "COMPANY",
    "status": "IN_PROGRESS",
    "target_date": (datetime.now() + timedelta(days=180)).isoformat()
})
if company_goal:
    ids["company_goal"] = company_goal["id"]
    
    # Team goal
    team_goal = test("Create team goal (manager)", "POST", "/goals/", "manager", 200, {
        "title": "Team Sales Target",
        "description": "Achieve $2M in sales",
        "goal_type": "TEAM",
        "status": "IN_PROGRESS",
        "parent_id": ids["company_goal"],
        "target_date": (datetime.now() + timedelta(days=150)).isoformat()
    })
    if team_goal:
        ids["team_goal"] = team_goal["id"]
        
        # Individual goal
        individual_goal = test("Create individual goal (employee)", "POST", "/goals/", "employee", 200, {
            "title": "Close 10 deals",
            "description": "Personal sales target",
            "goal_type": "INDIVIDUAL",
            "status": "IN_PROGRESS",
            "parent_id": ids["team_goal"],
            "target_date": (datetime.now() + timedelta(days=120)).isoformat()
        })
        if individual_goal:
            ids["individual_goal"] = individual_goal["id"]

test("List goals (employee)", "GET", "/goals/", "employee", 200)
test("Get goal by ID", "GET", f"/goals/{ids.get('individual_goal', 1)}", "employee", 200)
test("Update goal (employee)", "PUT", f"/goals/{ids.get('individual_goal', 1)}", "employee", 200, {"status": "COMPLETED"})
test("Invalid hierarchy (team goal without parent)", "POST", "/goals/", "manager", 422, {
    "title": "Invalid Team Goal",
    "goal_type": "TEAM",
    "status": "IN_PROGRESS",
    "target_date": (datetime.now() + timedelta(days=90)).isoformat()
})

print("\n=== FEEDBACK TESTS ===")
feedback = test("Submit feedback (manager)", "POST", "/feedback/", "manager", 200, {
    "goal_id": ids.get("individual_goal", 1),
    "reviewee_id": 3,
    "rating": 1,
    "comment": ""
})
if feedback:
    ids["feedback"] = feedback["id"]
    test("List feedback (employee)", "GET", "/feedback/", "employee", 200)
    test("Get feedback by ID", "GET", f"/feedback/{ids['feedback']}", "manager", 200)

print("\n=== PROBATION TESTS ===")
probation_records = test("List probation records (employee)", "GET", "/probation/records", "employee", 200)
if probation_records and len(probation_records) > 0:
    prob_id = probation_records[0]["id"]
    ids["probation"] = prob_id
    
    test("Get probation by ID", "GET", f"/probation/records/{prob_id}", "employee", 200)
    test("Pause probation (manager)", "POST", f"/probation/records/{prob_id}/pause", "manager", 200, {"reason": "Medical leave"})
    test("Resume probation (manager)", "POST", f"/probation/records/{prob_id}/resume", "manager", 200)
    
    # Probation feedback
    prob_feedback = test("Submit probation feedback (manager)", "POST", "/probation/feedback", "manager", 200, {
        "probation_record_id": prob_id,
        "rating": 4,
        "comment": "Good progress",
        "areas_of_improvement": "Communication"
    })
    
    test("Submit probation feedback (employee)", "POST", "/probation/feedback", "employee", 200, {
        "probation_record_id": prob_id,
        "rating": 4,
        "comment": "Learning well",
        "areas_of_improvement": "Technical skills"
    })
    
    test("List probation feedback", "GET", f"/probation/records/{prob_id}/feedback", "employee", 200)
    test("Complete probation (admin)", "POST", f"/probation/records/{prob_id}/complete", "admin", 200, {"outcome": "PASSED"})

print("\n=== REVIEW CYCLE TESTS ===")
cycle = test("Create review cycle (admin)", "POST", "/reviews/cycles", "admin", 200, {
    "name": f"Q1 Review {datetime.now().year}",
    "description": "Quarterly review",
    "start_date": (datetime.now() - timedelta(days=30)).isoformat(),
    "end_date": (datetime.now() + timedelta(days=30)).isoformat(),
    "review_type": "QUARTERLY"
})
if cycle:
    ids["cycle"] = cycle["id"]
    test("List review cycles", "GET", "/reviews/cycles", "employee", 200)
    test("Get cycle by ID", "GET", f"/reviews/cycles/{ids['cycle']}", "employee", 200)
    test("Update cycle (admin)", "PUT", f"/reviews/cycles/{ids['cycle']}", "admin", 200, {"description": "Updated description"})
    
    # Trigger cycle
    test("Trigger review cycle (admin)", "POST", f"/reviews/cycles/{ids['cycle']}/trigger", "admin", 200)
    
    # Get triggered forms
    forms = test("List review forms (employee)", "GET", "/reviews/forms", "employee", 200)
    if forms and len(forms) > 0:
        form_id = forms[0]["id"]
        ids["form"] = form_id
        
        test("Get form by ID", "GET", f"/reviews/forms/{form_id}", "employee", 200)
        test("Submit review form (employee)", "POST", f"/reviews/forms/{form_id}/submit", "employee", 200, {
            "self_rating": 4,
            "self_comment": "Met all objectives",
            "achievements": "Completed 3 major projects"
        })
        test("Submit manager review (manager)", "POST", f"/reviews/forms/{form_id}/submit", "manager", 200, {
            "manager_rating": 4,
            "manager_comment": "Strong performance",
            "development_areas": "Leadership skills"
        })
    
    test("Get compliance report (admin)", "GET", f"/reviews/cycles/{ids['cycle']}/compliance", "admin", 200)
    test("Close review cycle (admin)", "POST", f"/reviews/cycles/{ids['cycle']}/close", "admin", 200)

print("\n=== NOTIFICATION TESTS ===")
notifications = test("List notifications (employee)", "GET", "/notifications/", "employee", 200)
if notifications and len(notifications) > 0:
    notif_id = notifications[0]["id"]
    test("Mark notification as read", "PUT", f"/notifications/{notif_id}/read", "employee", 200)
test("Mark all as read", "PUT", "/notifications/mark-all-read", "employee", 200)

print("\n=== DASHBOARD TESTS ===")
test("Get my dashboard (employee)", "GET", "/dashboard/me", "employee", 200)
test("Get team dashboard (manager)", "GET", "/dashboard/team", "manager", 200)
test("Get company dashboard (admin)", "GET", "/dashboard/company", "admin", 200)
test("Get team dashboard (employee - forbidden)", "GET", "/dashboard/team", "employee", 403)
test("Get company dashboard (manager - forbidden)", "GET", "/dashboard/company", "manager", 403)

print("\n=== ADMIN TESTS ===")
test("List flagged feedback (admin)", "GET", "/admin/flags", "admin", 200)
if ids.get("feedback"):
    test("Resolve flag (admin)", "POST", f"/admin/flags/{ids['feedback']}/resolve", "admin", 200, {"resolution_note": "Addressed with manager"})
test("Goals report (admin)", "GET", "/admin/reports/goals", "admin", 200, params={"format": "json"})
test("Probation report (admin)", "GET", "/admin/reports/probation", "admin", 200, params={"format": "json"})
test("Reviews report (admin)", "GET", "/admin/reports/reviews", "admin", 200, params={"format": "json"})
test("Admin endpoint (employee - forbidden)", "GET", "/admin/flags", "employee", 403)

print("\n=== EDGE CASES & VALIDATION ===")
test("Create goal without title", "POST", "/goals/", "employee", 422, {"goal_type": "INDIVIDUAL", "status": "IN_PROGRESS"})
test("Get non-existent goal", "GET", "/goals/99999", "employee", 404)
test("Update other user's individual goal", "PUT", f"/goals/{ids.get('individual_goal', 1)}", "manager", 403, {"status": "CANCELLED"})
test("Submit feedback with invalid rating", "POST", "/feedback/", "manager", 422, {
    "goal_id": ids.get("individual_goal", 1),
    "reviewee_id": 3,
    "rating": 6,
    "comment": "Invalid"
})
test("Access without token", "GET", "/users/me", None, 401)

print("\n" + "="*60)
print(f"TOTAL TESTS: {test_results['passed'] + test_results['failed']}")
print(f"✓ PASSED: {test_results['passed']}")
print(f"✗ FAILED: {test_results['failed']}")
print("="*60)

if test_results["errors"]:
    print("\nFAILED TESTS:")
    for error in test_results["errors"][:10]:
        print(f"  - {error}")
    if len(test_results["errors"]) > 10:
        print(f"  ... and {len(test_results['errors']) - 10} more")
