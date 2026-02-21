"""
Tests for article caching/deduplication with Redis.

These tests verify:
1. Batch write to Redis works
2. Batch read (MGET) returns correct results
3. Cache prevents duplicate processing
"""
import pytest
from unittest.mock import patch, MagicMock

import sys
sys.path.insert(0, str(__file__).rsplit('/tests/', 1)[0])

from argus.cache.articles import (
    get_processed_articles_batch,
    mark_articles_processed_batch,
)


class TestRedisArticleCache:
    """Tests for Redis article caching operations."""

    def test_mget_uses_url_path_format(self):
        """MGET should use GET /mget/key1/key2 format, not POST with JSON body.
        
        This is a regression test for the Upstash REST API format issue.
        The POST format was returning [None] for all keys.
        """
        with patch('argus.cache.redis.redis_request') as mock_request:
            mock_request.return_value = {'result': ['1', '1', None]}
            
            hashes = ['hash1', 'hash2', 'hash3']
            result = get_processed_articles_batch(
                'https://redis.example.com',
                'token',
                hashes
            )
            
            # Verify it used GET with URL path format
            mock_request.assert_called_once()
            call_args = mock_request.call_args
            
            assert call_args[0][0] == 'https://redis.example.com'
            assert call_args[0][1] == 'token'
            assert call_args[0][2] == 'GET'  # Must be GET, not POST
            
            # Path should be /mget/processed:hash1/processed:hash2/processed:hash3
            path = call_args[0][3]
            assert path.startswith('/mget/')
            assert 'processed:hash1' in path
            assert 'processed:hash2' in path
            assert 'processed:hash3' in path

    def test_returns_only_found_hashes(self):
        """Should return only hashes that were found in cache."""
        with patch('argus.cache.redis.redis_request') as mock_request:
            # Simulate: hash1 and hash3 found, hash2 not found
            mock_request.return_value = {'result': ['1', None, '1']}
            
            hashes = ['hash1', 'hash2', 'hash3']
            result = get_processed_articles_batch(
                'https://redis.example.com',
                'token',
                hashes
            )
            
            assert result == {'hash1', 'hash3'}
            assert 'hash2' not in result

    def test_returns_empty_set_when_no_url(self):
        """Should return empty set when Redis URL is not configured."""
        result = get_processed_articles_batch(
            '',  # No URL
            'token',
            ['hash1', 'hash2']
        )
        assert result == set()

    def test_returns_empty_set_when_no_hashes(self):
        """Should return empty set when no hashes provided."""
        result = get_processed_articles_batch(
            'https://redis.example.com',
            'token',
            []  # No hashes
        )
        assert result == set()

    def test_handles_redis_failure_gracefully(self):
        """Should return empty set on Redis failure."""
        with patch('argus.cache.redis.redis_request') as mock_request:
            mock_request.return_value = None  # Simulates failure
            
            result = get_processed_articles_batch(
                'https://redis.example.com',
                'token',
                ['hash1', 'hash2']
            )
            
            assert result == set()


class TestBatchWrite:
    """Tests for batch write operations."""

    def test_batch_write_uses_pipeline(self):
        """Batch write should use Redis pipeline for efficiency."""
        with patch('argus.cache.redis.redis_request') as mock_request:
            mock_request.return_value = [{'result': 'OK'}, {'result': 'OK'}]
            
            hashes = ['hash1', 'hash2']
            mark_articles_processed_batch(
                'https://redis.example.com',
                'token',
                hashes,
                48  # TTL hours
            )
            
            mock_request.assert_called_once()
            call_args = mock_request.call_args
            
            assert call_args[0][2] == 'POST'
            assert call_args[0][3] == '/pipeline'
            
            # Check pipeline commands
            pipeline = call_args[0][4]
            assert len(pipeline) == 2
            
            # Each command should be SET with EX (expiry)
            for cmd in pipeline:
                assert cmd[0] == 'SET'
                assert cmd[3] == 'EX'
                assert cmd[4] == str(48 * 3600)  # TTL in seconds

    def test_batch_write_skips_when_no_url(self):
        """Should not make request when Redis URL is not configured."""
        with patch('argus.cache.redis.redis_request') as mock_request:
            mark_articles_processed_batch(
                '',  # No URL
                'token',
                ['hash1', 'hash2'],
                48
            )
            
            mock_request.assert_not_called()

    def test_batch_write_skips_when_no_hashes(self):
        """Should not make request when no hashes provided."""
        with patch('argus.cache.redis.redis_request') as mock_request:
            mark_articles_processed_batch(
                'https://redis.example.com',
                'token',
                [],  # No hashes
                48
            )
            
            mock_request.assert_not_called()
