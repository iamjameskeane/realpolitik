"""Custom middleware for request/response processing"""

import time
from typing import Callable
from fastapi import Request, Response
from fastapi.middleware.base import BaseHTTPMiddleware
import structlog
import uuid

logger = structlog.get_logger()

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for request/response logging"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate request ID
        request_id = str(uuid.uuid4())
        
        # Add request ID to request state
        request.state.request_id = request_id
        
        # Start timing
        start_time = time.time()
        
        # Get client info
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "")
        
        # Log incoming request
        logger.info(
            "Incoming request",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            client_ip=client_ip,
            user_agent=user_agent,
            query_params=dict(request.query_params)
        )
        
        try:
            # Process request
            response = await call_next(request)
            
            # Calculate processing time
            process_time = time.time() - start_time
            
            # Add custom headers
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Process-Time"] = str(process_time)
            
            # Log response
            logger.info(
                "Request completed",
                request_id=request_id,
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                process_time=process_time,
                response_size=response.headers.get("content-length", "unknown")
            )
            
            return response
            
        except Exception as e:
            # Calculate processing time for errors
            process_time = time.time() - start_time
            
            logger.error(
                "Request failed",
                request_id=request_id,
                method=request.method,
                path=request.url.path,
                error=str(e),
                process_time=process_time,
                exc_info=True
            )
            
            raise

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware for adding security headers"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        # Add Content Security Policy for development
        if request.url.scheme == "https":
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "connect-src 'self' https: wss:; "
                "img-src 'self' data: https:; "
                "font-src 'self' https://cdn.jsdelivr.net"
            )
        
        return response

class CORSMiddleware(BaseHTTPMiddleware):
    """Custom CORS middleware for more control"""
    
    def __init__(self, app, allow_origins=None, allow_credentials=True, allow_methods=None, allow_headers=None):
        super().__init__(app)
        self.allow_origins = allow_origins or ["*"]
        self.allow_credentials = allow_credentials
        self.allow_methods = allow_methods or ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
        self.allow_headers = allow_headers or ["*"]
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Handle preflight requests
        if request.method == "OPTIONS":
            response = Response()
            self._add_cors_headers(request, response)
            return response
        
        # Process request
        response = await call_next(request)
        
        # Add CORS headers to response
        self._add_cors_headers(request, response)
        
        return response
    
    def _add_cors_headers(self, request: Request, response: Response):
        """Add CORS headers to response"""
        origin = request.headers.get("origin")
        
        # Check if origin is allowed
        if self.allow_origins == ["*"] or origin in self.allow_origins:
            response.headers["Access-Control-Allow-Origin"] = origin or "*"
        
        response.headers["Access-Control-Allow-Credentials"] = str(self.allow_credentials).lower()
        response.headers["Access-Control-Allow-Methods"] = ", ".join(self.allow_methods)
        response.headers["Access-Control-Allow-Headers"] = ", ".join(self.allow_headers)
        response.headers["Access-Control-Max-Age"] = "86400"  # 24 hours

class CacheControlMiddleware(BaseHTTPMiddleware):
    """Middleware for cache control headers"""
    
    def __init__(self, app, default_cache_control: str = "no-cache"):
        super().__init__(app)
        self.default_cache_control = default_cache_control
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        
        # Add cache control for GET requests
        if request.method == "GET" and response.status_code < 400:
            # Check for specific cache rules
            path = request.url.path
            
            if path.startswith("/api/"):
                # API responses should not be cached by default
                response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            elif path.startswith("/health"):
                # Health checks can be cached briefly
                response.headers["Cache-Control"] = "public, max-age=30"
            elif path.startswith("/static/"):
                # Static content can be cached longer
                response.headers["Cache-Control"] = "public, max-age=3600"
            else:
                # Default cache control
                response.headers["Cache-Control"] = self.default_cache_control
        
        return response

class RequestSizeMiddleware(BaseHTTPMiddleware):
    """Middleware for request size limiting"""
    
    def __init__(self, app, max_size: int = 10 * 1024 * 1024):  # 10MB default
        super().__init__(app)
        self.max_size = max_size
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Check Content-Length header
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                size = int(content_length)
                if size > self.max_size:
                    logger.warning(
                        "Request size exceeded",
                        size=size,
                        max_size=self.max_size,
                        path=request.url.path,
                        method=request.method
                    )
                    return Response(
                        content='{"error": {"message": "Request entity too large"}}',
                        status_code=413,
                        media_type="application/json"
                    )
            except ValueError:
                # Invalid content-length header
                pass
        
        # Process request
        return await call_next(request)

class RetryMiddleware(BaseHTTPMiddleware):
    """Middleware for automatic retry of failed requests"""
    
    def __init__(self, app, max_retries: int = 2, retry_delay: float = 0.1):
        super().__init__(app)
        self.max_retries = max_retries
        self.retry_delay = retry_delay
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        last_exception = None
        
        for attempt in range(self.max_retries + 1):
            try:
                return await call_next(request)
            except Exception as e:
                last_exception = e
                
                if attempt < self.max_retries:
                    # Log retry attempt
                    logger.warning(
                        "Request failed, retrying",
                        attempt=attempt + 1,
                        max_retries=self.max_retries,
                        error=str(e),
                        path=request.url.path,
                        method=request.method
                    )
                    
                    # Wait before retry
                    await asyncio.sleep(self.retry_delay * (2 ** attempt))  # Exponential backoff
                else:
                    # All retries failed
                    logger.error(
                        "Request failed after all retries",
                        attempts=attempt + 1,
                        error=str(e),
                        path=request.url.path,
                        method=request.method
                    )
                    raise
        
        # This should never be reached, but just in case
        raise last_exception