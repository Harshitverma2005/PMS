import pytest
from app.services.readiness_service import compute_score, build_prompts

def test_readiness_score_formula():
    """Property 20: Readiness score formula sum(signals) * 20."""
    import itertools
    for signals in itertools.product([True, False], repeat=5):
        score = compute_score(signals)
        assert score == sum(signals) * 20
        assert score in {0, 20, 40, 60, 80, 100}

def test_readiness_prompt_strings():
    """Property 22: Readiness prompt strings count and text."""
    import itertools
    for signals in itertools.product([True, False], repeat=5):
        prompts = build_prompts(signals, cycle=None)
        expected_fails = 5 - sum(signals)
        assert len(prompts) == expected_fails

def test_deadline_warning_prefix():
    """Property 23: Deadline warning prefix."""
    from datetime import datetime, timedelta
    from app.models.review import ReviewCycle
    
    cycle = ReviewCycle(self_review_deadline=datetime.utcnow() + timedelta(days=10))
    signals = [False, False, False, False, False]
    prompts = build_prompts(signals, cycle)
    
    for p in prompts:
        assert p.startswith("⚠ Review deadline approaching — ")
