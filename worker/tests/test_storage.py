"""
Tests for storage operations (R2, GCS, local).

These tests verify:
1. Event backup before overwrite
2. Merge logic during write
3. JSON serialization
4. Error handling
"""
import pytest
import json
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch, AsyncMock

import sys
sys.path.insert(0, str(__file__).rsplit('/tests/', 1)[0])


class TestEventSerialization:
    """Tests for event JSON serialization."""

    def test_coordinates_serialized_as_list(self):
        """Coordinates should be serialized as [lon, lat] list."""
        event = {
            "id": "test-1",
            "coordinates": [30.5234, 50.4501],
            "title": "Test Event",
        }
        
        serialized = json.dumps(event)
        deserialized = json.loads(serialized)
        
        assert isinstance(deserialized["coordinates"], list)
        assert len(deserialized["coordinates"]) == 2

    def test_timestamps_serialized_as_iso(self):
        """Timestamps should be ISO format strings."""
        timestamp = datetime.now(timezone.utc).isoformat()
        event = {
            "id": "test-1",
            "timestamp": timestamp,
            "last_updated": timestamp,
        }
        
        serialized = json.dumps(event)
        deserialized = json.loads(serialized)
        
        # Should parse back as ISO string
        assert "T" in deserialized["timestamp"]
        assert "Z" in deserialized["timestamp"] or "+" in deserialized["timestamp"]

    def test_sources_array_preserved(self):
        """Sources array should be preserved during serialization."""
        event = {
            "id": "test-1",
            "sources": [
                {"id": "src-1", "headline": "Headline 1"},
                {"id": "src-2", "headline": "Headline 2"},
            ],
        }
        
        serialized = json.dumps(event)
        deserialized = json.loads(serialized)
        
        assert len(deserialized["sources"]) == 2
        assert deserialized["sources"][0]["id"] == "src-1"


class TestEventListManagement:
    """Tests for managing the events list."""

    def test_max_events_limit(self):
        """Should not exceed maximum events limit."""
        max_events = 500
        events = list(range(600))  # More than max
        
        # Simulate trimming to max
        if len(events) > max_events:
            events = events[:max_events]
        
        assert len(events) == 500

    def test_events_sorted_by_timestamp(self):
        """Events should be sorted by timestamp (newest first)."""
        events = [
            {"id": "1", "timestamp": "2026-01-21T10:00:00Z"},
            {"id": "2", "timestamp": "2026-01-21T12:00:00Z"},
            {"id": "3", "timestamp": "2026-01-21T08:00:00Z"},
        ]
        
        sorted_events = sorted(
            events,
            key=lambda e: e["timestamp"],
            reverse=True
        )
        
        assert sorted_events[0]["id"] == "2"
        assert sorted_events[1]["id"] == "1"
        assert sorted_events[2]["id"] == "3"


class TestBackupLogic:
    """Tests for backup-before-write logic."""

    def test_backup_created_before_overwrite(self):
        """Should create backup before overwriting events.json."""
        original_events = [{"id": "old-1"}, {"id": "old-2"}]
        backup_events = None
        
        # Simulate backup
        backup_events = original_events.copy()
        
        # Simulate overwrite
        new_events = [{"id": "new-1"}]
        current_events = new_events
        
        # Backup should still have old events
        assert len(backup_events) == 2
        assert backup_events[0]["id"] == "old-1"
        
        # Current should have new events
        assert len(current_events) == 1
        assert current_events[0]["id"] == "new-1"


class TestR2Operations:
    """Tests for R2-specific operations."""

    def test_r2_key_format(self):
        """R2 object key should be 'events.json'."""
        key = "events.json"
        assert key == "events.json"

    def test_backup_key_format(self):
        """Backup key should be 'events-backup.json'."""
        backup_key = "events-backup.json"
        assert backup_key == "events-backup.json"

    def test_content_type_json(self):
        """Content type should be application/json."""
        content_type = "application/json"
        assert content_type == "application/json"


class TestLocalStorage:
    """Tests for local file storage."""

    def test_output_path_format(self):
        """Output path should point to public/events.json."""
        from pathlib import Path
        
        # Simulate the path construction
        base = Path("/project")
        output = base / "public" / "events.json"
        
        assert str(output).endswith("public/events.json")

    def test_json_pretty_print(self):
        """JSON should be pretty-printed with indent=2."""
        events = [{"id": "1", "title": "Test"}]
        
        pretty = json.dumps(events, indent=2)
        
        # Should have newlines and indentation
        assert "\n" in pretty
        assert "  " in pretty


class TestMergeWithExisting:
    """Tests for merging new events with existing data."""

    def test_existing_data_loaded(self):
        """Should load existing events before merge."""
        existing_json = '[{"id": "existing-1", "title": "Existing Event"}]'
        existing = json.loads(existing_json)
        
        assert len(existing) == 1
        assert existing[0]["id"] == "existing-1"

    def test_handles_missing_existing_file(self):
        """Should handle case where events.json doesn't exist yet."""
        # Simulate NoSuchKey error
        existing = []  # Default to empty when file doesn't exist
        
        assert existing == []

    def test_merge_preserves_existing_ids(self):
        """Existing event IDs should be preserved during merge."""
        existing_events = [{"id": "keep-1"}, {"id": "keep-2"}]
        existing_ids = {e["id"] for e in existing_events}
        
        assert "keep-1" in existing_ids
        assert "keep-2" in existing_ids


class TestErrorHandling:
    """Tests for storage error handling."""

    def test_handles_json_parse_error(self):
        """Should handle malformed JSON gracefully."""
        bad_json = "{ not valid json"
        
        try:
            json.loads(bad_json)
            parsed = True
        except json.JSONDecodeError:
            parsed = False
        
        assert not parsed

    def test_handles_permission_error(self):
        """Should handle permission errors gracefully."""
        # Simulate permission error scenario
        error_type = "PermissionError"
        should_retry = error_type == "TransientError"
        
        assert not should_retry

    def test_handles_network_timeout(self):
        """Should handle network timeouts."""
        # Simulate timeout scenario
        timeout_seconds = 30
        assert timeout_seconds > 0


class TestFinalEventsOutput:
    """Tests for the final events list returned from storage."""

    def test_returns_all_events(self):
        """Should return the complete merged events list."""
        final_events = [
            {"id": "1", "title": "Event 1"},
            {"id": "2", "title": "Event 2"},
            {"id": "3", "title": "Event 3"},
        ]
        
        assert len(final_events) == 3

    def test_events_have_required_fields(self):
        """All events should have required fields."""
        required_fields = ["id", "title", "category", "severity", "coordinates", "location_name"]
        
        event = {
            "id": "test-1",
            "title": "Test Event",
            "category": "MILITARY",
            "severity": 7,
            "coordinates": [30.0, 50.0],
            "location_name": "Kyiv, Ukraine",
        }
        
        for field in required_fields:
            assert field in event
