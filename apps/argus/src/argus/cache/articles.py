"""
Article processing cache to avoid re-enriching the same articles.
"""

from .redis import redis_request


def is_article_processed(redis_url: str, redis_token: str, article_hash: str, ttl_hours: int) -> bool:
    """Check if an article has already been processed (exists in Redis cache)."""
    result = redis_request(redis_url, redis_token, "GET", f"/get/processed:{article_hash}")
    return result is not None and result.get("result") is not None


def mark_article_processed(redis_url: str, redis_token: str, article_hash: str, ttl_hours: int) -> None:
    """Mark an article as processed in Redis with TTL."""
    ttl_seconds = ttl_hours * 3600
    redis_request(redis_url, redis_token, "POST", f"/set/processed:{article_hash}/1/ex/{ttl_seconds}", {})


def get_processed_articles_batch(
    redis_url: str,
    redis_token: str,
    article_hashes: list[str]
) -> set[str]:
    """Check multiple article hashes at once, return set of already-processed ones."""
    if not article_hashes or not redis_url:
        return set()
    
    # Use MGET with URL path format (Upstash REST API)
    keys = [f"processed:{h}" for h in article_hashes]
    path = "/mget/" + "/".join(keys)
    result = redis_request(redis_url, redis_token, "GET", path)
    
    if result and result.get("result"):
        processed = set()
        for i, val in enumerate(result["result"]):
            if val is not None:
                processed.add(article_hashes[i])
        return processed
    return set()


def mark_articles_processed_batch(
    redis_url: str,
    redis_token: str,
    article_hashes: list[str],
    ttl_hours: int
) -> None:
    """Mark multiple articles as processed in a batch."""
    if not article_hashes or not redis_url:
        return
    
    ttl_seconds = ttl_hours * 3600
    
    # Use pipeline for batch writes
    pipeline = []
    for h in article_hashes:
        pipeline.append(["SET", f"processed:{h}", "1", "EX", str(ttl_seconds)])
    
    redis_request(redis_url, redis_token, "POST", "/pipeline", pipeline)
