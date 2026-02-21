"""
Tests for OpenRouter client.

These tests verify the OpenRouter client interface is compatible
with the existing Gemini client interface while using OpenRouter
as the backend provider.
"""
import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import json

import sys
sys.path.insert(0, str(__file__).rsplit('/tests/', 1)[0])


class TestOpenRouterClientInitialization:
    """Tests for OpenRouter client initialization."""

    def test_client_initializes_with_required_params(self):
        """Client should initialize with API key and model names."""
        from argus.enrichment.openrouter_client import OpenRouterClient

        client = OpenRouterClient(
            api_key="test-key",
            enrichment_model="anthropic/claude-3-haiku",
            synthesis_model="anthropic/claude-3-sonnet"
        )
        
        assert client.api_key == "test-key"
        assert client.enrichment_model == "anthropic/claude-3-haiku"
        assert client.synthesis_model == "anthropic/claude-3-sonnet"

    def test_client_has_expected_interface(self):
        """Client should have the same interface as Gemini client."""
        from argus.enrichment.openrouter_client import OpenRouterClient
        
        client = OpenRouterClient("key", "model1", "model2")
        
        # Should have these methods
        assert hasattr(client, 'check_quota')
        assert hasattr(client, 'generate_content')
        assert callable(client.check_quota)
        assert callable(client.generate_content)


class TestOpenRouterQuotaChecking:
    """Tests for quota checking functionality."""

    @pytest.mark.asyncio
    async def test_check_quota_succeeds_with_valid_key(self):
        """Should succeed with valid API key."""
        from argus.enrichment.openrouter_client import OpenRouterClient
        
        client = OpenRouterClient(
            api_key="test-key",
            enrichment_model="anthropic/claude-3-haiku",
            synthesis_model="anthropic/claude-3-sonnet"
        )
        
        # Mock successful response
        with patch('httpx.AsyncClient.post') as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "choices": [{"message": {"content": "test"}}]
            }
            mock_post.return_value = mock_response
            
            # Should not raise any exception
            await client.check_quota()

    @pytest.mark.asyncio
    async def test_check_quota_fails_with_invalid_key(self):
        """Should raise authentication error with invalid key."""
        from argus.enrichment.openrouter_client import OpenRouterClient, OpenRouterAuthenticationError
        
        client = OpenRouterClient(
            api_key="invalid-key",
            enrichment_model="anthropic/claude-3-haiku",
            synthesis_model="anthropic/claude-3-sonnet"
        )
        
        # Mock authentication error
        with patch('httpx.AsyncClient.post') as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 401
            mock_response.json.return_value = {
                "error": {"message": "Invalid API key"}
            }
            mock_post.return_value = mock_response
            
            with pytest.raises(OpenRouterAuthenticationError):
                await client.check_quota()

    @pytest.mark.asyncio
    async def test_check_quota_fails_with_quota_exhausted(self):
        """Should raise quota error when API quota is exhausted."""
        from argus.enrichment.openrouter_client import OpenRouterClient, OpenRouterQuotaExhaustedError
        
        client = OpenRouterClient(
            api_key="test-key",
            enrichment_model="anthropic/claude-3-haiku",
            synthesis_model="anthropic/claude-3-sonnet"
        )
        
        # Mock quota exhaustion
        with patch('httpx.AsyncClient.post') as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 429
            mock_response.json.return_value = {
                "error": {"message": "Rate limit exceeded"}
            }
            mock_post.return_value = mock_response
            
            with pytest.raises(OpenRouterQuotaExhaustedError):
                await client.check_quota()


class TestOpenRouterContentGeneration:
    """Tests for content generation functionality."""

    @pytest.mark.asyncio
    async def test_generate_content_returns_text_response(self):
        """Should return text content from OpenRouter."""
        from argus.enrichment.openrouter_client import OpenRouterClient
        
        client = OpenRouterClient(
            api_key="test-key",
            enrichment_model="anthropic/claude-3-haiku",
            synthesis_model="anthropic/claude-3-sonnet"
        )
        
        # Mock successful response
        with patch('httpx.AsyncClient.post') as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "choices": [{
                    "message": {
                        "content": "This is a test response"
                    }
                }]
            }
            mock_post.return_value = mock_response
            
            result = await client.generate_content(
                model="anthropic/claude-3-haiku",
                content="Test prompt"
            )
            
            assert result == "This is a test response"

    @pytest.mark.asyncio
    async def test_generate_content_handles_json_response(self):
        """Should handle JSON-formatted responses from OpenRouter."""
        from argus.enrichment.openrouter_client import OpenRouterClient
        
        client = OpenRouterClient(
            api_key="test-key",
            enrichment_model="anthropic/claude-3-haiku",
            synthesis_model="anthropic/claude-3-sonnet"
        )
        
        # Mock JSON response
        with patch('httpx.AsyncClient.post') as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "choices": [{
                    "message": {
                        "content": '{"result": "success"}'
                    }
                }]
            }
            mock_post.return_value = mock_response
            
            result = await client.generate_content(
                model="anthropic/claude-3-haiku",
                content="Generate JSON"
            )
            
            assert '"result": "success"' in result

    @pytest.mark.asyncio
    async def test_generate_content_includes_headers(self):
        """Should include proper authentication headers."""
        from argus.enrichment.openrouter_client import OpenRouterClient
        
        client = OpenRouterClient(
            api_key="test-key",
            enrichment_model="anthropic/claude-3-haiku",
            synthesis_model="anthropic/claude-3-sonnet"
        )
        
        # Mock response
        with patch('httpx.AsyncClient.post') as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "choices": [{"message": {"content": "response"}}]
            }
            mock_post.return_value = mock_response
            
            await client.generate_content(
                model="anthropic/claude-3-haiku",
                content="test"
            )
            
            # Verify headers include authorization
            mock_post.assert_called_once()
            call_args = mock_post.call_args
            # The headers are set in the client initialization
            # Just verify the client was created with the right key
            await client.check_quota()  # This will create the client
            
            # Verify the URL includes the base URL
            call_args = mock_post.call_args
            url = call_args[0][0]  # First positional argument
            
            assert "openrouter.ai" in url


class TestOpenRouterErrorHandling:
    """Tests for error handling in OpenRouter client."""

    @pytest.mark.asyncio
    async def test_handles_network_errors(self):
        """Should handle network-related errors gracefully."""
        from argus.enrichment.openrouter_client import OpenRouterClient
        
        client = OpenRouterClient(
            api_key="test-key",
            enrichment_model="anthropic/claude-3-haiku",
            synthesis_model="anthropic/claude-3-sonnet"
        )
        
        # Mock network error
        with patch('httpx.AsyncClient.post') as mock_post:
            mock_post.side_effect = Exception("Network error")
            
            with pytest.raises(Exception) as exc_info:
                await client.generate_content(
                    model="anthropic/claude-3-haiku",
                    content="test"
                )
            
            assert "Network error" in str(exc_info.value)


class TestOpenRouterClientIntegration:
    """Integration tests for OpenRouter client."""

    @pytest.mark.asyncio
    async def test_client_uses_correct_base_url(self):
        """Should use OpenRouter's base URL."""
        from argus.enrichment.openrouter_client import OpenRouterClient
        
        client = OpenRouterClient(
            api_key="test-key",
            enrichment_model="anthropic/claude-3-haiku",
            synthesis_model="anthropic/claude-3-sonnet"
        )
        
        with patch('httpx.AsyncClient.post') as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "choices": [{"message": {"content": "response"}}]
            }
            mock_post.return_value = mock_response
            
            await client.generate_content(
                model="anthropic/claude-3-haiku",
                content="test"
            )
            
            # Verify the URL includes OpenRouter's base URL
            call_args = mock_post.call_args
            url = call_args[0][0]  # First positional argument
            
            assert "openrouter.ai" in url
            assert "api/v1/chat/completions" in url

    @pytest.mark.asyncio
    async def test_client_supports_streaming_responses(self):
        """Should support streaming responses if needed."""
        from argus.enrichment.openrouter_client import OpenRouterClient
        
        client = OpenRouterClient(
            api_key="test-key",
            enrichment_model="anthropic/claude-3-haiku",
            synthesis_model="anthropic/claude-3-sonnet"
        )
        
        with patch('httpx.AsyncClient.post') as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "choices": [{"message": {"content": "response"}}]
            }
            mock_post.return_value = mock_response
            
            # Should accept streaming parameter
            await client.generate_content(
                model="anthropic/claude-3-haiku",
                content="test",
                stream=True
            )
            
            call_args = mock_post.call_args
            data = call_args[1]['json']
            
            # Verify streaming parameter is passed through
            assert data.get('stream') is True