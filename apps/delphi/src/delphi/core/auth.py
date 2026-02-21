"""Authentication and authorization - MVP approach with no auth for development"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any
import structlog

from .config import settings

logger = structlog.get_logger()

# Security scheme for OpenAPI documentation
security = HTTPBearer(auto_error=False)

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Dict[str, Any]:
    """
    Get current authenticated user.
    
    MVP Approach: For development, returns a mock user.
    Production: This will validate JWT tokens from Styx gateway.
    """
    
    # MVP: No authentication for development
    if settings.environment == "development":
        logger.debug("Development mode: returning mock user")
        return {
            "sub": "dev-user-123",
            "email": "dev@example.com",
            "role": "analyst",
            "permissions": ["read:events", "read:entities", "request:analysis"],
            "tier": "premium"
        }
    
    # Production: Validate JWT from Styx gateway
    if not credentials:
        logger.warning("No credentials provided in production")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        # This is where JWT validation would happen in production
        # For now, we'll decode the token (this will be implemented when Styx sends JWTs)
        user_data = await _validate_jwt_token(credentials.credentials)
        
        logger.info("User authenticated", user_id=user_data.get("sub"))
        return user_data
        
    except Exception as e:
        logger.error("JWT validation failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def _validate_jwt_token(token: str) -> Dict[str, Any]:
    """
    Validate JWT token from Styx gateway.
    
    In production, this will:
    1. Verify the token signature using the shared secret
    2. Check token expiration
    3. Validate the issuer
    4. Return user claims
    """
    try:
        # TODO: Implement JWT validation with python-jose or similar
        # For now, return mock data
        # This will be implemented when Styx Phase 2 (JWT auth) is complete
        
        return {
            "sub": "user-from-jwt",
            "email": "user@example.com", 
            "role": "analyst",
            "permissions": ["read:events", "read:entities", "request:analysis"],
            "tier": "premium"
        }
        
    except Exception as e:
        logger.error("JWT decode failed", error=str(e))
        raise

def require_permission(permission: str):
    """
    Dependency to require specific permission.
    
    Usage:
    @router.get("/admin")
    async def admin_endpoint(user=Depends(require_permission("admin:access"))):
        ...
    """
    def permission_checker(user=Depends(get_current_user)):
        user_permissions = user.get("permissions", [])
        if permission not in user_permissions:
            logger.warning(
                "Permission denied",
                user_id=user.get("sub"),
                required_permission=permission,
                user_permissions=user_permissions
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission}' required"
            )
        return user
    
    return permission_checker

def require_tier(minimum_tier: str):
    """
    Dependency to require minimum subscription tier.
    
    Usage:
    @router.get("/premium")
    async def premium_endpoint(user=Depends(require_tier("premium"))):
        ...
    """
    tier_hierarchy = ["free", "basic", "premium", "enterprise"]
    
    def tier_checker(user=Depends(get_current_user)):
        user_tier = user.get("tier", "free")
        if tier_hierarchy.index(user_tier) < tier_hierarchy.index(minimum_tier):
            logger.warning(
                "Tier requirement not met",
                user_id=user.get("sub"),
                required_tier=minimum_tier,
                user_tier=user_tier
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"'{minimum_tier}' tier required"
            )
        return user
    
    return tier_checker

# Predefined permission requirements
READ_EVENTS = require_permission("read:events")
READ_ENTITIES = require_permission("read:entities") 
REQUEST_ANALYSIS = require_permission("request:analysis")
ADMIN_ACCESS = require_permission("admin:access")
PREMIUM_TIER = require_tier("premium")