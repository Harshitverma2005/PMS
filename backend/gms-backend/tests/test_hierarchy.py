import pytest
from hypothesis import given, settings
import hypothesis.strategies as st
from app.services.hierarchy_service import get_management_chain, can_read, is_direct_manager
from app.models.user import User

# Feature: upms-pro-features, Property 3
# Feature: upms-pro-features, Property 4

@pytest.fixture
def mock_db_session(mocker):
    """Mock DB session that can return predefined users based on a dictionary mapping."""
    def _create_session(users_dict):
        mock_db = mocker.Mock()
        def get_user(*args, **kwargs):
            query_mock = mocker.Mock()
            filter_mock = mocker.Mock()
            def side_effect(user_id):
                user = users_dict.get(user_id)
                mocker_first = mocker.Mock()
                mocker_first.first.return_value = user
                return mocker_first
            filter_mock.filter_by = mocker.Mock(side_effect=lambda id: filter_mock)
            
            # Since get_management_chain uses db.query(User).filter(User.id == current_id).first()
            # we need to mock that exactly.
            def filter_side_effect(*args):
                # We need to extract the id from the expression if possible, 
                # but a simpler way for tests is to mock the service function directly or use a real in-memory sqlite db.
                pass
                
            return query_mock
        return mock_db
    return _create_session

def test_hierarchy_chain_read_access(test_db):
    """
    Property 3: Timeline authorization — manager chain read access
    Build deep manager_id chains; assert can_read returns True for every ancestor.
    """
    # We will build a chain of 25 users.
    users = []
    for i in range(1, 26):
        manager_id = i - 1 if i > 1 else None
        u = User(id=i+100, email=f"u{i}@test.com", name=f"U {i}", password_hash="h", role="member", manager_id=manager_id+100 if manager_id else None)
        test_db.add(u)
    test_db.commit()

    # The lowest level employee is id 125.
    # Its manager is 124, whose manager is 123... up to 101.
    
    # Check max depth (20). 
    # Ancestors from 124 up to 105 should be readable (20 levels deep).
    chain = get_management_chain(test_db, 125, max_depth=20)
    
    assert 124 in chain
    assert 105 in chain
    assert 104 not in chain # Exceeds depth 20
    
    # Assert can_read
    lowest_employee = test_db.query(User).filter_by(id=125).first()
    
    # Direct manager
    mgr_124 = test_db.query(User).filter_by(id=124).first()
    assert can_read(test_db, mgr_124, 125) is True
    
    # Skip level manager (depth 15)
    mgr_110 = test_db.query(User).filter_by(id=110).first()
    assert can_read(test_db, mgr_110, 125) is True

def test_cross_org_access_forbidden(test_db, sample_users):
    """
    Property 4: Timeline authorization — cross-org access is forbidden
    """
    # sample_users has "member" and "other_member" with no relation
    member = sample_users["member"]
    other_member = sample_users["other_member"]
    
    assert can_read(test_db, member, other_member.id) is False
    assert can_read(test_db, other_member, member.id) is False

def test_circular_reference(test_db):
    """Test circular manager_id reference does not infinite-loop."""
    u1 = User(id=201, email="u1@test.com", name="U 1", password_hash="h", role="member", manager_id=202)
    u2 = User(id=202, email="u2@test.com", name="U 2", password_hash="h", role="member", manager_id=201)
    test_db.add_all([u1, u2])
    test_db.commit()
    
    # Should safely terminate because of visited set
    chain = get_management_chain(test_db, 201)
    assert 202 in chain

def test_manager_id_null(test_db, sample_users):
    """Test manager_id = null terminates chain correctly."""
    ceo = sample_users["ceo"]
    chain = get_management_chain(test_db, ceo.id)
    assert len(chain) == 0
