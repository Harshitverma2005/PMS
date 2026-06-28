#!/usr/bin/env python3
"""
Test all notification triggers in PMS.
Make sure the backend is running and .env contains email config.
"""

import requests
import json
import time
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8003/api/v1"

# Test user details
ADMIN_EMAIL = "prashant.sharma@opstree.com"
ADMIN_PASSWORD = "Test@123"
MANAGER_EMAIL = "gourav.singh@opstree.com"
MANAGER_PASSWORD = "Test@123"
EMPLOYEE_EMAIL = "harshit.verma@opstree.com"
EMPLOYEE_PASSWORD = "Test@123"

# Default admin credentials (existing user)
DEFAULT_ADMIN_EMAIL = "jain.samyak1908+admin@gmail.com"
DEFAULT_ADMIN_PASSWORD = "password123"

def login(email, password):
    """Login and return token and user info."""
    resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
    if resp.status_code == 200:
        data = resp.json()
        print(f"✅ Logged in as {email}")
        return data["access_token"], data["user_id"]
    else:
        print(f"❌ Login failed for {email}: {resp.text}")
        return None, None

def create_user(token, email, name, role, password, manager_id=None):
    """Create a user via API."""
    headers = {"Authorization": f"Bearer {token}"}
    data = {
        "email": email,
        "name": name,
        "role": role,
        "password": password,
        "manager_id": manager_id,
        "department": "Engineering" if role != "admin" else "IT",
        "date_of_joining": datetime.now().strftime("%Y-%m-%d"),
        "is_active": True
    }
    resp = requests.post(f"{BASE_URL}/users/", json=data, headers=headers)
    if resp.status_code == 201:
        user = resp.json()
        print(f"✅ Created user {email} (role={role}, id={user['id']})")
        return user["id"]
    else:
        print(f"❌ Failed to create user {email}: {resp.text}")
        return None

def get_user_by_email(token, email):
    """Get user by email."""
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(f"{BASE_URL}/users/", headers=headers)
    if resp.status_code == 200:
        users = resp.json()
        for user in users:
            if user["email"] == email:
                return user
    return None

def create_goal(token, assignee_id, title, description, level="individual", tag="quarterly", priority="high"):
    """Create a goal."""
    headers = {"Authorization": f"Bearer {token}"}
    data = {
        "title": title,
        "description": description,
        "level": level,
        "tag": tag,
        "priority": priority,
        "start_date": datetime.now().date().isoformat(),
        "assignee_id": assignee_id
    }
    resp = requests.post(f"{BASE_URL}/goals/", json=data, headers=headers)
    if resp.status_code == 201:
        goal = resp.json()
        print(f"✅ Created goal {goal['id']}: {title}")
        return goal["id"]
    else:
        print(f"❌ Failed to create goal: {resp.text}")
        return None

def submit_goal(token, goal_id):
    """Submit goal for approval."""
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.post(f"{BASE_URL}/goals/{goal_id}/submit", headers=headers)
    if resp.status_code == 200:
        print(f"✅ Submitted goal {goal_id} → Email sent to manager")
        return True
    else:
        print(f"❌ Failed to submit goal: {resp.text}")
        return False

def approve_goal(token, goal_id, approved=True, comment=None):
    """Approve or reject goal."""
    headers = {"Authorization": f"Bearer {token}"}
    data = {"approved": approved}
    if comment:
        data["rejection_comment"] = comment
    resp = requests.post(f"{BASE_URL}/goals/{goal_id}/approve", json=data, headers=headers)
    if resp.status_code == 200:
        action = "approved" if approved else "rejected"
        print(f"✅ {action.capitalize()} goal {goal_id} → Email sent to employee")
        return True
    else:
        print(f"❌ Failed to approve/reject goal: {resp.text}")
        return False

def update_goal_progress(token, goal_id, percentage, notes=None):
    """Update goal progress."""
    headers = {"Authorization": f"Bearer {token}"}
    data = {
        "completion_percentage": percentage,
        "notes": notes or f"Progress update: {percentage}%"
    }
    resp = requests.post(f"{BASE_URL}/goals/{goal_id}/progress", json=data, headers=headers)
    if resp.status_code == 200:
        print(f"✅ Updated goal {goal_id} progress to {percentage}%")
        return True
    else:
        print(f"❌ Failed to update progress: {resp.text}")
        return False

def complete_goal(token, goal_id):
    """Mark goal as complete."""
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.post(f"{BASE_URL}/goals/{goal_id}/complete", headers=headers)
    if resp.status_code == 200:
        print(f"✅ Completed goal {goal_id} → Status: AWAITING_FEEDBACK")
        return True
    else:
        print(f"❌ Failed to complete goal: {resp.text}")
        return False

def submit_member_feedback(token, goal_id, rating=4):
    """Submit member feedback."""
    headers = {"Authorization": f"Bearer {token}"}
    data = {
        "self_rating": rating,
        "comments": "Successfully completed the goal",
        "challenges": "Some technical challenges",
        "learnings": "Learned new skills"
    }
    resp = requests.post(f"{BASE_URL}/goals/{goal_id}/feedback/member", json=data, headers=headers)
    if resp.status_code == 200:
        print(f"✅ Submitted member feedback for goal {goal_id}")
        return True
    else:
        print(f"❌ Failed to submit feedback: {resp.text}")
        return False

def create_review_cycle(token, name, review_type="quarterly"):
    """Create a review cycle."""
    headers = {"Authorization": f"Bearer {token}"}
    start = datetime.now()
    end = start + timedelta(days=30)
    data = {
        "name": name,
        "description": f"Test {review_type} review cycle",
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "review_type": review_type
    }
    resp = requests.post(f"{BASE_URL}/reviews/review-cycles/", json=data, headers=headers)
    if resp.status_code == 201:
        cycle = resp.json()
        print(f"✅ Created review cycle {cycle['id']}: {name}")
        return cycle["id"]
    else:
        print(f"❌ Failed to create cycle: {resp.text}")
        return None

def trigger_review_cycle(token, cycle_id):
    """Trigger review cycle."""
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.post(f"{BASE_URL}/reviews/review-cycles/{cycle_id}/trigger", headers=headers)
    if resp.status_code == 200:
        print(f"✅ Triggered review cycle {cycle_id} → Emails sent to all employees")
        return True
    else:
        print(f"❌ Failed to trigger cycle: {resp.text}")
        return False

def get_my_review_forms(token):
    """Get current user's review forms."""
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(f"{BASE_URL}/reviews/review-forms/", headers=headers)
    if resp.status_code == 200:
        forms = resp.json()
        print(f"📋 Found {len(forms)} review forms")
        return forms
    else:
        print(f"❌ Failed to get forms: {resp.text}")
        return []

def submit_review_form(token, form_id, rating=2):
    """Submit a review form with low rating."""
    headers = {"Authorization": f"Bearer {token}"}
    data = {
        "self_assessment": "Completed some tasks",
        "achievements": "Basic work done",
        "challenges": "Many challenges faced",
        "goals_next_period": "Improve performance",
        "self_rating": rating
    }
    resp = requests.post(f"{BASE_URL}/reviews/review-forms/{form_id}/submit", json=data, headers=headers)
    if resp.status_code == 200:
        print(f"✅ Submitted review form {form_id} with rating {rating}")
        return True
    else:
        print(f"❌ Failed to submit review form: {resp.text}")
        return False

def main():
    print("=" * 70)
    print("PMS NOTIFICATION SYSTEM - COMPREHENSIVE TEST")
    print("=" * 70)
    print()
    
    # Step 1: Login as default admin
    print("📌 Step 1: Login as default admin")
    admin_token, admin_id = login(DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD)
    if not admin_token:
        print("❌ Cannot proceed without admin token")
        return
    print()
    
    # Step 2: Create or get test users
    print("📌 Step 2: Setup test users")
    
    # Check if users exist
    test_admin = get_user_by_email(admin_token, ADMIN_EMAIL)
    test_manager = get_user_by_email(admin_token, MANAGER_EMAIL)
    test_employee = get_user_by_email(admin_token, EMPLOYEE_EMAIL)
    
    # Create admin if needed
    if not test_admin:
        test_admin_id = create_user(admin_token, ADMIN_EMAIL, "Prashant Sharma", "admin", ADMIN_PASSWORD)
    else:
        test_admin_id = test_admin["id"]
        print(f"✅ User {ADMIN_EMAIL} already exists (id={test_admin_id})")
    
    # Create manager if needed
    if not test_manager:
        test_manager_id = create_user(admin_token, MANAGER_EMAIL, "Gourav Singh", "manager", MANAGER_PASSWORD, manager_id=test_admin_id)
    else:
        test_manager_id = test_manager["id"]
        print(f"✅ User {MANAGER_EMAIL} already exists (id={test_manager_id})")
    
    # Create employee if needed
    if not test_employee:
        test_employee_id = create_user(admin_token, EMPLOYEE_EMAIL, "Harshit Verma", "member", EMPLOYEE_PASSWORD, manager_id=test_manager_id)
    else:
        test_employee_id = test_employee["id"]
        print(f"✅ User {EMPLOYEE_EMAIL} already exists (id={test_employee_id})")
    
    if not all([test_admin_id, test_manager_id, test_employee_id]):
        print("❌ Failed to setup users")
        return
    print()
    
    # Step 3: Login as employee
    print("📌 Step 3: Login as employee and create goal")
    emp_token, _ = login(EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD)
    if not emp_token:
        print("❌ Employee login failed")
        return
    
    # Create goal
    goal_id = create_goal(emp_token, test_employee_id, 
                         "Q1 Performance Testing Goals",
                         "Complete comprehensive performance testing for all microservices")
    if not goal_id:
        print("❌ Goal creation failed")
        return
    print()
    
    # Step 4: Submit goal for approval
    print("📌 Step 4: Submit goal for approval (triggers notification to manager)")
    submit_goal(emp_token, goal_id)
    time.sleep(2)
    print()
    
    # Step 5: Login as manager and approve goal
    print("📌 Step 5: Manager approves goal (triggers notification to employee)")
    mgr_token, _ = login(MANAGER_EMAIL, MANAGER_PASSWORD)
    if not mgr_token:
        print("❌ Manager login failed")
        return
    
    approve_goal(mgr_token, goal_id, approved=True)
    time.sleep(2)
    print()
    
    # Step 6: Create another goal and reject it
    print("📌 Step 6: Create and reject goal (triggers rejection notification)")
    goal_id2 = create_goal(emp_token, test_employee_id,
                          "Test Rejection Workflow",
                          "This goal will be rejected for testing",
                          tag="weekly", priority="low")
    if goal_id2:
        submit_goal(emp_token, goal_id2)
        time.sleep(1)
        approve_goal(mgr_token, goal_id2, approved=False, comment="Needs more details and clarity")
        time.sleep(2)
    print()
    
    # Step 7: Update progress to trigger red flag
    print("📌 Step 7: Update goal progress to trigger red flag")
    update_goal_progress(emp_token, goal_id, 10, 
                        "Blocked by dependencies - high risk of delay")
    time.sleep(2)
    print()
    
    # Step 8: Complete goal and submit feedback
    print("📌 Step 8: Complete goal and submit feedback")
    complete_goal(emp_token, goal_id)
    time.sleep(1)
    submit_member_feedback(emp_token, goal_id, rating=4)
    time.sleep(2)
    print()
    
    # Step 9: Create and trigger review cycle
    print("📌 Step 9: Create and trigger review cycle (triggers notification to all)")
    test_admin_token, _ = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if test_admin_token:
        cycle_id = create_review_cycle(test_admin_token, "Q1 2024 Performance Review")
        if cycle_id:
            trigger_review_cycle(test_admin_token, cycle_id)
            time.sleep(2)
            
            # Step 10: Submit self-assessment with low rating
            print()
            print("📌 Step 10: Submit self-assessment with low rating (triggers red flag)")
            forms = get_my_review_forms(emp_token)
            for form in forms:
                if form.get("status") in ["pending", "PENDING"]:
                    submit_review_form(emp_token, form["id"], rating=2)
                    time.sleep(2)
                    break
    print()
    
    # Summary
    print("=" * 70)
    print("TEST COMPLETED SUCCESSFULLY")
    print("=" * 70)
    print()
    print("✅ Notifications triggered:")
    print("   1. Goal submission → Manager (gourav.singh@opstree.com)")
    print("   2. Goal approval → Employee (harshit.verma@opstree.com)")
    print("   3. Goal rejection → Employee (harshit.verma@opstree.com)")
    print("   4. Red flag detected → Manager (gourav.singh@opstree.com)")
    print("   5. Goal completion → Manager")
    print("   6. Review cycle started → All employees")
    print("   7. Low rating red flag → Admin (prashant.sharma@opstree.com)")
    print()
    print("📧 Check email inboxes:")
    print(f"   • Employee: {EMPLOYEE_EMAIL}")
    print(f"   • Manager: {MANAGER_EMAIL}")
    print(f"   • Admin: {ADMIN_EMAIL}")
    print()
    print("📋 Check backend logs:")
    print("   docker logs pms-gms-backend-1 --tail 50 | grep -i email")
    print()
    print("=" * 70)

if __name__ == "__main__":
    main()
