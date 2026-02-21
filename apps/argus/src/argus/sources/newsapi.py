"""
NewsAPI client for fetching geopolitical headlines.
"""

import httpx


async def fetch_headlines(api_key: str, keywords: list[str], page_size: int = 100) -> list[dict]:
    """
    Fetch top headlines from NewsAPI using async HTTP.
    
    Args:
        api_key: NewsAPI key
        keywords: List of keywords to search for
        page_size: Number of articles to fetch
    
    Returns:
        List of article dicts
    """
    url = "https://newsapi.org/v2/everything"
    params = {
        "apiKey": api_key,
        "language": "en",
        "pageSize": page_size,
        "sortBy": "publishedAt",
        "q": " OR ".join(keywords[:10]),
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params, timeout=30)
        response.raise_for_status()
    
    data = response.json()
    if data.get("status") != "ok":
        raise ValueError(f"NewsAPI error: {data.get('message', 'Unknown error')}")
    
    articles = data.get("articles", [])
    print(f"📰 Fetched {len(articles)} articles from NewsAPI")
    
    return articles
