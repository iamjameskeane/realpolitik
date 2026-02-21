"""
OpenRouter AI client for Cassandra microservice.
"""

import asyncio
import json
import time
from typing import Optional, Dict, Any
from openai import AsyncOpenAI
from pydantic import ValidationError


class AIClient:
    """OpenRouter client wrapper with error handling and rate limiting."""
    
    def __init__(self, api_key: str, model_enrichment: str, model_synthesis: str):
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1"
        )
        self.model_enrichment = model_enrichment
        self.model_synthesis = model_synthesis
        self.request_count = 0
        self.last_request_time = 0
        
    async def check_quota(self) -> bool:
        """Pre-flight check for API availability."""
        try:
            response = await self.client.models.list()
            return len(response.data) > 0
        except Exception as e:
            raise QuotaExhaustedError(f"API quota check failed: {e}")
    
    async def generate_content(
        self,
        prompt: str,
        model: str,
        response_format: Optional[Dict[str, Any]] = None,
        max_retries: int = 3
    ) -> Optional[str]:
        """
        Generate content with retry logic and rate limiting.
        
        Args:
            prompt: The prompt to send
            model: Model name to use
            response_format: Optional JSON response format
            max_retries: Maximum retry attempts
            
        Returns:
            Generated content or None on failure
        """
        
        for attempt in range(max_retries):
            try:
                # Rate limiting (5 requests per second)
                current_time = time.time()
                time_since_last = current_time - self.last_request_time
                if time_since_last < 0.2:  # 200ms between requests
                    await asyncio.sleep(0.2 - time_since_last)
                
                # Prepare request parameters
                request_params = {
                    "model": model,
                    "messages": [
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "max_tokens": 4000,
                    "temperature": 0.3
                }
                
                if response_format:
                    request_params["response_format"] = response_format
                
                # Make request
                response = await self.client.chat.completions.create(**request_params)
                
                self.request_count += 1
                self.last_request_time = time.time()
                
                if response.choices and len(response.choices) > 0:
                    content = response.choices[0].message.content
                    return content
                else:
                    print(f"   ⚠️ Empty response from model {model}")
                    return None
                    
            except Exception as e:
                print(f"   ⚠️ Attempt {attempt + 1} failed: {type(e).__name__}: {e}")
                if attempt == max_retries - 1:
                    raise
                await asyncio.sleep(2 ** attempt)  # Exponential backoff
        
        return None
    
    async def generate_with_tools(
        self,
        prompt: str,
        tools: list,
        model: str,
        max_tool_calls: int = 3
    ) -> Dict[str, Any]:
        """
        Generate content with function calling support.
        
        Args:
            prompt: The prompt to send
            tools: List of tool definitions for function calling
            model: Model name to use
            max_tool_calls: Maximum number of tool calls
            
        Returns:
            Dict with content and tool calls information
        """
        
        try:
            # Rate limiting
            current_time = time.time()
            time_since_last = current_time - self.last_request_time
            if time_since_last < 0.2:
                await asyncio.sleep(0.2 - time_since_last)
            
            request_params = {
                "model": model,
                "messages": [
                    {
                        "role": "user", 
                        "content": prompt
                    }
                ],
                "tools": tools,
                "max_tokens": 4000,
                "temperature": 0.3
            }
            
            response = await self.client.chat.completions.create(**request_params)
            
            self.request_count += 1
            self.last_request_time = time.time()
            
            if response.choices and len(response.choices) > 0:
                choice = response.choices[0]
                
                result = {
                    "content": choice.message.content,
                    "tool_calls": []
                }
                
                if choice.message.tool_calls:
                    result["tool_calls"] = [
                        {
                            "name": call.function.name,
                            "arguments": call.function.arguments
                        }
                        for call in choice.message.tool_calls
                    ]
                
                return result
            else:
                return {"content": None, "tool_calls": []}
                
        except Exception as e:
            print(f"   ⚠️ Tool generation failed: {type(e).__name__}: {e}")
            return {"content": None, "tool_calls": []}
    
    def get_model_info(self) -> Dict[str, str]:
        """Get information about configured models."""
        return {
            "provider": "openrouter",
            "enrichment_model": self.model_enrichment,
            "synthesis_model": self.model_synthesis
        }


class QuotaExhaustedError(Exception):
    """Raised when API quota is exhausted."""
    pass