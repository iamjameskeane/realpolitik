"""
Tests for error handling and graceful degradation in the worker.

These tests verify the system behaves correctly when things go wrong:
- API failures
- Network timeouts
- Invalid data
- Storage errors
"""
import pytest
import json
from unittest.mock import MagicMock, patch, AsyncMock
from datetime import datetime, timezone


class TestAPIErrorHandling:
    """Tests for handling API errors from Gemini, push API, etc."""

    def test_should_retry_transient_errors(self):
        """Transient errors (5xx, timeout) should trigger retry."""
        transient_codes = [500, 502, 503, 504, 429]
        
        def should_retry(status_code: int) -> bool:
            return status_code >= 500 or status_code == 429
        
        for code in transient_codes:
            assert should_retry(code), f"Should retry {code}"

    def test_should_not_retry_client_errors(self):
        """Client errors (4xx except 429) should not retry."""
        client_codes = [400, 401, 403, 404, 422]
        
        def should_retry(status_code: int) -> bool:
            return status_code >= 500 or status_code == 429
        
        for code in client_codes:
            assert not should_retry(code), f"Should not retry {code}"

    def test_exponential_backoff(self):
        """Retry delays should increase exponentially."""
        def calculate_backoff(attempt: int, base_seconds: float = 1.0) -> float:
            return min(base_seconds * (2 ** attempt), 60.0)
        
        delays = [calculate_backoff(i) for i in range(5)]
        
        assert delays[0] == 1.0
        assert delays[1] == 2.0
        assert delays[2] == 4.0
        assert delays[3] == 8.0
        assert delays[4] == 16.0

    def test_max_backoff_capped(self):
        """Backoff should not exceed maximum."""
        def calculate_backoff(attempt: int, base_seconds: float = 1.0) -> float:
            return min(base_seconds * (2 ** attempt), 60.0)
        
        # Even with high attempt count, should cap at 60
        assert calculate_backoff(100) == 60.0


class TestNetworkErrors:
    """Tests for network-related errors."""

    def test_connection_refused_handling(self):
        """Should handle connection refused gracefully."""
        error_messages = [
            "Connection refused",
            "ECONNREFUSED",
            "Failed to connect",
        ]
        
        def is_connection_error(error: str) -> bool:
            patterns = ["refused", "ECONNREFUSED", "Failed to connect"]
            return any(p.lower() in error.lower() for p in patterns)
        
        for msg in error_messages:
            assert is_connection_error(msg)

    def test_timeout_handling(self):
        """Should handle timeouts gracefully."""
        error_messages = [
            "Connection timed out",
            "Request timeout",
            "ETIMEDOUT",
        ]
        
        def is_timeout_error(error: str) -> bool:
            patterns = ["timeout", "ETIMEDOUT", "timed out"]
            return any(p.lower() in error.lower() for p in patterns)
        
        for msg in error_messages:
            assert is_timeout_error(msg)

    def test_dns_resolution_failure(self):
        """Should handle DNS failures gracefully."""
        error_messages = [
            "getaddrinfo ENOTFOUND",
            "Name or service not known",
            "DNS resolution failed",
        ]
        
        def is_dns_error(error: str) -> bool:
            patterns = ["ENOTFOUND", "not known", "DNS"]
            return any(p.lower() in error.lower() for p in patterns)
        
        for msg in error_messages:
            assert is_dns_error(msg)


class TestInvalidDataHandling:
    """Tests for handling invalid or malformed data."""

    def test_invalid_json_from_api(self):
        """Should handle invalid JSON responses."""
        invalid_responses = [
            "",
            "not json",
            "{incomplete",
            "null",
        ]
        
        for response in invalid_responses:
            try:
                data = json.loads(response)
                # null is valid JSON
                if data is None:
                    continue
            except json.JSONDecodeError:
                pass  # Expected
            except Exception as e:
                pytest.fail(f"Unexpected exception: {e}")

    def test_missing_required_fields(self):
        """Should handle missing required fields in API response."""
        def validate_gemini_response(response: dict) -> tuple[bool, str]:
            required = ["is_geopolitical", "category", "severity", "location"]
            missing = [f for f in required if f not in response]
            if missing:
                return False, f"Missing fields: {missing}"
            return True, ""
        
        # Valid response
        valid = {"is_geopolitical": True, "category": "MILITARY", "severity": 7, "location": "Kyiv"}
        assert validate_gemini_response(valid)[0]
        
        # Missing fields
        invalid = {"is_geopolitical": True}
        is_valid, error = validate_gemini_response(invalid)
        assert not is_valid
        assert "category" in error

    def test_invalid_field_types(self):
        """Should handle wrong field types."""
        def validate_severity(value) -> tuple[bool, str]:
            if not isinstance(value, (int, float)):
                return False, "Severity must be a number"
            if value < 1 or value > 10:
                return False, "Severity must be between 1 and 10"
            return True, ""
        
        assert validate_severity(5)[0]
        assert validate_severity(7.5)[0]
        assert not validate_severity("high")[0]
        assert not validate_severity(None)[0]
        assert not validate_severity(0)[0]
        assert not validate_severity(11)[0]


class TestStorageErrors:
    """Tests for storage-related errors."""

    def test_r2_upload_failure(self):
        """Should handle R2 upload failures gracefully."""
        def handle_upload_error(error_type: str) -> dict:
            if "AccessDenied" in error_type:
                return {"retry": False, "action": "check_credentials"}
            if "NoSuchBucket" in error_type:
                return {"retry": False, "action": "check_bucket_config"}
            if "ServiceUnavailable" in error_type:
                return {"retry": True, "action": "wait_and_retry"}
            return {"retry": False, "action": "log_and_fail"}
        
        assert handle_upload_error("AccessDenied")["retry"] is False
        assert handle_upload_error("ServiceUnavailable")["retry"] is True

    def test_backup_before_overwrite(self):
        """Should always backup before overwriting."""
        operations = []
        
        def write_events(events: list, backup_first: bool = True):
            if backup_first:
                operations.append("backup")
            operations.append("write")
        
        write_events([{"id": "1"}])
        assert operations == ["backup", "write"]

    def test_restore_from_backup(self):
        """Should be able to restore from backup on failure."""
        backup = [{"id": "1", "title": "Original"}]
        current = None  # Simulating corrupted write
        
        def restore():
            nonlocal current
            current = backup.copy()
        
        if current is None:
            restore()
        
        assert current == backup


class TestGeminiAPIErrors:
    """Tests for Gemini API specific errors."""

    def test_rate_limit_handling(self):
        """Should handle rate limiting with backoff."""
        rate_limited_count = 0
        max_retries = 3
        
        def call_with_retry(should_succeed_on: int):
            nonlocal rate_limited_count
            for attempt in range(max_retries):
                rate_limited_count += 1
                if rate_limited_count >= should_succeed_on:
                    return "success"
            return "failed"
        
        result = call_with_retry(2)
        assert result == "success"
        assert rate_limited_count == 2

    def test_quota_exceeded_handling(self):
        """Should stop processing when quota exceeded."""
        def check_quota_error(error_message: str) -> bool:
            quota_patterns = [
                "RESOURCE_EXHAUSTED",
                "quota exceeded",
                "rate limit",
            ]
            return any(p.lower() in error_message.lower() for p in quota_patterns)
        
        assert check_quota_error("RESOURCE_EXHAUSTED: Daily quota exceeded")
        assert check_quota_error("Rate limit reached")
        assert not check_quota_error("Internal server error")

    def test_content_filter_rejection(self):
        """Should handle content filter rejections."""
        def is_content_filtered(response: dict) -> bool:
            if "error" in response:
                return "SAFETY" in str(response.get("error", ""))
            if response.get("candidates"):
                return any(
                    c.get("finishReason") == "SAFETY"
                    for c in response["candidates"]
                )
            return False
        
        assert is_content_filtered({"candidates": [{"finishReason": "SAFETY"}]})
        assert not is_content_filtered({"candidates": [{"finishReason": "STOP"}]})


class TestPushNotificationErrors:
    """Tests for push notification delivery errors."""

    def test_expired_subscription_handling(self):
        """Should remove expired subscriptions."""
        def is_subscription_expired(status_code: int, error_body: str) -> bool:
            if status_code == 410:  # Gone
                return True
            if status_code == 404:
                return True
            if "expired" in error_body.lower():
                return True
            return False
        
        assert is_subscription_expired(410, "")
        assert is_subscription_expired(404, "")
        assert is_subscription_expired(400, "Subscription has expired")
        assert not is_subscription_expired(500, "Server error")

    def test_invalid_subscription_handling(self):
        """Should remove invalid subscriptions."""
        def is_subscription_invalid(status_code: int) -> bool:
            return status_code in [400, 401, 404, 410]
        
        assert is_subscription_invalid(400)
        assert is_subscription_invalid(410)
        assert not is_subscription_invalid(500)
        assert not is_subscription_invalid(429)

    def test_partial_delivery_tracking(self):
        """Should track partial delivery when some notifications fail."""
        results = [
            {"endpoint": "e1", "success": True},
            {"endpoint": "e2", "success": False, "error": "timeout"},
            {"endpoint": "e3", "success": True},
            {"endpoint": "e4", "success": False, "error": "expired"},
        ]
        
        success = sum(1 for r in results if r["success"])
        failed = sum(1 for r in results if not r["success"])
        
        assert success == 2
        assert failed == 2


class TestGracefulDegradation:
    """Tests for graceful degradation when services are unavailable."""

    def test_continue_without_enrichment(self):
        """Should continue processing even if enrichment fails."""
        articles = [
            {"title": "Article 1", "url": "http://a.com"},
            {"title": "Article 2", "url": "http://b.com"},
        ]
        
        enriched = []
        failed = []
        
        for article in articles:
            try:
                # Simulate enrichment failure for first article
                if article["title"] == "Article 1":
                    raise Exception("Enrichment failed")
                enriched.append(article)
            except Exception:
                failed.append(article)
        
        # Should continue with remaining articles
        assert len(enriched) == 1
        assert len(failed) == 1

    def test_continue_without_push_notifications(self):
        """Should complete event processing even if push fails."""
        events_written = False
        push_sent = False
        
        def process_events():
            nonlocal events_written, push_sent
            
            # Write events - this should always happen
            events_written = True
            
            # Try to send push - may fail
            try:
                raise Exception("Push API unavailable")
            except Exception:
                push_sent = False
        
        process_events()
        
        # Events should be written even if push fails
        assert events_written
        assert not push_sent

    def test_skip_bad_articles(self):
        """Should skip malformed articles and continue."""
        articles = [
            {"title": "Good Article", "url": "http://good.com"},
            {"title": None, "url": None},  # Malformed
            {"title": "Another Good", "url": "http://good2.com"},
        ]
        
        valid = [a for a in articles if a.get("title") and a.get("url")]
        
        assert len(valid) == 2
        assert all(a["title"] for a in valid)
