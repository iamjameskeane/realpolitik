"""
OpenRouter AI client for Argus.

This client provides a simple interface for OpenRouter API calls
used in the Argus intelligence engine.
"""

import asyncio
from typing import Optional
from ..config import Config
from .openrouter_client import OpenRouterClient, OpenRouterQuotaExhaustedError, OpenRouterAuthenticationError


class QuotaExhaustedError(Exception):
    """Raised when OpenRouter API quota is exhausted."""
    pass


class AuthenticationError(Exception):
    """Raised when OpenRouter API key is invalid."""
    pass


class AIClient:
    """OpenRouter AI client for Argus."""
    
    def __init__(self, config: Config):
        self.config = config
        self.client = None
        self.provider = None
    
    async def _initialize_client(self):
        """Initialize the OpenRouter client."""
        if self.client is not None:
            return
        
        api_key = self.config.get_api_key()
        enrichment_model = self.config.get_model_for_provider("enrichment")
        synthesis_model = self.config.get_model_for_provider("synthesis")
        
        self.client = OpenRouterClient(
            api_key=api_key,
            enrichment_model=enrichment_model,
            synthesis_model=synthesis_model
        )
        self.provider = "openrouter"
    
    async def check_quota(self) -> None:
        """
        Pre-flight check to verify OpenRouter API is available before processing.
        
        Raises:
            QuotaExhaustedError: If quota is exhausted
            AuthenticationError: If API key is invalid
        """
        await self._initialize_client()
        
        print("\n🔑 Checking OpenRouter API availability...")
        
        try:
            await self.client.check_quota()
            print("   ✓ OpenRouter API is available")
        except OpenRouterQuotaExhaustedError:
            raise QuotaExhaustedError("OpenRouter API quota exhausted")
        except OpenRouterAuthenticationError:
            raise AuthenticationError("OpenRouter API key invalid")
    
    async def generate_content(
        self, 
        model: Optional[str] = None,
        content: str = "",
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        stream: bool = False
    ) -> str:
        """
        Generate content using OpenRouter.
        
        Args:
            model: The model to use for generation (uses default if not specified)
            content: The content to generate from
            max_tokens: Maximum tokens to generate
            temperature: Temperature for generation
            stream: Whether to use streaming responses
            
        Returns:
            The generated text content
        """
        await self._initialize_client()
        
        # Use default model if not specified
        if model is None:
            model = self.client.enrichment_model
        
        return await self.client.generate_content(
            model=model,
            content=content,
            max_tokens=max_tokens,
            temperature=temperature,
            stream=stream
        )
    
    async def generate_enrichment_content(self, content: str, **kwargs) -> str:
        """
        Generate enrichment content using the enrichment model.
        
        This is a convenience method that uses the enrichment model specifically.
        """
        model = self.config.get_model_for_provider("enrichment")
        return await self.generate_content(
            model=model,
            content=content,
            **kwargs
        )
    
    async def generate_synthesis_content(self, content: str, **kwargs) -> str:
        """
        Generate synthesis content using the synthesis model.
        
        This is a convenience method that uses the synthesis model specifically.
        """
        model = self.config.get_model_for_provider("synthesis")
        return await self.generate_content(
            model=model,
            content=content,
            **kwargs
        )
    
    async def close(self):
        """Close the client and clean up resources."""
        if self.client and hasattr(self.client, 'close'):
            await self.client.close()
    
    async def __aenter__(self):
        await self.check_quota()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
    
    @property
    def provider_name(self) -> str:
        """Get the current AI provider name."""
        if self.provider is None:
            return "unknown"
        return self.provider
    
    def get_model_info(self) -> dict:
        """Get information about the configured models."""
        return {
            "provider": None if self.client is None else self.provider,
            "enrichment_model": self.config.get_model_for_provider("enrichment"),
            "synthesis_model": self.config.get_model_for_provider("synthesis")
        }