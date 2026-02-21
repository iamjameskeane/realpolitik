"""Unit tests for authentication system"""

import pytest
from unittest.mock import patch
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from src.delphi.core.auth import get_current_user, require_permission, require_tier


@pytest.mark.asyncio
async def test_get_current_user_development_mode():
    """Test that development mode returns mock user"""
    with patch('src.delphi.core.auth.settings.environment', 'development'):
        user = await get_current_user()
        
        assert user["sub"] == "dev-user-123"
        assert user["email"] == "dev@example.com"
        assert user["role"] == "analyst"
        assert "read:events" in user["permissions"]
        assert "read:entities" in user["permissions"]
        assert "request:analysis" in user["permissions"]


@pytest.mark.asyncio
async def test_get_current_user_production_mode_no_credentials():
    """Test that production mode without credentials raises exception"""
    with patch('src.delphi.core.auth.settings.environment', 'production'):
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user()
        
        assert exc_info.value.status_code == 401
        assert "Invalid authentication credentials" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_get_current_user_production_mode_with_mock_credentials():
    """Test that production mode with credentials returns user data"""
    with patch('src.delphi.core.auth.settings.environment', 'production'):
        # Mock the JWT validation function
        with patch('src.delphi.core.auth._validate_jwt_token') as mock_validate:
            mock_validate.return_value = {
                "sub": "prod-user-123",
                "email": "prod@example.com",
                "role": "analyst",
                "permissions": ["read:events"],
                "tier": "premium"
            }
            
            credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="test-token")
            user = await get_current_user(credentials)
            
            assert user["sub"] == "prod-user-123"
            assert user["role"] == "analyst"
            mock_validate.assert_called_once_with("test-token")


def test_require_permission_success():
    """Test that permission checker passes for authorized user"""
    mock_user = {
        "sub": "test-user",
        "permissions": ["read:events", "read:entities"]
    }

    # Create permission checker
    checker = require_permission("read:events")

    # Should return user without exception
    result = checker(mock_user)
    assert result == mock_user


def test_require_permission_failure():
    """Test that permission checker fails for unauthorized user"""
    mock_user = {
        "sub": "test-user",
        "permissions": ["read:events"]  # Missing admin:access
    }

    # Create permission checker
    checker = require_permission("admin:access")

    # Should raise exception for unauthorized user
    with pytest.raises(HTTPException) as exc_info:
        checker(mock_user)

    assert "admin:access" in str(exc_info.value.detail)


def test_require_tier_success():
    """Test that tier checker passes for authorized user"""
    mock_user = {
        "sub": "test-user",
        "tier": "premium"
    }

    # Create tier checker
    checker = require_tier("basic")

    # Should return user without exception
    result = checker(mock_user)
    assert result == mock_user


def test_require_tier_failure():
    """Test that tier checker fails for unauthorized user"""
    mock_user = {
        "sub": "test-user",
        "tier": "free"  # Below premium
    }

    # Create tier checker
    checker = require_tier("premium")

    # Should raise exception
    with pytest.raises(HTTPException) as exc_info:
        checker(mock_user)
    
    assert exc_info.value.status_code == 403
    assert "premium" in str(exc_info.value.detail)


def test_permission_constants():
    """Test that predefined permission constants are created correctly"""
    from src.delphi.core.auth import READ_EVENTS, READ_ENTITIES, REQUEST_ANALYSIS, ADMIN_ACCESS, PREMIUM_TIER
    
    # These should be callable functions (dependency functions)
    assert callable(READ_EVENTS)
    assert callable(READ_ENTITIES)
    assert callable(REQUEST_ANALYSIS)
    assert callable(ADMIN_ACCESS)
    assert callable(PREMIUM_TIER)


@pytest.mark.asyncio
async def test_jwt_validation_error():
    """Test that JWT validation errors are handled properly"""
    with patch('src.delphi.core.auth.settings.environment', 'production'):
        with patch('src.delphi.core.auth._validate_jwt_token') as mock_validate:
            mock_validate.side_effect = Exception("Invalid token")
            
            credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid-token")
            
            with pytest.raises(HTTPException) as exc_info:
                await get_current_user(credentials)
            
            assert exc_info.value.status_code == 401
            assert "Invalid authentication credentials" in str(exc_info.value.detail)