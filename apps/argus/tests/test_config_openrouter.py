"""
Tests for OpenRouter integration in config system.

These tests verify that the configuration system correctly supports
both Gemini and OpenRouter providers with proper validation and model mapping.
"""
import os
import pytest

import sys
sys.path.insert(0, str(__file__).rsplit('/tests/', 1)[0])


class TestOpenRouterConfig:
    """Tests for OpenRouter configuration support."""

    def test_config_with_database_storage(self):
        """Should work with database storage configuration."""
        # Set required environment variables for database storage
        old_values = {}
        test_values = {
            "OPENROUTER_API_KEY": "test-openrouter-key",
            "DATABASE_URL": "postgresql://test:test@localhost:5432/test",
            "NEO4J_URI": "bolt://localhost:7687",
            "NEO4J_USERNAME": "neo4j",
            "NEO4J_PASSWORD": "test-password",
            "QDRANT_URI": "http://localhost:6333",
            "REDIS_URL": "redis://localhost:6379",
            "RABBITMQ_URL": "amqp://test:test@localhost:5672",
            "STORAGE_MODE": "database"
        }
        
        for key, value in test_values.items():
            old_values[key] = os.getenv(key)
            os.environ[key] = value
        
        try:
            from argus.config import Config
            
            config = Config.from_env()
            config.validate(skip_database=True)
            
            assert config.openrouter_api_key == "test-openrouter-key"
            assert config.database_url == "postgresql://test:test@localhost:5432/test"
            assert config.storage_mode == "database"
            
            # Check database info
            db_info = config.get_database_info()
            assert db_info["atlas"]["connected"] == True
            assert db_info["ariadne"]["connected"] == True
            assert db_info["mnemosyne"]["connected"] == True
            assert db_info["lethe"]["connected"] == True
            assert db_info["iris"]["connected"] == True
            
        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value

    def test_config_with_local_storage(self):
        """Should work with local storage for development."""
        # Set minimal environment variables for local storage
        old_values = {}
        test_values = {
            "OPENROUTER_API_KEY": "test-openrouter-key",
            "STORAGE_MODE": "local"
        }
        
        for key, value in test_values.items():
            old_values[key] = os.getenv(key)
            os.environ[key] = value
        
        try:
            from argus.config import Config
            
            config = Config.from_env()
            # Should fail validation without database connections
            with pytest.raises(ValueError):
                config.validate(skip_database=True)
            
            # But should have correct basic values
            assert config.openrouter_api_key == "test-openrouter-key"
            assert config.storage_mode == "local"
            
        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value

    def test_config_prefers_openrouter_when_both_available(self):
        """Should prefer OpenRouter when both providers are available."""
        # Set both API keys plus required database connections
        old_values = {}
        test_values = {
            "OPENROUTER_API_KEY": "test-openrouter-key",
            "GEMINI_API_KEY": "test-gemini-key",
            "DATABASE_URL": "postgresql://test:test@localhost:5432/test",
            "NEO4J_URI": "bolt://localhost:7687",
            "NEO4J_USERNAME": "neo4j",
            "NEO4J_PASSWORD": "test-password",
            "QDRANT_URI": "http://localhost:6333",
            "REDIS_URL": "redis://localhost:6379",
            "RABBITMQ_URL": "amqp://test:test@localhost:5672"
        }
        
        for key, value in test_values.items():
            old_values[key] = os.getenv(key)
            os.environ[key] = value
        
        try:
            from argus.config import Config
            
            config = Config.from_env()
            config.validate(skip_database=True)
            
            # Should prefer OpenRouter for migration
            assert config.get_ai_provider() == "openrouter"
            assert config.get_api_key() == "test-openrouter-key"
            
        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value

def test_config_fails_without_any_provider():
        # Set environment to have no API keys
        old_values = {}
        for key in ["OPENROUTER_API_KEY", "GEMINI_API_KEY"]:
            old_values[key] = os.getenv(key)
            if key in os.environ:
                del os.environ[key]

        try:
            from argus.config import Config
            with pytest.raises(ValueError, match="OPENROUTER_API_KEY is required"):
                config = Config.from_env()
                config.validate(skip_database=True)
        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value


class TestOpenRouterModelMapping:
    """Tests for model mapping between providers."""

    def test_openrouter_model_mapping(self):
        """Should provide correct OpenRouter model names."""
        old_values = {}
        test_values = {
            "OPENROUTER_API_KEY": "test-openrouter-key",
            "DATABASE_URL": "postgresql://test:test@localhost:5432/test",
            "NEO4J_URI": "bolt://localhost:7687",
            "NEO4J_USERNAME": "neo4j",
            "NEO4J_PASSWORD": "test-password",
            "QDRANT_URI": "http://localhost:6333",
            "REDIS_URL": "redis://localhost:6379",
            "RABBITMQ_URL": "amqp://test:test@localhost:5672"
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

def test_openrouter_model_mapping():
        """OpenRouter-only system: no more Gemini models."""
        old_values = {}
        test_values = {
            "OPENROUTER_API_KEY": "test-openrouter-key",
            "DATABASE_URL": "postgresql://test:test@localhost:5432/test",
            "NEO4J_URI": "bolt://localhost:7687",
            "NEO4J_USERNAME": "neo4j",
            "NEO4J_PASSWORD": "test-password",
            "QDRANT_URI": "http://localhost:6333",
            "REDIS_URL": "redis://localhost:6379",
            "RABBITMQ_URL": "amqp://test:test@localhost:5672"
        }

        for key, value in test_values.items():
            old_values[key] = os.getenv(key)
            os.environ[key] = value

        try:
            from argus.config import Config

            config = Config.from_env()
            # OpenRouter-only system: no more Gemini models
            # Test that OpenRouter models are used instead
            assert config.get_model_for_provider("enrichment") == "anthropic/claude-3-haiku"
            assert config.get_model_for_provider("synthesis") == "anthropic/claude-3-sonnet"

        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value


class TestConfigEnvironmentVariables:
    """Tests for environment variable loading."""

    def test_openrouter_api_key_loading(self):
        """Should load OpenRouter API key from environment."""
        old_values = {}
        test_values = {
            "OPENROUTER_API_KEY": "env-openrouter-key",
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
            
            assert config.openrouter_api_key == "env-openrouter-key"
            
        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value

    def test_default_model_names(self):
        """Should use default model names when not specified."""
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
            
            # Default enrichment model should be OpenRouter compatible
            enrichment_model = config.get_model_for_provider("enrichment")
            assert "claude" in enrichment_model  # OpenRouter uses Claude models
            
        finally:
            # Restore original environment
            for key, old_value in old_values.items():
                if old_value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = old_value