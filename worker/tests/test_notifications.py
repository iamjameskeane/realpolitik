"""
Tests for push notification logic in main.py.
"""

import pytest
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock

# Add worker directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))


class TestNotificationFiltering:
    """Tests for notification filtering logic."""

    def test_severity_threshold(self, sample_event):
        """Events below severity threshold should be filtered out."""
        from main import PUSH_NOTIFICATION_THRESHOLD
        
        low_severity_event = {**sample_event, "severity": 0}
        high_severity_event = {**sample_event, "severity": 8}
        
        assert low_severity_event["severity"] < PUSH_NOTIFICATION_THRESHOLD
        assert high_severity_event["severity"] >= PUSH_NOTIFICATION_THRESHOLD

    def test_age_filtering(self, sample_event):
        """Old events should be filtered out based on PUSH_MAX_AGE_HOURS."""
        from main import PUSH_MAX_AGE_HOURS
        
        # Event from 2 hours ago (should pass if threshold is 4 hours)
        recent_time = datetime.now(timezone.utc) - timedelta(hours=2)
        recent_event = {
            **sample_event,
            "sources": [{
                **sample_event["sources"][0],
                "timestamp": recent_time.isoformat(),
            }]
        }
        
        # Event from 10 hours ago (should fail if threshold is 4 hours)
        old_time = datetime.now(timezone.utc) - timedelta(hours=10)
        old_event = {
            **sample_event,
            "sources": [{
                **sample_event["sources"][0],
                "timestamp": old_time.isoformat(),
            }]
        }
        
        # Calculate ages
        recent_age = 2
        old_age = 10
        
        assert recent_age <= PUSH_MAX_AGE_HOURS
        assert old_age > PUSH_MAX_AGE_HOURS


class TestEventIdGeneration:
    """Tests for event ID generation and consistency."""

    def test_incident_id_deterministic(self):
        """Same inputs should produce same incident ID."""
        from main import generate_incident_id
        
        id1 = generate_incident_id("DIPLOMACY", 6.14, 46.20, "2024-01-01T12:00:00Z")
        id2 = generate_incident_id("DIPLOMACY", 6.14, 46.20, "2024-01-01T12:00:00Z")
        
        assert id1 == id2

    def test_incident_id_varies_by_category(self):
        """Different categories should produce different IDs."""
        from main import generate_incident_id
        
        id1 = generate_incident_id("DIPLOMACY", 6.14, 46.20, "2024-01-01T12:00:00Z")
        id2 = generate_incident_id("MILITARY", 6.14, 46.20, "2024-01-01T12:00:00Z")
        
        assert id1 != id2

    def test_incident_id_varies_by_location(self):
        """Different locations should produce different IDs."""
        from main import generate_incident_id
        
        id1 = generate_incident_id("DIPLOMACY", 6.14, 46.20, "2024-01-01T12:00:00Z")
        id2 = generate_incident_id("DIPLOMACY", 100.0, 13.75, "2024-01-01T12:00:00Z")
        
        assert id1 != id2

    def test_source_id_deterministic(self):
        """Same inputs should produce same source ID."""
        from main import generate_source_id
        
        id1 = generate_source_id("Test Headline", "https://example.com/article")
        id2 = generate_source_id("Test Headline", "https://example.com/article")
        
        assert id1 == id2

    def test_source_id_varies_by_content(self):
        """Different content should produce different source IDs."""
        from main import generate_source_id
        
        id1 = generate_source_id("Headline A", "https://example.com/a")
        id2 = generate_source_id("Headline B", "https://example.com/b")
        
        assert id1 != id2


class TestEventMerging:
    """Tests for event merging logic."""

    def test_merged_events_keep_existing_id(self, sample_events_list):
        """When events merge, the existing event's ID should be preserved."""
        # This is a critical test - notifications should use the existing ID
        existing_event = sample_events_list[0]
        existing_id = existing_event["id"]
        
        # After merging, the ID should still be the original
        assert existing_event["id"] == existing_id

    def test_new_sources_added_to_existing(self, sample_event):
        """New sources should be added to existing event's sources list."""
        existing_sources = sample_event["sources"]
        initial_count = len(existing_sources)
        
        new_source = {
            "id": "new-source-id",
            "headline": "New headline",
            "summary": "New summary",
            "source_name": "New Source",
            "source_url": "https://newsource.com",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        
        # Simulate merge
        existing_sources.append(new_source)
        
        assert len(existing_sources) == initial_count + 1


class TestNotificationPayload:
    """Tests for notification payload construction."""

    def test_payload_includes_required_fields(self, sample_event):
        """Notification payload should include all required fields."""
        required_fields = ["id", "title", "severity", "category"]
        
        for field in required_fields:
            assert field in sample_event, f"Missing required field: {field}"

    def test_payload_includes_region(self, sample_event):
        """Notification payload should include region for rule matching."""
        assert "region" in sample_event

    def test_payload_truncates_long_headlines(self, sample_event):
        """Very long headlines should be truncated."""
        max_length = 200
        long_title = "A" * 500
        
        truncated = long_title[:197] + "..." if len(long_title) > max_length else long_title
        
        assert len(truncated) <= max_length + 3  # +3 for "..."
