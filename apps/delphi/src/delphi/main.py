"""FastAPI application entry point"""

import sys
import os
from pathlib import Path

# Add paths for imports
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent / "libs" / "realpolitik-schema" / "src"))
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent / "libs" / "realpolitik-clients" / "src"))

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import structlog

from api import events, entities, analysis, health
from core.config import settings
from core.rate_limiting import rate_limiter
from deps.database import init_database, close_database
from deps.cache import init_cache, close_cache
from deps.rabbitmq import init_rabbitmq, close_rabbitmq

logger = structlog.get_logger()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    # Startup
    logger.info("Starting Delphi application server", version=settings.version)
    
    try:
        await init_database()
        await init_cache()
        await init_rabbitmq()
        logger.info("All dependencies initialized successfully")
    except Exception as e:
        logger.error("Failed to initialize dependencies", error=str(e))
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down Delphi application server")
    await close_database()
    await close_cache()
    await close_rabbitmq()


async def rate_limit_middleware(request: Request, call_next):
    """Rate limiting middleware"""
    if settings.rate_limit_enabled:
        # Get client info for rate limiting
        from .core.auth import get_current_user
        try:
            user = await get_current_user()
            rate_info = await rate_limiter.check_rate_limit(request, user=user)
            
            # Add rate limit headers to response
            response = await call_next(request)
            if rate_info:
                response.headers["X-RateLimit-Limit"] = str(rate_info["limit"])
                response.headers["X-RateLimit-Remaining"] = str(rate_info["remaining"])
                response.headers["X-RateLimit-Reset"] = str(rate_info["reset_time"])
            
            return response
        except Exception as e:
            # If rate limiting fails, allow request to proceed
            logger.warning("Rate limiting failed, allowing request", error=str(e))
            return await call_next(request)
    else:
        return await call_next(request)

def create_app() -> FastAPI:
    """Create and configure FastAPI application"""
    
    app = FastAPI(
        title="Delphi API Server",
        description="Application server for Realpolitik Geopolitical Intelligence Platform",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.environment != "production" else None,
        redoc_url="/redoc" if settings.environment != "production" else None,
    )
    
    # Add rate limiting middleware
    if settings.rate_limit_enabled:
        app.middleware("http")(rate_limit_middleware)
    
    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Include routers
    app.include_router(health.router, prefix="/health", tags=["health"])
    app.include_router(events.router, prefix="/api/v1/events", tags=["events"])
    app.include_router(entities.router, prefix="/api/v1/entities", tags=["entities"])
    app.include_router(analysis.router, prefix="/api/v1/analysis", tags=["analysis"])
    
    return app

app = create_app()

if __name__ == "__main__":
    import uvicorn
    from core.config import setup_logging
    setup_logging()
    
    uvicorn.run(
        "src.delphi.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.environment == "development",
    )