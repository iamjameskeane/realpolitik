"""
Tests for unified AI client supporting both Gemini and OpenRouter.

These tests verify that the unified client correctly selects and uses
the appropriate AI provider based on configuration.
"""
import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import os

import sys
sys.path.insert(0, str(__file__).rsplit('/tests/', 1)[0])


class TestUnifiedAIClient:
    """Tests for unified AI client initialization and provider selection."""

    def test_client_initializes_with_openrouter_config(self):
        """Should initialize with OpenRouter when only OpenRouter API key is available."""
        # Set environment for OpenRouter only
        old_values = {}
        test_values = {
            "OPENROUTER_API_KEY": "test-openrouter-key",
            "NEWSAPI_KEY": "test-newsapi-key",
            "SUPABASE_URL": "https://test.supabase.co",
            "SUPABASE_SERVICE_KEY": "test-service-key"
        }
        
        for key, value in test_values.items():
            old_values[key] = os.getenv(key)
            os.environ[key] = value
        
        try:
            from argus.config import Config
            from argus.enrichment.ai_client import AIClient
            
            config = Config.from_env()
            config.validate(skip_database=True)
            
            client = AIClient(config)
            
            # Should be initialized but not yet connected
            assert client.provider is None
            assert client.client is None
            
        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value

    def test_client_initializes_with_gemini_config(self):
        """Should initialize with Gemini when only Gemini API key is available."""
        # Set environment for Gemini only
        old_values = {}
        test_values = {
            "GEMINI_API_KEY": "test-gemini-key",
            "NEWSAPI_KEY": "test-newsapi-key",
            "SUPABASE_URL": "https://test.supabase.co",
            "SUPABASE_SERVICE_KEY": "test-service-key"
        }
        
        for key, value in test_values.items():
            old_values[key] = os.getenv(key)
            os.environ[key] = value
        
        try:
            from argus.config import Config
            from argus.enrichment.ai_client import AIClient
            
            config = Config.from_env()
            config.validate(skip_database=True)
            
            client = AIClient(config)
            
            # Should be initialized but not yet connected
            assert client.provider is None
            assert client.client is None
            
        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value


class TestUnifiedAIProviderSelection:
    """Tests for provider selection logic."""

    @pytest.mark.asyncio
    async def test_provider_selection_openrouter(self):
        """Should select OpenRouter when both API keys are available."""
        # Set environment for both providers (prefers OpenRouter)
        old_values = {}
        test_values = {
            "OPENROUTER_API_KEY": "test-openrouter-key",
            "GEMINI_API_KEY": "test-gemini-key",
            "NEWSAPI_KEY": "test-newsapi-key",
            "SUPABASE_URL": "https://test.supabase.co",
            "SUPABASE_SERVICE_KEY": "test-service-key"
        }
        
        for key, value in test_values.items():
            old_values[key] = os.getenv(key)
            os.environ[key] = value
        
        try:
            from argus.config import Config
            from argus.enrichment.ai_client import AIClient
            
            config = Config.from_env()
            config.validate(skip_database=True)
            
            client = AIClient(config)
            
            # Initialize client
            await client._initialize_client()
            
            assert client.provider == "openrouter"
            
        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value

    @pytest.mark.asyncio
    async def test_provider_selection_openrouter_fallback(self):
        """Should select OpenRouter when OpenRouter API key is available."""
        # Set environment for OpenRouter
        old_values = {}
        test_values = {
            "OPENROUTER_API_KEY": "test-openrouter-key",
            "NEWSAPI_KEY": "test-newsapi-key",
            "SUPABASE_URL": "https://test.supabase.co",
            "SUPABASE_SERVICE_KEY": "test-service-key"
        }

        for key, value in test_values.items():
            old_values[key] = os.getenv(key)
            os.environ[key] = value

        try:
            from argus.config import Config
            from argus.enrichment.ai_client import AIClient

            config = Config.from_env()
            config.validate(skip_database=True)

            client = AIClient(config)

            # Initialize client
            await client._initialize_client()

            assert client.provider == "openrouter"

        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value


class TestUnifiedAIContentGeneration:
    """Tests for content generation with unified client."""

    @pytest.mark.asyncio
    async def test_generate_content_with_openrouter(self):
        """Should generate content using OpenRouter provider."""
        # Set environment for OpenRouter only
        old_values = {}
        test_values = {
            "OPENROUTER_API_KEY": "test-openrouter-key",
            "NEWSAPI_KEY": "test-newsapi-key",
            "SUPABASE_URL": "https://test.supabase.co",
            "SUPABASE_SERVICE_KEY": "test-service-key"
        }
        
        for key, value in test_values.items():
            old_values[key] = os.getenv(key)
            os.environ[key] = value
        
        try:
            from argus.config import Config
            from argus.enrichment.ai_client import AIClient
            
            config = Config.from_env()
            config.validate(skip_database=True)
            
            client = AIClient(config)
            
            # Mock OpenRouter client
            mock_openrouter = MagicMock()
            async_mock = AsyncMock(return_value="OpenRouter response")
            mock_openrouter.generate_content = async_mock
            client.client = mock_openrouter
            client.provider = "openrouter"
            
            result = await client.generate_content(
                content="test content"
            )
            
            assert result == "OpenRouter response"
            mock_openrouter.generate_content.assert_called_once()
            
        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value

    @pytest.mark.asyncio
    async def test_generate_enrichment_content(self):
        """Should generate enrichment content using enrichment model."""
        # Set environment for OpenRouter only
        old_values = {}
        test_values = {
            "OPENROUTER_API_KEY": "test-openrouter-key",
            "NEWSAPI_KEY": "test-newsapi-key",
            "SUPABASE_URL": "https://test.supabase.co",
            "SUPABASE_SERVICE_KEY": "test-service-key"
        }
        
        for key, value in test_values.items():
            old_values[key] = os.getenv(key)
            os.environ[key] = value
        
        try:
            from argus.config import Config
            from argus.enrichment.ai_client import AIClient
            
            config = Config.from_env()
            config.validate(skip_database=True)
            
            client = AIClient(config)
            
            # Mock OpenRouter client
            mock_openrouter = MagicMock()
            async_mock = AsyncMock(return_value="Enrichment response")
            mock_openrouter.generate_content = async_mock
            client.client = mock_openrouter
            client.provider = "openrouter"
            
            result = await client.generate_enrichment_content(
                "test enrichment content"
            )
            
            assert result == "Enrichment response"
            
            # Should use enrichment model
            call_args = mock_openrouter.generate_content.call_args
            assert call_args[1]['model'] == "anthropic/claude-3-haiku"
            
        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value

    @pytest.mark.asyncio
    async def test_generate_synthesis_content(self):
        """Should generate synthesis content using synthesis model."""
        # Set environment for OpenRouter only
        old_values = {}
        test_values = {
            "OPENROUTER_API_KEY": "test-openrouter-key",
            "NEWSAPI_KEY": "test-newsapi-key",
            "SUPABASE_URL": "https://test.supabase.co",
            "SUPABASE_SERVICE_KEY": "test-service-key"
        }
        
        for key, value in test_values.items():
            old_values[key] = os.getenv(key)
            os.environ[key] = value
        
        try:
            from argus.config import Config
            from argus.enrichment.ai_client import AIClient
            
            config = Config.from_env()
            config.validate(skip_database=True)
            
            client = AIClient(config)
            
            # Mock OpenRouter client
            mock_openrouter = MagicMock()
            async_mock = AsyncMock(return_value="Synthesis response")
            mock_openrouter.generate_content = async_mock
            client.client = mock_openrouter
            client.provider = "openrouter"
            
            result = await client.generate_synthesis_content(
                "test synthesis content"
            )
            
            assert result == "Synthesis response"
            
            # Should use synthesis model
            call_args = mock_openrouter.generate_content.call_args
            assert call_args[1]['model'] == "anthropic/claude-3-sonnet"
            
        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value


class TestUnifiedAIErrorHandling:
    """Tests for error handling in unified client."""

    @pytest.mark.asyncio
    async def test_handles_openrouter_import_error(self):
        """Should handle missing OpenRouter client gracefully."""
        # Set environment for OpenRouter only
        old_values = {}
        test_values = {
            "OPENROUTER_API_KEY": "test-openrouter-key",
            "NEWSAPI_KEY": "test-newsapi-key",
            "SUPABASE_URL": "https://test.supabase.co",
            "SUPABASE_SERVICE_KEY": "test-service-key"
        }
        
        for key, value in test_values.items():
            old_values[key] = os.getenv(key)
            os.environ[key] = value
        
        try:
            from argus.config import Config
            from argus.enrichment.ai_client import AIClient
            
            config = Config.from_env()
            config.validate(skip_database=True)
            
            client = AIClient(config)
            
            # Mock missing OpenRouter client
            with patch('argus.enrichment.ai_client.OpenRouterClient', None):
                with pytest.raises(ImportError) as exc_info:
                    await client._initialize_client()
                
                assert "OpenRouter client not available" in str(exc_info.value)
            
        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value

    @pytest.mark.asyncio
    async def test_handles_unsupported_provider(self):
        """Should handle unsupported AI provider gracefully."""
        # Set environment for OpenRouter only
        old_values = {}
        test_values = {
            "OPENROUTER_API_KEY": "test-openrouter-key",
            "NEWSAPI_KEY": "test-newsapi-key",
            "SUPABASE_URL": "https://test.supabase.co",
            "SUPABASE_SERVICE_KEY": "test-service-key"
        }
        
        for key, value in test_values.items():
            old_values[key] = os.getenv(key)
            os.environ[key] = value
        
        try:
            from argus.config import Config
            from argus.enrichment.ai_client import AIClient
            
            config = Config.from_env()
            config.validate(skip_database=True)
            
            client = AIClient(config)
            
            # Mock config to return unsupported provider
            with patch.object(config, 'get_ai_provider', return_value='unsupported'):
                with pytest.raises(ValueError) as exc_info:
                    await client._initialize_client()
                
                assert "Unknown AI provider: unsupported" in str(exc_info.value)
            
        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value


class TestUnifiedAIClientInfo:
    """Tests for client information methods."""

    def test_provider_name_property(self):
        """Should return correct provider name."""
        from argus.config import Config
        from argus.enrichment.ai_client import AIClient
        
        config = Config.from_env()
        client = AIClient(config)
        
        # Before initialization
        assert client.provider_name == "unknown"
        
        # After initialization would be set by provider
        client.provider = "openrouter"
        assert client.provider_name == "openrouter"

    def test_get_model_info(self):
        """Should return model configuration information."""
        # Set environment for OpenRouter only
        old_values = {}
        test_values = {
            "OPENROUTER_API_KEY": "test-openrouter-key",
            "NEWSAPI_KEY": "test-newsapi-key",
            "SUPABASE_URL": "https://test.supabase.co",
            "SUPABASE_SERVICE_KEY": "test-service-key"
        }
        
        for key, value in test_values.items():
            old_values[key] = os.getenv(key)
            os.environ[key] = value
        
        try:
            from argus.config import Config
            from argus.enrichment.ai_client import AIClient
            
            config = Config.from_env()
            config.validate(skip_database=True)
            
            client = AIClient(config)
            model_info = client.get_model_info()
            
            assert "provider" in model_info
            assert "enrichment_model" in model_info
            assert "synthesis_model" in model_info
            
            # Should be configured for OpenRouter
            assert model_info["provider"] is None  # Not initialized yet
            assert model_info["enrichment_model"] == "anthropic/claude-3-haiku"
            assert model_info["synthesis_model"] == "anthropic/claude-3-sonnet"
            
        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value