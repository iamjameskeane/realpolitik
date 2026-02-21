"""Unit tests for rate limiting functionality"""

import pytest
from unittest.mock import Mock, AsyncMock, patch
from fastapi import Request
from src.delphi.core.rate_limiting import RateLimitMiddleware, rate_limit_dependency


@pytest.fixture
def rate_limit_middleware():
    """Create rate limit middleware instance"""
    return RateLimitMiddleware()


@pytest.mark.asyncio
async def test_rate_limit_disabled(rate_limit_middleware):
    """Test that rate limiting works when disabled"""
    rate_limit_middleware.enabled = False
    
    request = Mock(spec=Request)
    request.url.path = "/api/test"
    request.client = Mock()
    request.client.host = "127.0.0.1"
    
    result = await rate_limit_middleware.check_rate_limit(request)
    
    assert result["allowed"] is True
    assert result["remaining"] == 100  # Default value
    assert result["limit"] == 100


@pytest.mark.asyncio
async def test_rate_limit_enabled_allowed(rate_limit_middleware):
    """Test rate limiting when request is allowed"""
    rate_limit_middleware.enabled = True
    
    request = Mock(spec=Request)
    request.url.path = "/api/test"
    request.client = Mock()
    request.client.host = "127.0.0.1"
    
    # Mock Redis client
    with patch('src.delphi.core.rate_limiting.get_lethe_client') as mock_get_client:
        mock_client = AsyncMock()
        mock_client.check_rate_limit.return_value = (True, 95)
        mock_get_client.return_value = mock_client
        
        result = await rate_limit_middleware.check_rate_limit(request)
        
        assert result["allowed"] is True
        assert result["remaining"] == 95
        assert result["limit"] == 100
        
        # Verify Redis client was called with correct parameters
        mock_client.check_rate_limit.assert_called_once()
        call_args = mock_client.check_rate_limit.call_args[0]
        assert call_args[0] == "ip:127.0.0.1"  # client_id
        assert call_args[1] == "/api/test"  # endpoint


@pytest.mark.asyncio
async def test_rate_limit_enabled_blocked(rate_limit_middleware):
    """Test rate limiting when request is blocked"""
    rate_limit_middleware.enabled = True
    
    request = Mock(spec=Request)
    request.url.path = "/api/test"
    request.client = Mock()
    request.client.host = "127.0.0.1"
    
    # Mock Redis client to return rate limit exceeded
    with patch('src.delphi.core.rate_limiting.get_lethe_client') as mock_get_client:
        mock_client = AsyncMock()
        mock_client.check_rate_limit.return_value = (False, 0)
        mock_get_client.return_value = mock_client
        
        result = await rate_limit_middleware.check_rate_limit(request)
        
        assert result["allowed"] is False
        assert result["remaining"] == 0


@pytest.mark.asyncio
async def test_rate_limit_with_authenticated_user(rate_limit_middleware):
    """Test rate limiting with authenticated user"""
    rate_limit_middleware.enabled = True
    
    request = Mock(spec=Request)
    request.url.path = "/api/test"
    request.client = Mock()
    request.client.host = "127.0.0.1"
    
    user = {"sub": "user-123"}
    
    # Mock Redis client
    with patch('src.delphi.core.rate_limiting.get_lethe_client') as mock_get_client:
        mock_client = AsyncMock()
        mock_client.check_rate_limit.return_value = (True, 90)
        mock_get_client.return_value = mock_client
        
        result = await rate_limit_middleware.check_rate_limit(request, user=user)
        
        # Verify user ID was used instead of IP
        call_args = mock_client.check_rate_limit.call_args[0]
        assert call_args[0] == "user:user-123"


@pytest.mark.asyncio
async def test_rate_limit_error_handling(rate_limit_middleware):
    """Test rate limiting error handling (fail open)"""
    rate_limit_middleware.enabled = True
    
    request = Mock(spec=Request)
    request.url.path = "/api/test"
    request.client = Mock()
    request.client.host = "127.0.0.1"
    
    # Mock Redis client to raise exception
    with patch('src.delphi.core.rate_limiting.get_lethe_client') as mock_get_client:
        mock_client = AsyncMock()
        mock_client.check_rate_limit.side_effect = Exception("Redis connection failed")
        mock_get_client.return_value = mock_client
        
        result = await rate_limit_middleware.check_rate_limit(request)
        
        # Should fail open and allow request
        assert result["allowed"] is True
        assert result["remaining"] == 100  # Default limit


def test_get_client_id_authenticated_user(rate_limit_middleware):
    """Test client ID generation for authenticated user"""
    request = Mock(spec=Request)
    request.client = Mock()
    request.client.host = "127.0.0.1"
    request.headers = {}
    
    user = {"sub": "user-123"}
    
    client_id = rate_limit_middleware._get_client_id(request, user)
    assert client_id == "user:user-123"


def test_get_client_id_anonymous_user(rate_limit_middleware):
    """Test client ID generation for anonymous user"""
    request = Mock(spec=Request)
    request.client = Mock()
    request.client.host = "127.0.0.1"
    request.headers = {}
    
    user = None
    
    client_id = rate_limit_middleware._get_client_id(request, user)
    assert client_id == "ip:127.0.0.1"


def test_get_client_id_forwarded_for(rate_limit_middleware):
    """Test client ID generation with X-Forwarded-For header"""
    request = Mock(spec=Request)
    request.client = Mock()
    request.client.host = "127.0.0.1"  # Real client IP
    request.headers = {"x-forwarded-for": "203.0.113.45, 198.51.100.32"}
    
    user = None
    
    client_id = rate_limit_middleware._get_client_id(request, user)
    assert client_id == "ip:203.0.113.45"  # First IP in header


@pytest.mark.asyncio
async def test_rate_limit_dependency_creation():
    """Test that rate limit dependency can be created"""
    # This test just ensures the dependency function can be imported and called
    from src.delphi.core.rate_limiting import STANDARD_RATE_LIMIT, STRICT_RATE_LIMIT, GENEROUS_RATE_LIMIT
    
    assert callable(STANDARD_RATE_LIMIT)
    assert callable(STRICT_RATE_LIMIT) 
    assert callable(GENEROUS_RATE_LIMIT)


@pytest.mark.asyncio
async def test_custom_rate_limit_parameters(rate_limit_middleware):
    """Test rate limiting with custom parameters"""
    rate_limit_middleware.enabled = True
    
    request = Mock(spec=Request)
    request.url.path = "/api/test"
    request.client = Mock()
    request.client.host = "127.0.0.1"
    
    # Mock Redis client
    with patch('src.delphi.core.rate_limiting.get_lethe_client') as mock_get_client:
        mock_client = AsyncMock()
        mock_client.check_rate_limit.return_value = (True, 8)
        mock_get_client.return_value = mock_client
        
        result = await rate_limit_middleware.check_rate_limit(
            request=request,
            requests=10,  # Custom limit
            window=60     # Custom window
        )
        
        # Verify custom parameters were used
        call_args = mock_client.check_rate_limit.call_args[0]
        assert call_args[2] == 10  # Custom requests limit
        assert call_args[3] == 60  # Custom window