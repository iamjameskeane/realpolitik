"""Rate limiting middleware and utilities"""

from fastapi import Request, HTTPException, Depends
from fastapi.responses import JSONResponse
from typing import Optional, Dict, Any
import structlog

from ..deps.cache import get_lethe_client
from .config import settings
from .auth import get_current_user

logger = structlog.get_logger()

class RateLimitMiddleware:
    """Redis-backed sliding window rate limiting"""
    
    def __init__(self):
        self.enabled = settings.rate_limit_enabled
        self.default_requests = settings.rate_limit_requests
        self.default_window = settings.rate_limit_window
    
    async def check_rate_limit(
        self,
        request: Request,
        user: Optional[Dict[str, Any]] = None,
        endpoint: Optional[str] = None,
        requests: Optional[int] = None,
        window: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Check rate limit for a request
        
        Returns dict with:
        - allowed: bool
        - remaining: int  
        - reset_time: int (Unix timestamp)
        - limit: int
        """
        
        if not self.enabled:
            return {
                "allowed": True,
                "remaining": self.default_requests,
                "reset_time": 0,
                "limit": self.default_requests
            }
        
        try:
            lethe = get_lethe_client()
            
            # Determine rate limit parameters
            requests = requests or self.default_requests
            window = window or self.default_window
            endpoint = endpoint or request.url.path
            
            # Identify the client
            client_id = self._get_client_id(request, user)
            
            # Check rate limit
            allowed, remaining = await lethe.check_rate_limit(
                user_id=client_id,
                endpoint=endpoint,
                limit=requests,
                window=window
            )
            
            # Calculate reset time
            import time
            reset_time = int(time.time()) + window
            
            rate_limit_info = {
                "allowed": allowed,
                "remaining": remaining,
                "reset_time": reset_time,
                "limit": requests
            }
            
            if not allowed:
                logger.warning(
                    "Rate limit exceeded",
                    client_id=client_id,
                    endpoint=endpoint,
                    limit=requests
                )
            
            return rate_limit_info
            
        except Exception as e:
            logger.error("Rate limit check failed", error=str(e))
            # Fail open - allow request if rate limiting fails
            return {
                "allowed": True,
                "remaining": requests,
                "reset_time": 0,
                "limit": requests
            }
    
    def _get_client_id(self, request: Request, user: Optional[Dict[str, Any]] = None) -> str:
        """Get client identifier for rate limiting"""
        
        # Prefer user ID if authenticated
        if user and user.get("sub"):
            return f"user:{user['sub']}"
        
        # Use client IP
        client_ip = request.client.host if request.client else "unknown"
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        
        return f"ip:{client_ip}"

# Global rate limiter instance
rate_limiter = RateLimitMiddleware()

async def rate_limit_dependency(
    request: Request,
    endpoint: Optional[str] = None,
    requests: Optional[int] = None,
    window: Optional[int] = None,
    user: Optional[Dict[str, Any]] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    FastAPI dependency for rate limiting
    
    Usage:
    @router.get("/events")
    async def get_events(
        rate_info: Dict = Depends(rate_limit_dependency)
    ):
        # Rate limit info available in rate_info
        ...
    """
    
    rate_info = await rate_limiter.check_rate_limit(
        request=request,
        user=user,
        endpoint=endpoint,
        requests=requests,
        window=window
    )
    
    if not rate_info["allowed"]:
        import time
        reset_time = rate_info["reset_time"]
        
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Try again at {reset_time}",
            headers={
                "X-RateLimit-Limit": str(rate_info["limit"]),
                "X-RateLimit-Remaining": str(rate_info["remaining"]),
                "X-RateLimit-Reset": str(reset_time),
                "Retry-After": str(window)
            }
        )
    
    return rate_info

# Predefined rate limit configurations
STANDARD_RATE_LIMIT = rate_limit_dependency
# STRICT_RATE_LIMIT = rate_limit_dependency(requests=10, window=60)  # 10 per minute
GENEROUS_RATE_LIMIT = rate_limit_dependency(requests=1000, window=3600)  # 1000 per hour

# Endpoint-specific rate limits
ANALYSIS_RATE_LIMIT = rate_limit_dependency(requests=5, window=300)  # 5 analyses per 5 minutes
SEARCH_RATE_LIMIT = rate_limit_dependency(requests=100, window=300)  # 100 searches per 5 minutes
BULK_RATE_LIMIT = rate_limit_dependency(requests=10, window=3600)  # 10 bulk operations per hour