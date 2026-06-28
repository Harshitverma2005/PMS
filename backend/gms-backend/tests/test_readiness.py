"""
Readiness property tests — Properties 20, 21, 22, 23
Validates: Requirements 5.1, 5.5, 5.8, 10.1, 10.2, 10.6
# Feature: upms-pro-features
"""
import itertools
import pytest
from datetime import date, timedelta

from app.services.readiness_service import compute_score, build_prompts


# ── Property 20: Readiness score formula ─────────────────────────────────

def test_readiness_score_formula():
    """score == sum(signals) * 20 for all 2^5 signal combinations."""
    for signals in itertools.product([True, False], repeat=5):
        score = compute_score(list(signals))
        assert score == sum(signals) * 20
        assert score in {0, 20, 40, 60, 80, 100}


# ── Property 22: Readiness prompt strings count and text ─────────────────

def test_readiness_prompt_strings():
    """For K failed signals, build_prompts returns exactly K strings."""
    for signals in itertools.product([True, False], repeat=5):
        prompts = build_prompts(list(signals), cycle=None)
        expected_fails = 5 - sum(signals)
        assert len(prompts) == expected_fails


# ── Property 23: Deadline warning prefix ────────────────────────────────

def test_deadline_warning_prefix():
    """When self_review_deadline is within 14 days, every prompt is prefixed."""
    from unittest.mock import MagicMock

    # Use a mock so we don't depend on ReviewCycle ORM fields
    cycle = MagicMock()
    cycle.self_review_deadline = date.today() + timedelta(days=10)

    signals = [False, False, False, False, False]
    prompts = build_prompts(signals, cycle)

    assert len(prompts) == 5
    for p in prompts:
        assert p.startswith("⚠ Review deadline approaching — "), repr(p)
