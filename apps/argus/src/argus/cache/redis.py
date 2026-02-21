"""
Redis client abstraction for caching.
"""

import sys
from typing import Any


def redis_request(
    url: str,
    token: str,
    method: str,
    path: str,
    body: dict | list | None = None
) -> dict | None:
    """
    Make a request to Upstash Redis REST API.
    
    Args:
        url: Redis REST URL
        token: Redis REST token
        method: HTTP method (GET or POST)
        path: Redis command path
        body: Optional request body
    
    Returns:
        Response dict or None on error
    """
    if not url or not token:
        return None
    
    import requests
    
    full_url = f"{url}{path}"
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        if method == "GET":
            resp = requests.get(full_url, headers=headers, timeout=10)
        else:
            resp = requests.post(full_url, headers=headers, json=body, timeout=10)
        
        if resp.status_code == 200:
            return resp.json()
        else:
            # Log non-200 responses for debugging
            print(f"   ⚠️ Redis {method} {path[:50]}: HTTP {resp.status_code}", file=sys.stderr)
    except requests.exceptions.ConnectionError as e:
        # Only log connection errors once per session to avoid spam
        if not getattr(redis_request, '_connection_warned', False):
            print(f"   ⚠️ Redis connection failed - article deduplication disabled", file=sys.stderr)
            print(f"      Check UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN", file=sys.stderr)
            redis_request._connection_warned = True
    except requests.exceptions.Timeout:
        print(f"   ⚠️ Redis timeout on {method} {path[:30]}...", file=sys.stderr)
    except Exception as e:
        print(f"   ⚠️ Redis {method} failed: {type(e).__name__}: {str(e)[:50]}", file=sys.stderr)
    return None
