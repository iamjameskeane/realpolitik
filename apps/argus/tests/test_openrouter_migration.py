"""
Integration tests for OpenRouter migration in Argus.

These tests verify that the entire Argus system works correctly
with the new OpenRouter integration while maintaining backward
compatibility with Gemini.
"""
import pytest
import asyncio
import os
from unittest.mock import AsyncMock, MagicMock, patch

import sys
sys.path.insert(0, str(__file__).rsplit('/tests/', 1)[0])


class TestOpenRouterMigrationIntegration:
    """Integration tests for the complete OpenRouter migration."""

    @pytest.mark.asyncio
    async def test_complete_openrouter_integration(self):
        """Test that the entire system works with OpenRouter."""
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
            from argus.enrichment import AIClient
            from argus.enrichment.ai_client import QuotaExhaustedError, AuthenticationError
            
            # Test configuration loading
            config = Config.from_env()
            config.validate(skip_database=True)
            
            assert config.get_ai_provider() == "openrouter"
            assert config.get_api_key() == "test-openrouter-key"
            
            # Test AI client initialization
            ai_client = AIClient(config)
            assert ai_client.provider_name == "unknown"  # Not yet initialized
            
            # Test model mapping
            model_info = ai_client.get_model_info()
            assert model_info["provider"] is None
            assert "claude" in model_info["enrichment_model"]
            assert "claude" in model_info["synthesis_model"]
            
            # Mock the OpenRouter client
            mock_openrouter = MagicMock()
            async_mock = AsyncMock(return_value="Test response")
            mock_openrouter.generate_content = async_mock
            ai_client.client = mock_openrouter
            ai_client.provider = "openrouter"
            
            # Test content generation
            result = await ai_client.generate_content(
                content="Test content"
            )
            
            assert result == "Test response"
            mock_openrouter.generate_content.assert_called_once()
            
        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value

    @pytest.mark.asyncio
    async def test_provider_fallback_to_gemini(self):
        """Test that system falls back to Gemini when only Gemini key is available."""
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
            from argus.enrichment import AIClient
            
            # Test configuration loading
            config = Config.from_env()
            config.validate(skip_database=True)
            
            assert config.get_ai_provider() == "gemini"
            assert config.get_api_key() == "test-gemini-key"
            
            # Test AI client initialization
            ai_client = AIClient(config)
            
            # Mock the Gemini client
            mock_gemini = MagicMock()
            async_mock = AsyncMock(return_value="Gemini response")
            mock_gemini.generate_content = async_mock
            ai_client.client = mock_gemini
            ai_client.provider = "gemini"
            
            # Test content generation
            result = await ai_client.generate_content(
                content="Test content"
            )
            
            assert result == "Gemini response"
            mock_gemini.generate_content.assert_called_once()
            
        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value

    @pytest.mark.asyncio
    async def test_main_module_integration(self):
        """Test that main.py can import and use the new AI client."""
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
            # Test that main module can import the new client
            from argus.main import async_main
            from argus.enrichment import AIClient
            from argus.config import Config
            
            # Test configuration loading in main context
            config = Config.from_env()
            assert config.get_ai_provider() == "openrouter"
            
            # Test that AI client can be created
            ai_client = AIClient(config)
            assert ai_client is not None
            
        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value

    def test_environment_configuration_validation(self):
        """Test that environment configuration validation works for both providers."""
        from argus.config import Config
        
        # Test OpenRouter validation
        old_values = {}
        test_values = {
            "OPENROUTER_API_KEY": "test-key",
            "NEWSAPI_KEY": "test-newsapi-key",
            "SUPABASE_URL": "https://test.supabase.co",
            "SUPABASE_SERVICE_KEY": "test-service-key"
        }
        
        for key, value in test_values.items():
            old_values[key] = os.getenv(key)
            os.environ[key] = value
        
        try:
            config = Config.from_env()
            config.validate(skip_database=True)  # Should not raise
            
            assert config.openrouter_api_key == "test-key"
            assert config.gemini_api_key == ""
            
        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value

    def test_module_exports_compatibility(self):
        """Test that module exports maintain backward compatibility."""
        from argus.enrichment import (
            AIClient,
            OpenRouterClient,
            GeminiClient,
            QuotaExhaustedError,
            OpenRouterQuotaExhaustedError,
            GeminiAuthenticationError,
            AuthenticationError
        )
        
        # Should be able to import all expected symbols
        assert AIClient is not None
        assert OpenRouterClient is not None
        assert GeminiClient is not None
        assert QuotaExhaustedError is not None
        assert OpenRouterQuotaExhaustedError is not None
        assert GeminiAuthenticationError is not None
        assert AuthenticationError is not None

    def test_no_provider_fails_validation(self):
        """Test that missing both API keys fails validation."""
        old_values = {}
        test_values = {
            "OPENROUTER_API_KEY": "",
            "GEMINI_API_KEY": "",
            "NEWSAPI_KEY": "test-newsapi-key",
            "SUPABASE_URL": "https://test.supabase.co",
            "SUPABASE_SERVICE_KEY": "test-service-key"
        }
        
        for key, value in test_values.items():
            old_values[key] = os.getenv(key)
            os.environ[key] = value
        
        try:
            from argus.config import Config
            
            config = Config.from_env()
            
            with pytest.raises(ValueError) as exc_info:
                config.validate(skip_database=True)
            
            assert "Either GEMINI_API_KEY or OPENROUTER_API_KEY is required" in str(exc_info.value)
            
        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value


class TestOpenRouterMigrationBenefits:
    """Tests highlighting the benefits of the OpenRouter migration."""

    def test_multiple_provider_support(self):
        """Test that the system now supports multiple AI providers."""
        from argus.config import Config
        from argus.enrichment import AIClient
        
        # Test OpenRouter configuration
        openrouter_config_values = {
            "OPENROUTER_API_KEY": "test-openrouter-key",
            "NEWSAPI_KEY": "test-newsapi-key",
            "SUPABASE_URL": "https://test.supabase.co",
            "SUPABASE_SERVICE_KEY": "test-service-key"
        }
        
        old_values = {}
        for key, value in openrouter_config_values.items():
            old_values[key] = os.getenv(key)
            os.environ[key] = value
        
        try:
            config = Config.from_env()
            config.validate(skip_database=True)
            
            assert config.get_ai_provider() == "openrouter"
            
            # Test Gemini configuration
            os.environ["OPENROUTER_API_KEY"] = ""
            os.environ["GEMINI_API_KEY"] = "test-gemini-key"
            
            config = Config.from_env()
            config.validate(skip_database=True)
            
            assert config.get_ai_provider() == "gemini"
            
        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value

    def test_provider_abstraction_benefits(self):
        """Test that the provider abstraction provides flexibility."""
        from argus.enrichment import AIClient
        from argus.config import Config
        
        # Set OpenRouter environment
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
            config = Config.from_env()
            ai_client = AIClient(config)
            
            # Should have provider-agnostic interface
            assert hasattr(ai_client, 'generate_content')
            assert hasattr(ai_client, 'check_quota')
            assert hasattr(ai_client, 'get_model_info')
            
            # Should be able to get provider info without initialization
            model_info = ai_client.get_model_info()
            assert "provider" in model_info
            assert "enrichment_model" in model_info
            assert "synthesis_model" in model_info
            
        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value