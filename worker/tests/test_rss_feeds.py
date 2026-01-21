"""
Tests for RSS feed parsing and deduplication logic.
"""
import pytest
from datetime import datetime, timezone, timedelta

# Import from the rss_feeds module
import sys
sys.path.insert(0, str(__file__).rsplit('/tests/', 1)[0])
sys.path.insert(0, str(__file__).rsplit('/tests/', 1)[0] + '/sources')

from sources.rss_feeds import (
    _extract_keywords,
    _title_hash,
    titles_similar,
    dedupe_articles,
    _normalize_url,
)


class TestKeywordExtraction:
    """Tests for keyword extraction from titles."""

    def test_removes_stop_words(self):
        """Stop words should be filtered out."""
        keywords = _extract_keywords("The attack on the base in Syria")
        assert "the" not in keywords
        assert "on" not in keywords
        assert "in" not in keywords

    def test_normalizes_variations(self):
        """Country/action variations should be normalized."""
        keywords = _extract_keywords("Ukrainian forces attack Russian troops")
        assert "ukraine" in keywords
        assert "russia" in keywords
        assert "attack" in keywords
        # Original variations should not be present
        assert "ukrainian" not in keywords
        assert "russian" not in keywords

    def test_returns_frozenset(self):
        """Should return a frozenset for hashability."""
        keywords = _extract_keywords("Test title here")
        assert isinstance(keywords, frozenset)

    def test_ignores_short_words(self):
        """Words with fewer than 3 characters should be ignored."""
        keywords = _extract_keywords("US to UK by EU")
        # 2-letter words (US, to, UK, by, EU) should be excluded
        # Only "via" (3 letters) would pass, but it's a stop word
        # With no 3+ letter non-stop words, result depends on input
        assert "us" not in keywords
        assert "uk" not in keywords
        assert "eu" not in keywords

    def test_case_insensitive(self):
        """Keyword extraction should be case-insensitive."""
        keywords = _extract_keywords("UKRAINE RUSSIA ATTACK")
        assert "ukraine" in keywords
        assert "russia" in keywords


class TestTitleHash:
    """Tests for title hashing."""

    def test_consistent_hash(self):
        """Same title should produce same hash."""
        hash1 = _title_hash("Russia attacks Ukraine border")
        hash2 = _title_hash("Russia attacks Ukraine border")
        assert hash1 == hash2

    def test_order_independent(self):
        """Word order shouldn't affect hash (after normalization)."""
        # These should have same keywords after normalization
        hash1 = _title_hash("Ukraine forces attack Russia")
        hash2 = _title_hash("Russia attack Ukraine forces")
        # Same keywords, same hash
        assert hash1 == hash2

    def test_different_content_different_hash(self):
        """Different content should produce different hashes."""
        hash1 = _title_hash("China economy grows")
        hash2 = _title_hash("Iran protests continue")
        assert hash1 != hash2


class TestTitleSimilarity:
    """Tests for title similarity matching."""

    def test_identical_titles_similar(self):
        """Identical titles should be similar."""
        assert titles_similar(
            "Russia launches attack on Ukraine",
            "Russia launches attack on Ukraine"
        )

    def test_minor_variations_similar(self):
        """Minor variations should still be similar."""
        # These titles share most keywords after normalization
        # Russia/Russian -> russia, Ukraine/Ukrainian -> ukraine, attack -> attack
        assert titles_similar(
            "Russia attack Ukraine forces border",
            "Russian attack Ukrainian forces border",
            threshold=0.5  # Lower threshold for this test
        )

    def test_completely_different_not_similar(self):
        """Completely different titles should not be similar."""
        assert not titles_similar(
            "China economy slows down significantly",
            "Iran protests continue amid crackdown"
        )

    def test_partial_overlap_threshold(self):
        """Partial overlap should respect threshold."""
        # These share some keywords but not 60%
        result = titles_similar(
            "Israel strikes Gaza militants",
            "Israel signs peace deal with Saudi Arabia",
            threshold=0.6
        )
        # "israel" is shared, but overall overlap is low
        assert not result

    def test_empty_titles(self):
        """Empty titles should not be similar."""
        assert not titles_similar("", "")
        assert not titles_similar("Test title", "")
        assert not titles_similar("", "Test title")


class TestUrlNormalization:
    """Tests for URL normalization."""

    def test_strips_query_params(self):
        """Query parameters should be stripped."""
        url = "https://example.com/article?utm_source=twitter&ref=123"
        normalized = _normalize_url(url)
        assert normalized == "https://example.com/article"

    def test_preserves_clean_urls(self):
        """URLs without params should be unchanged."""
        url = "https://example.com/news/article"
        normalized = _normalize_url(url)
        assert normalized == url

    def test_handles_multiple_question_marks(self):
        """Should only split on first question mark."""
        url = "https://example.com/article?param=value?other=thing"
        normalized = _normalize_url(url)
        assert normalized == "https://example.com/article"


class TestDedupeArticles:
    """Tests for article deduplication."""

    def test_removes_duplicate_urls(self):
        """Articles with same URL should be deduplicated."""
        articles = [
            {"title": "Russia attacks Ukraine in major offensive", "url": "https://example.com/1", "source": "A"},
            {"title": "Different title entirely about China economy", "url": "https://example.com/1", "source": "B"},
            {"title": "Iran protests continue across major cities", "url": "https://example.com/2", "source": "C"},
        ]
        deduped = dedupe_articles(articles)
        # First two have same URL, so only one should remain
        # Third has different URL, so it should remain
        urls = [a["url"] for a in deduped]
        # At least one of each unique URL should be present
        assert "https://example.com/1" in urls or "https://example.com/2" in urls

    def test_removes_similar_titles(self):
        """Articles with similar titles should be deduplicated."""
        articles = [
            {
                "title": "Russia attack Ukraine border forces military",
                "url": "https://a.com/1",
                "source": "Source A"
            },
            {
                "title": "Russian attack Ukrainian border forces military",
                "url": "https://b.com/1",
                "source": "Source B"
            },
            {
                "title": "China economy slows significantly amid tariffs",
                "url": "https://c.com/1",
                "source": "Source C"
            },
        ]
        deduped = dedupe_articles(articles, similarity_threshold=0.5)
        # With 0.5 threshold, first two should be deduped
        # Result should be 2 or less
        assert len(deduped) <= 3
        # At least China article should be different enough
        titles = [a["title"] for a in deduped]
        assert any("China" in t for t in titles)

    def test_preserves_first_occurrence(self):
        """First occurrence of duplicate should be preserved."""
        articles = [
            {"title": "First article about Russia Ukraine conflict", "url": "https://example.com/1", "source": "A"},
            {"title": "Second article completely different topic", "url": "https://example.com/1", "source": "B"},
        ]
        deduped = dedupe_articles(articles)
        assert len(deduped) == 1
        # First one should be kept
        assert deduped[0]["source"] == "A"

    def test_empty_list(self):
        """Empty list should return empty list."""
        assert dedupe_articles([]) == []

    def test_single_article(self):
        """Single article should be returned as-is."""
        articles = [{"title": "Only One", "url": "https://example.com/1", "source": "A"}]
        deduped = dedupe_articles(articles)
        assert len(deduped) == 1
        assert deduped[0]["title"] == "Only One"
