"""
Tests for OpenRouter-only system.

These tests verify that Argus now exclusively uses OpenRouter/OpenAI APIs
and does not support Gemini anymore.
"""
import pytest
import os
from unittest.mock import patch

import sys
sys.path.insert(0, str(__file__).rsplit('/tests/', 1)[0])


class TestOpenRouterOnlySystem:
    """Tests for OpenRouter-only system configuration."""

    def test_config_requires_openrouter_api_key(self):
        """Configuration should require OpenRouter API key."""
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
            
            config = Config.from_env()
            config.validate(skip_database=True)
            
            assert config.openrouter_api_key == "test-openrouter-key"
            assert config.get_ai_provider() == "openrouter"
            
        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value

    def test_config_fails_with_only_gemini_key(self):
        """Configuration should fail if only Gemini API key is provided."""
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
            
            config = Config.from_env()
            
            with pytest.raises(ValueError) as exc_info:
                config.validate(skip_database=True)
            
            assert "OPENROUTER_API_KEY is required" in str(exc_info.value)
            
        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value

    def test_config_ignores_gemini_when_openrouter_available(self):
        """Configuration should ignore Gemini API key when OpenRouter is available."""
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
            
            config = Config.from_env()
            config.validate(skip_database=True)
            
            # Should use OpenRouter even when Gemini is also available
            assert config.get_ai_provider() == "openrouter"
            assert config.get_api_key() == "test-openrouter-key"
            # Gemini key should be completely ignored (not read at all)
            
        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value

    def test_config_fails_without_openrouter_key(self):
        """Configuration should fail when OpenRouter API key is missing."""
        old_values = {}
        test_values = {
            "OPENROUTER_API_KEY": "",
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
            
            assert "OPENROUTER_API_KEY is required" in str(exc_info.value)
            
        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value

    def test_openrouter_model_mapping(self):
        """Should provide correct OpenRouter model names."""
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
            
            config = Config.from_env()
            
            # Test model mappings for OpenRouter
            assert config.get_model_for_provider("enrichment") == "anthropic/claude-3-haiku"
            assert config.get_model_for_provider("synthesis") == "anthropic/claude-3-sonnet"
            
        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value


class TestOpenRouterOnlyAI:
    """Tests for OpenRouter-only AI client."""

    def test_ai_client_requires_openrouter(self):
        """AI client should only work with OpenRouter."""
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
            from argus.enrichment.openrouter_client import OpenRouterClient
            
            config = Config.from_env()
            
            # Should be able to create OpenRouter client directly
            client = OpenRouterClient(
                api_key="test-key",
                enrichment_model="anthropic/claude-3-haiku",
                synthesis_model="anthropic/claude-3-sonnet"
            )
            
            assert client.api_key == "test-key"
            assert client.enrichment_model == "anthropic/claude-3-haiku"
            assert client.synthesis_model == "anthropic/claude-3-sonnet"
            
        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value

    def test_no_gemini_client_in_exports(self):
        """Gemini client should not be available in module exports."""
        # Try to import Gemini client - should fail
        with pytest.raises(ImportError):
            from argus.enrichment import GeminiClient

    def test_openrouter_client_in_exports(self):
        """OpenRouter client should be available in module exports."""
        from argus.enrichment import OpenRouterClient
        
        assert OpenRouterClient is not None
        assert OpenRouterClient.__name__ == "OpenRouterClient"


class TestOpenRouterOnlyMain:
    """Tests for main module OpenRouter-only behavior."""

    def test_main_imports_openrouter_client(self):
        """Main module should import and use OpenRouter client."""
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
            # Test that main module can import
            from argus.main import async_main
            from argus.enrichment import OpenRouterClient
            
            # Should be able to create OpenRouter client
            client = OpenRouterClient(
                api_key="test-key",
                enrichment_model="anthropic/claude-3-haiku",
                synthesis_model="anthropic/claude-3-sonnet"
            )
            
            assert client is not None
            
        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value

    def test_environment_requires_openrouter(self):
        """Environment configuration should require OpenRouter."""
        from argus.config import Config
        
        # Test the validation logic
        old_values = {}
        test_values = {
            "OPENROUTER_API_KEY": "",
            "NEWSAPI_KEY": "test-newsapi-key",
            "SUPABASE_URL": "https://test.supabase.co",
            "SUPABASE_SERVICE_KEY": "test-service-key"
        }
        
        for key, value in test_values.items():
            old_values[key] = os.getenv(key)
            os.environ[key] = value
        
        try:
            config = Config.from_env()
            
            with pytest.raises(ValueError) as exc_info:
                config.validate(skip_database=True)
            
            error_msg = str(exc_info.value)
            assert "OPENROUTER_API_KEY is required" in error_msg
            # Should not mention Gemini at all
            assert "gemini" not in error_msg.lower()
            
        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value