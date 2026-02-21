"""Unit tests for query routing functionality"""

import pytest
from unittest.mock import AsyncMock, Mock, patch
from src.delphi.core.query_router import QueryRouter


@pytest.fixture
def query_router():
    """Create query router instance"""
    return QueryRouter()


@pytest.mark.asyncio
async def test_analyze_query_pattern_temporal(query_router):
    """Test query pattern analysis for temporal queries"""
    query_params = {
        "start_date": "2024-01-01",
        "end_date": "2024-12-31"
    }
    
    result = query_router._analyze_query_pattern(query_params)
    
    assert result["store"] == "atlas"
    assert result["pattern"] == "temporal"


@pytest.mark.asyncio
async def test_analyze_query_pattern_relationship(query_router):
    """Test query pattern analysis for relationship queries"""
    query_params = {
        "entity_id": "usa",
        "relationships": True
    }
    
    result = query_router._analyze_query_pattern(query_params)
    
    assert result["store"] == "ariadne"
    assert result["pattern"] == "relationship"


@pytest.mark.asyncio
async def test_analyze_query_pattern_semantic(query_router):
    """Test query pattern analysis for semantic similarity"""
    query_params = {
        "similar_to": "evt-123",
        "embeddings": [0.1, 0.2, 0.3]
    }
    
    result = query_router._analyze_query_pattern(query_params)
    
    assert result["store"] == "mnemosyne"
    assert result["pattern"] == "semantic"


@pytest.mark.asyncio
async def test_analyze_query_pattern_text_search(query_router):
    """Test query pattern analysis for text search"""
    query_params = {
        "search": "This is a long search query for events"
    }
    
    result = query_router._analyze_query_pattern(query_params)
    
    assert result["store"] == "atlas_cache"
    assert result["pattern"] == "text_search"


@pytest.mark.asyncio
async def test_analyze_query_pattern_default(query_router):
    """Test query pattern analysis for default case"""
    query_params = {
        "limit": 20,
        "offset": 0
    }
    
    result = query_router._analyze_query_pattern(query_params)
    
    assert result["store"] == "atlas"
    assert result["pattern"] == "temporal"


@pytest.mark.asyncio
async def test_route_temporal_query_with_cache_miss(query_router):
    """Test routing temporal query with cache miss"""
    query_params = {
        "category": "MILITARY",
        "limit": 10
    }
    
    # Mock dependencies
    with patch('src.delphi.core.query_router.get_atlas_client') as mock_get_atlas:
        with patch('src.delphi.core.query_router.get_lethe_client') as mock_get_lethe:
            mock_atlas = AsyncMock()
            mock_atlas.get_events.return_value = [
                {"id": "evt-001", "title": "Test Event"}
            ]
            mock_get_atlas.return_value = mock_atlas
            
            mock_lethe = AsyncMock()
            mock_lethe.get_cached_analysis.return_value = None  # Cache miss
            mock_get_lethe.return_value = mock_lethe
            
            result = await query_router._route_temporal_query(query_params)
            
            assert result["source"] == "database"
            assert result["store"] == "atlas"
            assert len(result["data"]) == 1
            
            # Verify cache was set
            mock_lethe.cache_analysis.assert_called_once()


@pytest.mark.asyncio
async def test_route_temporal_query_with_cache_hit(query_router):
    """Test routing temporal query with cache hit"""
    query_params = {
        "limit": 10
    }
    
    # Mock dependencies
    with patch('src.delphi.core.query_router.get_atlas_client') as mock_get_atlas:
        with patch('src.delphi.core.query_router.get_lethe_client') as mock_get_lethe:
            mock_atlas = AsyncMock()
            mock_get_atlas.return_value = mock_atlas
            
            cached_data = [{"id": "evt-001", "title": "Cached Event"}]
            mock_lethe = AsyncMock()
            mock_lethe.get_cached_analysis.return_value = cached_data  # Cache hit
            mock_get_lethe.return_value = mock_lethe
            
            result = await query_router._route_temporal_query(query_params)
            
            assert result["source"] == "cache"
            assert result["store"] == "redis"
            assert len(result["data"]) == 1
            
            # Verify database was not called
            mock_atlas.get_events.assert_not_called()


@pytest.mark.asyncio
async def test_route_relationship_query(query_router):
    """Test routing relationship query"""
    query_params = {
        "entity_id": "usa",
        "relationships": True
    }
    
    result = await query_router._route_relationship_query(query_params)
    
    assert result["source"] == "graph"
    assert result["store"] == "ariadne"
    assert result["note"] == "Neo4j integration pending"


@pytest.mark.asyncio
async def test_route_semantic_query(query_router):
    """Test routing semantic similarity query"""
    query_params = {
        "similar_to": "evt-123"
    }
    
    result = await query_router._route_semantic_query(query_params)
    
    assert result["source"] == "vector"
    assert result["store"] == "mnemosyne"
    assert result["note"] == "Qdrant integration pending"


@pytest.mark.asyncio
async def test_route_text_search(query_router):
    """Test routing text search query"""
    query_params = {
        "search": "military exercise"
    }
    
    # Mock dependencies
    with patch('src.delphi.core.query_router.get_atlas_client') as mock_get_atlas:
        with patch('src.delphi.core.query_router.get_lethe_client') as mock_get_lethe:
            mock_atlas = AsyncMock()
            mock_atlas.get_events.return_value = [
                {"id": "evt-001", "title": "Military Exercise"}
            ]
            mock_get_atlas.return_value = mock_atlas
            
            mock_lethe = AsyncMock()
            mock_lethe.get_cached_analysis.return_value = None  # Cache miss
            mock_get_lethe.return_value = mock_lethe
            
            result = await query_router._route_text_search(query_params)
            
            assert result["source"] == "database"
            assert result["store"] == "atlas"


@pytest.mark.asyncio
async def test_route_event_query_temporal(query_router):
    """Test complete event query routing for temporal query"""
    query_params = {
        "start_date": "2024-01-01",
        "limit": 20
    }
    
    # Mock dependencies
    with patch('src.delphi.core.query_router.get_atlas_client') as mock_get_atlas:
        with patch('src.delphi.core.query_router.get_lethe_client') as mock_get_lethe:
            mock_atlas = AsyncMock()
            mock_atlas.get_events.return_value = [{"id": "evt-001"}]
            mock_get_atlas.return_value = mock_atlas
            
            mock_lethe = AsyncMock()
            mock_lethe.get_cached_analysis.return_value = None
            mock_get_lethe.return_value = mock_lethe
            
            result = await query_router.route_event_query(query_params)
            
            assert result["store"] == "atlas"
            assert result["pattern"] == "temporal"


@pytest.mark.asyncio
async def test_convenience_functions():
    """Test convenience routing functions"""
    from src.delphi.core.query_router import (
        query_temporal_events,
        query_similar_events,
        query_related_events,
        query_text_search
    )
    
    # Test that functions are imported and callable
    assert callable(query_temporal_events)
    assert callable(query_similar_events)
    assert callable(query_related_events)
    assert callable(query_text_search)


@pytest.mark.asyncio
async def test_routing_error_handling(query_router):
    """Test that routing errors are handled gracefully"""
    # Mock dependencies to raise exception
    with patch('src.delphi.core.query_router.get_atlas_client') as mock_get_atlas:
        with patch('src.delphi.core.query_router.get_lethe_client') as mock_get_lethe:
            mock_atlas = AsyncMock()
            mock_atlas.get_events.side_effect = Exception("Database error")
            mock_get_atlas.return_value = mock_atlas
            
            mock_lethe = AsyncMock()
            mock_lethe.get_cached_analysis.return_value = None
            mock_get_lethe.return_value = mock_lethe
            
            query_params = {"category": "MILITARY"}
            
            # Should raise the exception
            with pytest.raises(Exception) as exc_info:
                await query_router.route_event_query(query_params)
            
            assert "Database error" in str(exc_info.value)