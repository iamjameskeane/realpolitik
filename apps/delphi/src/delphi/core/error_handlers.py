"""Global error handling middleware and handlers"""

from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import structlog
import traceback
from typing import Any, Dict

logger = structlog.get_logger()

class DelphiError(Exception):
    """Base exception for Delphi-specific errors"""
    
    def __init__(self, message: str, code: str = "DELPHI_ERROR", status_code: int = 500, details: Dict[str, Any] = None):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)

class ValidationError(DelphiError):
    """Data validation error"""
    
    def __init__(self, message: str, field: str = None, details: Dict[str, Any] = None):
        super().__init__(message, "VALIDATION_ERROR", 422, details)
        if field:
            self.details["field"] = field

class DatabaseError(DelphiError):
    """Database operation error"""
    
    def __init__(self, message: str, operation: str = None, details: Dict[str, Any] = None):
        super().__init__(message, "DATABASE_ERROR", 500, details)
        if operation:
            self.details["operation"] = operation

class RateLimitError(DelphiError):
    """Rate limit exceeded error"""
    
    def __init__(self, message: str = "Rate limit exceeded", details: Dict[str, Any] = None):
        super().__init__(message, "RATE_LIMIT_EXCEEDED", 429, details)

class AuthenticationError(DelphiError):
    """Authentication failed error"""
    
    def __init__(self, message: str = "Authentication required", details: Dict[str, Any] = None):
        super().__init__(message, "AUTHENTICATION_FAILED", 401, details)

class AuthorizationError(DelphiError):
    """Authorization failed error"""
    
    def __init__(self, message: str = "Insufficient permissions", details: Dict[str, Any] = None):
        super().__init__(message, "AUTHORIZATION_FAILED", 403, details)

class ExternalServiceError(DelphiError):
    """External service error"""
    
    def __init__(self, message: str, service: str = None, details: Dict[str, Any] = None):
        super().__init__(message, "EXTERNAL_SERVICE_ERROR", 502, details)
        if service:
            self.details["service"] = service

# Error handlers
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle FastAPI HTTP exceptions"""
    error_response = {
        "error": {
            "code": exc.status_code,
            "message": exc.detail,
            "type": "HTTPException"
        },
        "timestamp": "TODO",  # Will be added by middleware
        "path": request.url.path,
        "method": request.method
    }
    
    logger.warning(
        "HTTP exception occurred",
        status_code=exc.status_code,
        detail=exc.detail,
        path=request.url.path,
        method=request.method,
        client_ip=request.client.host if request.client else None
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response
    )

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle Pydantic validation errors"""
    error_response = {
        "error": {
            "code": 422,
            "message": "Validation error",
            "type": "ValidationError",
            "details": {
                "validation_errors": exc.errors()
            }
        },
        "timestamp": "TODO",  # Will be added by middleware
        "path": request.url.path,
        "method": request.method
    }
    
    logger.warning(
        "Validation error occurred",
        validation_errors=exc.errors(),
        path=request.url.path,
        method=request.method
    )
    
    return JSONResponse(
        status_code=422,
        content=error_response
    )

async def delphi_exception_handler(request: Request, exc: DelphiError):
    """Handle custom Delphi exceptions"""
    error_response = {
        "error": {
            "code": exc.code,
            "message": exc.message,
            "type": exc.__class__.__name__,
            "details": exc.details
        },
        "timestamp": "TODO",  # Will be added by middleware
        "path": request.url.path,
        "method": request.method
    }
    
    logger.error(
        "Delphi exception occurred",
        error_code=exc.code,
        error_message=exc.message,
        error_details=exc.details,
        path=request.url.path,
        method=request.method
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response
    )

async def general_exception_handler(request: Request, exc: Exception):
    """Handle all other exceptions"""
    error_id = str(id(exc))
    
    error_response = {
        "error": {
            "code": "INTERNAL_ERROR",
            "message": "An internal error occurred",
            "type": "InternalServerError",
            "details": {
                "error_id": error_id
            }
        },
        "timestamp": "TODO",  # Will be added by middleware
        "path": request.url.path,
        "method": request.method
    }
    
    logger.error(
        "Unhandled exception occurred",
        error_type=type(exc).__name__,
        error_message=str(exc),
        error_traceback=traceback.format_exc(),
        error_id=error_id,
        path=request.url.path,
        method=request.method,
        client_ip=request.client.host if request.client else None
    )
    
    return JSONResponse(
        status_code=500,
        content=error_response
    )

# Error response formatters
def format_error_response(
    message: str,
    code: str,
    status_code: int = 500,
    details: Dict[str, Any] = None,
    path: str = None,
    method: str = None
) -> Dict[str, Any]:
    """Format a consistent error response"""
    return {
        "error": {
            "code": code,
            "message": message,
            "type": "DelphiError",
            "details": details or {}
        },
        "timestamp": "TODO",
        "path": path,
        "method": method
    }

def format_validation_error(
    message: str,
    field: str = None,
    value: Any = None,
    path: str = None,
    method: str = None
) -> Dict[str, Any]:
    """Format a validation error response"""
    details = {}
    if field:
        details["field"] = field
    if value is not None:
        details["invalid_value"] = value
    
    return format_error_response(
        message=message,
        code="VALIDATION_ERROR",
        status_code=422,
        details=details,
        path=path,
        method=method
    )

def format_auth_error(
    message: str = "Authentication required",
    path: str = None,
    method: str = None
) -> Dict[str, Any]:
    """Format an authentication error response"""
    return format_error_response(
        message=message,
        code="AUTHENTICATION_FAILED",
        status_code=401,
        path=path,
        method=method
    )

def format_rate_limit_error(
    message: str = "Rate limit exceeded",
    retry_after: int = None,
    path: str = None,
    method: str = None
) -> Dict[str, Any]:
    """Format a rate limit error response"""
    details = {}
    if retry_after:
        details["retry_after"] = retry_after
    
    response = format_error_response(
        message=message,
        code="RATE_LIMIT_EXCEEDED",
        status_code=429,
        details=details,
        path=path,
        method=method
    )
    
    if retry_after:
        response["retry_after"] = retry_after
    
    return response

# Exception utility functions
def raise_validation_error(message: str, field: str = None, value: Any = None):
    """Raise a validation error"""
    raise ValidationError(message, field=field, details={"invalid_value": value} if value is not None else None)

def raise_auth_error(message: str = "Authentication required"):
    """Raise an authentication error"""
    raise AuthenticationError(message)

def raise_rate_limit_error(message: str = "Rate limit exceeded", retry_after: int = None):
    """Raise a rate limit error"""
    raise RateLimitError(message, details={"retry_after": retry_after} if retry_after else None)

def raise_database_error(message: str, operation: str = None):
    """Raise a database error"""
    raise DatabaseError(message, operation=operation)

def raise_external_service_error(message: str, service: str = None):
    """Raise an external service error"""
    raise ExternalServiceError(message, service=service)