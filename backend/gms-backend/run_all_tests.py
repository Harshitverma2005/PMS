#!/usr/bin/env python3
"""
Master Test Runner for PMS Backend
Executes all test suites and generates comprehensive report
"""

import subprocess
import sys
from datetime import datetime

# Test suites to run
TEST_SUITES = [
    ("TEAM", "test_team_cases.py", "Team Management (TEAM-01 to TEAM-06)"),
    ("USER", "test_user_cases.py", "User Management (USER-01 to USER-12)"),
    ("ORG", "test_org_cases.py", "Organization (ORG-01 to ORG-04)"),
    ("AUTH", "test_auth_cases.py", "Authentication (AUTH-01 to AUTH-04)"),
    ("GOAL", "test_goal_cases.py", "Goal Management (GOAL-01 to GOAL-07)"),
    ("PROBATION", "test_prob_cases.py", "Probation (PROB-01 to PROB-05)"),
    ("REVIEW", "test_rev_cases.py", "Review Cycles (REV-01 to REV-05)"),
    ("DASHBOARD", "test_dash_cases.py", "Dashboards (DASH-01 to DASH-04)"),
    ("NOTIF/FLAG/REP", "test_notif_flag_rep_cases.py", "Notifications, Flags & Reports"),
]

def run_test_suite(script_name):
    """Run a single test suite and return results"""
    try:
        result = subprocess.run(
            ["python", script_name],
            capture_output=True,
            text=True,
            timeout=60
        )
        return result.stdout, result.returncode == 0
    except subprocess.TimeoutExpired:
        return "TIMEOUT", False
    except Exception as e:
        return f"ERROR: {str(e)}", False

def parse_results(output):
    """Extract test results from output"""
    lines = output.split('\n')
    for line in lines:
        if 'Total Tests:' in line:
            total = int(line.split(':')[1].strip())
        if '✓ Passed:' in line:
            passed = int(line.split(':')[1].strip())
        if '✗ Failed:' in line:
            failed = int(line.split(':')[1].strip())
        if 'Success Rate:' in line:
            rate = line.split(':')[1].strip()
    
    try:
        return total, passed, failed, rate
    except:
        return 0, 0, 0, "0.0%"

def main():
    print("=" * 100)
    print("PMS BACKEND - COMPREHENSIVE TEST EXECUTION")
    print("=" * 100)
    print(f"Execution Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 100)
    print()
    
    all_results = []
    total_tests = 0
    total_passed = 0
    total_failed = 0
    
    for suite_name, script, description in TEST_SUITES:
        print(f"Running {suite_name}: {description}...")
        output, success = run_test_suite(script)
        
        if success:
            tests, passed, failed, rate = parse_results(output)
            all_results.append({
                "suite": suite_name,
                "description": description,
                "total": tests,
                "passed": passed,
                "failed": failed,
                "rate": rate,
                "status": "✓ PASS" if failed == 0 else "✗ FAIL"
            })
            total_tests += tests
            total_passed += passed
            total_failed += failed
            print(f"  {suite_name}: {passed}/{tests} passed ({rate})")
        else:
            print(f"  {suite_name}: FAILED TO RUN")
            all_results.append({
                "suite": suite_name,
                "description": description,
                "total": 0,
                "passed": 0,
                "failed": 0,
                "rate": "0.0%",
                "status": "✗ ERROR"
            })
        print()
    
    # Print summary
    print("=" * 100)
    print("COMPREHENSIVE TEST SUMMARY")
    print("=" * 100)
    print(f"{'Suite':<20} | {'Description':<40} | {'Results':<15} | {'Status':<10}")
    print("-" * 100)
    
    for result in all_results:
        results_str = f"{result['passed']}/{result['total']} ({result['rate']})"
        print(f"{result['suite']:<20} | {result['description']:<40} | {results_str:<15} | {result['status']:<10}")
    
    print("=" * 100)
    print(f"OVERALL: {total_passed}/{total_tests} tests passed")
    print(f"Success Rate: {(total_passed/total_tests*100):.1f}%" if total_tests > 0 else "Success Rate: 0.0%")
    print("=" * 100)
    
    # Exit with appropriate code
    sys.exit(0 if total_failed == 0 else 1)

if __name__ == "__main__":
    main()
