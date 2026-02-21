"""
OpenRouter AI client wrapper with quota checking.

This client provides an interface compatible with the existing Gemini client
while using OpenRouter as the AI service provider.
"""

import asyncio
import httpx
import json
from typing import Optional


class OpenRouterQuotaExhaustedError(Exception):
    """Raised when OpenRouter API quota is exhausted."""
    pass


class OpenRouterAuthenticationError(Exception):
    """Raised when OpenRouter API key is invalid."""
    pass


class OpenRouterClient:
    """Wrapper for OpenRouter AI client with quota checking."""
    
    def __init__(self, api_key: str, enrichment_model: str, synthesis_model: str):
        self.api_key = api_key
        self.enrichment_model = enrichment_model
        self.synthesis_model = synthesis_model
        self.base_url = "https://openrouter.ai/api/v1"
        self.client = None
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client with proper headers."""
        if self.client is None:
            self.client = httpx.AsyncClient(
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://argus.realpolitik.world",
                    "X-Title": "Argus Intelligence Engine"
                },
                timeout=30.0
            )
        return self.client
    
    async def check_quota(self) -> None:
        """
        Pre-flight check to verify OpenRouter API is available before processing.
        
        Makes a minimal API call to check if:
        1. API key is valid
        2. Account has available quota
        
        Raises:
            OpenRouterQuotaExhaustedError: If quota is exhausted
            OpenRouterAuthenticationError: If API key is invalid
        """
        print("\n🔑 Checking OpenRouter API availability...")
        try:
            client = await self._get_client()
            
            # Minimal request to check quota
            response = await client.post(
                f"{self.base_url}/chat/completions",
                json={
                    "model": self.enrichment_model,
                    "messages": [{"role": "user", "content": "hi"}],
                    "max_tokens": 10
                }
            )
            
            if response.status_code == 200:
                print("   ✓ OpenRouter API is available")
            elif response.status_code == 401:
                print("   ❌ OpenRouter API key invalid!")
                raise OpenRouterAuthenticationError(
                    "OpenRouter API key is invalid. Check your OPENROUTER_API_KEY."
                )
            elif response.status_code == 429:
                print("   ❌ OpenRouter quota exhausted!")
                raise OpenRouterQuotaExhaustedError(
                    "OpenRouter API quota exhausted. Check your OpenRouter billing."
                )
            else:
                raise Exception(f"Unexpected status code: {response.status_code}")
                
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                print("   ❌ OpenRouter API key invalid!")
                raise OpenRouterAuthenticationError(
                    "OpenRouter API key is invalid. Check your OPENROUTER_API_KEY."
                ) from e
            elif e.response.status_code == 429:
                print("   ❌ OpenRouter quota exhausted!")
                raise OpenRouterQuotaExhaustedError(
                    "OpenRouter API quota exhausted. Check your OpenRouter billing."
                ) from e
            raise
        except Exception as e:
            print(f"   ❌ OpenRouter API check failed: {e}")
            raise
    
    async def generate_content(
        self, 
        model: str, 
        content: str, 
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        stream: bool = False
    ) -> str:
        """
        Generate content using OpenRouter API.
        
        Args:
            model: The model to use for generation
            content: The content to generate from
            max_tokens: Maximum tokens to generate
            temperature: Temperature for generation
            stream: Whether to use streaming responses
            
        Returns:
            The generated text content
        """
        client = await self._get_client()
        
        request_data = {
            "model": model,
            "messages": [{"role": "user", "content": content}],
            "stream": stream
        }
        
        if max_tokens is not None:
            request_data["max_tokens"] = max_tokens
            
        if temperature is not None:
            request_data["temperature"] = temperature
        
        try:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                json=request_data
            )
            
            response.raise_for_status()
            
            if stream:
                # Handle streaming responses
                content_parts = []
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        line = line[6:]  # Remove "data: " prefix
                        if line == "[DONE]":
                            break
                        try:
                            chunk = json.loads(line)
                            if "choices" in chunk and len(chunk["choices"]) > 0:
                                delta = chunk["choices"][0].get("delta", {})
                                if "content" in delta:
                                    content_parts.append(delta["content"])
                        except:
                            pass
                return "".join(content_parts)
            else:
                # Handle standard response
                data = response.json()
                if "choices" in data and len(data["choices"]) > 0:
                    message = data["choices"][0].get("message", {})
                    return message.get("content", "")
                else:
                    raise Exception("No content in OpenRouter response")
                    
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                raise OpenRouterAuthenticationError("OpenRouter API key invalid") from e
            elif e.response.status_code == 429:
                raise OpenRouterQuotaExhaustedError("OpenRouter quota exhausted") from e
            else:
                raise Exception(f"OpenRouter API error: {e.response.status_code}") from e
    
    async def close(self):
        """Close the HTTP client."""
        if self.client:
            await self.client.aclose()
    
    async def __aenter__(self):
        await self.check_quota()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()