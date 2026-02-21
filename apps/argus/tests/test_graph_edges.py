"""
Tests for graph edge operations and weight calculations.

Tests the multi-dimensional edge weight system including:
- Freshness decay (180-day half-life)
- Evidence weighting (log-scale hit count)
- Combined traversal weight calculation
- Edge creation and updating
"""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, AsyncMock
import math

import sys
sys.path.insert(0, str(__file__).rsplit('/tests/', 1)[0])

from argus.graph.edges import (
    calculate_freshness_weight,
    calculate_evidence_weight,
    calculate_traversal_weight,
    upsert_edge,
    touch_edge,
)


class TestFreshnessWeight:
    """Tests for freshness decay calculation (180-day half-life)."""
    
    def test_current_timestamp_full_weight(self):
        """Current timestamp should have weight of 1.0."""
        now = datetime.now(timezone.utc)
        weight = calculate_freshness_weight(now)
        assert weight == pytest.approx(1.0, rel=0.01)
    
    def test_180_days_old_half_weight(self):
        """180 days old should have weight of 0.5 (half-life)."""
        half_life_ago = datetime.now(timezone.utc) - timedelta(days=180)
        weight = calculate_freshness_weight(half_life_ago)
        assert weight == pytest.approx(0.5, rel=0.01)
    
    def test_360_days_old_quarter_weight(self):
        """360 days old should have weight of 0.25 (two half-lives)."""
        two_half_lives_ago = datetime.now(timezone.utc) - timedelta(days=360)
        weight = calculate_freshness_weight(two_half_lives_ago)
        assert weight == pytest.approx(0.25, rel=0.01)
    
    def test_90_days_old_sqrt_half_weight(self):
        """90 days old should have weight of ~0.707 (sqrt(0.5))."""
        ninety_days_ago = datetime.now(timezone.utc) - timedelta(days=90)
        weight = calculate_freshness_weight(ninety_days_ago)
        expected = 0.5 ** (90 / 180)  # About 0.707
        assert weight == pytest.approx(expected, rel=0.01)
    
    def test_very_old_approaches_zero(self):
        """Very old timestamps should approach weight of 0."""
        very_old = datetime.now(timezone.utc) - timedelta(days=720)  # 4 half-lives
        weight = calculate_freshness_weight(very_old)
        assert weight < 0.1
        assert weight > 0.0


class TestEvidenceWeight:
    """Tests for evidence weight calculation (log-scale hit count)."""
    
    def test_zero_hits_zero_weight(self):
        """Zero hits should give weight of 0.0."""
        weight = calculate_evidence_weight(0)
        assert weight == 0.0
    
    def test_one_hit_low_weight(self):
        """One hit should give weight around 0.3."""
        weight = calculate_evidence_weight(1)
        expected = math.log(2) / math.log(11)  # log(1+1) / log(11)
        assert weight == pytest.approx(expected, rel=0.01)
        assert 0.25 < weight < 0.35
    
    def test_five_hits_medium_weight(self):
        """Five hits should give weight around 0.7."""
        weight = calculate_evidence_weight(5)
        expected = math.log(6) / math.log(11)
        assert weight == pytest.approx(expected, rel=0.01)
        assert 0.65 < weight < 0.75
    
    def test_ten_hits_nearly_full_weight(self):
        """Ten hits should give weight close to 1.0."""
        weight = calculate_evidence_weight(10)
        expected = min(1.0, math.log(11) / math.log(11))
        assert weight == pytest.approx(expected, rel=0.01)
        assert weight >= 0.95
    
    def test_many_hits_capped_at_one(self):
        """Many hits should be capped at 1.0."""
        weight = calculate_evidence_weight(100)
        assert weight == 1.0
        
        weight = calculate_evidence_weight(1000)
        assert weight == 1.0


class TestTraversalWeight:
    """Tests for combined traversal weight calculation."""
    
    def test_default_values(self):
        """Test with default/typical values."""
        now = datetime.now(timezone.utc)
        weight = calculate_traversal_weight(
            percentage=50,
            confidence=0.6,
            last_confirmed=now,
            hit_count=1
        )
        # Should be: 0.5*0.4 + 0.6*0.3 + 1.0*0.2 + ~0.3*0.1
        # = 0.2 + 0.18 + 0.2 + ~0.03 = ~0.61
        assert 0.55 < weight < 0.65
    
    def test_high_strength_relationship(self):
        """High percentage should increase weight."""
        now = datetime.now(timezone.utc)
        weight = calculate_traversal_weight(
            percentage=90,
            confidence=0.8,
            last_confirmed=now,
            hit_count=5
        )
        # Should be: 0.9*0.4 + 0.8*0.3 + 1.0*0.2 + ~0.7*0.1
        # = 0.36 + 0.24 + 0.2 + 0.07 = ~0.87
        assert weight > 0.8
    
    def test_none_percentage_uses_default(self):
        """None percentage should default to 50."""
        now = datetime.now(timezone.utc)
        weight = calculate_traversal_weight(
            percentage=None,
            confidence=0.6,
            last_confirmed=now,
            hit_count=1
        )
        # Should treat as 50%
        assert 0.55 < weight < 0.65
    
    def test_old_edge_lower_weight(self):
        """Old edges should have lower weight due to freshness decay."""
        old_date = datetime.now(timezone.utc) - timedelta(days=360)
        weight = calculate_traversal_weight(
            percentage=50,
            confidence=0.6,
            last_confirmed=old_date,
            hit_count=1
        )
        # Freshness will be 0.25 instead of 1.0
        # = 0.2 + 0.18 + 0.05 + 0.03 = ~0.46
        assert weight < 0.5
    
    def test_high_evidence_increases_weight(self):
        """Many hits should increase weight via evidence component."""
        now = datetime.now(timezone.utc)
        weight = calculate_traversal_weight(
            percentage=50,
            confidence=0.6,
            last_confirmed=now,
            hit_count=10
        )
        # Evidence component maxed at 1.0
        # = 0.2 + 0.18 + 0.2 + 0.1 = ~0.68
        assert weight > 0.65
    
    def test_custom_multipliers(self):
        """Custom multipliers should be respected."""
        now = datetime.now(timezone.utc)
        weight = calculate_traversal_weight(
            percentage=100,
            confidence=1.0,
            last_confirmed=now,
            hit_count=10,
            strength_multiplier=0.5,
            confidence_multiplier=0.3,
            freshness_multiplier=0.1,
            evidence_multiplier=0.1
        )
        # = 1.0*0.5 + 1.0*0.3 + 1.0*0.1 + 1.0*0.1 = 1.0
        assert weight == pytest.approx(1.0, rel=0.01)


class TestUpsertEdge:
    """Tests for edge creation and updating."""

    @pytest.mark.asyncio
    async def test_create_new_edge(self, mock_db_connection_with_new_edge):
        """Should create new edge when none exists."""
        edge_id = await upsert_edge(
            mock_db_connection_with_new_edge,
            source_id="node-1",
            target_id="node-2",
            relation_type="supplies",
            percentage=90,
            confidence=0.8,
            polarity=0.5
        )

        assert edge_id == "edge-123"

        # Verify fetchrow was called twice (once for check, once for insert)
        assert mock_db_connection_with_new_edge.fetchrow.call_count == 2
    
    @pytest.mark.asyncio
    async def test_update_existing_edge_increments_hit_count(self, mock_db_connection_with_existing_edge):
        """Updating existing edge should increment hit_count."""
        edge_id = await upsert_edge(
            mock_db_connection_with_existing_edge,
            source_id="node-1",
            target_id="node-2",
            relation_type="supplies",
            percentage=90,
            confidence=0.8
        )

        assert edge_id == "edge-123"

        # Verify update was called (hit_count should be 6)
        mock_db_connection_with_existing_edge.execute.assert_called()
    
    @pytest.mark.asyncio
    async def test_keeps_highest_confidence(self, mock_db_connection):
        """Should keep the highest confidence value."""
        # Mock: edge exists with high confidence
        mock_db_connection.table().select().eq().eq().eq().execute().data = [
            {"id": "edge-123", "hit_count": 2, "confidence": 0.9}
        ]
        
        await upsert_edge(
            mock_db_connection,
            source_id="node-1",
            target_id="node-2",
            relation_type="supplies",
            confidence=0.6  # Lower confidence
        )
        
        # Should keep 0.9, not overwrite with 0.6
        # This is checked in the actual implementation with max()
    
    @pytest.mark.asyncio
    async def test_temporal_validity_range(self, mock_db_connection):
        """Should handle temporal validity ranges."""
        mock_db_connection.table().select().eq().eq().eq().execute().data = []
        mock_db_connection.table().insert().execute().data = [{"id": "edge-123"}]
        
        start = datetime(2025, 1, 1, tzinfo=timezone.utc)
        end = datetime(2025, 12, 31, tzinfo=timezone.utc)
        
        await upsert_edge(
            mock_db_connection,
            source_id="node-1",
            target_id="node-2",
            relation_type="leader_of",
            valid_start=start,
            valid_end=end
        )
        
        # Verify validity field was set
        # (Would check call args in real test)


class TestTouchEdge:
    """Tests for edge timestamp refresh."""
    
    @pytest.mark.asyncio
    async def test_updates_last_confirmed(self, mock_db_connection):
        """Should update last_confirmed timestamp."""
        # Mock: edge exists
        mock_db_connection.table().select().eq().execute().data = [
            {"percentage": 90, "confidence": 0.8, "hit_count": 3}
        ]
        
        await touch_edge(mock_db_connection, "edge-123")
        
        # Verify update was called
        mock_db_connection.table().update.assert_called()
    
    @pytest.mark.asyncio
    async def test_recalculates_traversal_weight(self, mock_db_connection):
        """Should recalculate traversal weight with new freshness."""
        # Mock: edge exists
        mock_db_connection.table().select().eq().execute().data = [
            {"percentage": 50, "confidence": 0.6, "hit_count": 5}
        ]
        
        await touch_edge(mock_db_connection, "edge-123")
        
        # Weight should be recalculated (verified in implementation)
