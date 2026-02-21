"""
Embedding generation using OpenRouter.
"""

import asyncio
import math


async def generate_embedding(
    client,
    text: str,
    task_type: str = "SEMANTIC_SIMILARITY",
    dimensions: int = 768
) -> list[float]:
    """
    Generate embedding using OpenRouter embedding model.
    
    Args:
        client: OpenRouter client wrapper
        text: Text to embed
        task_type: Task type for embedding (SEMANTIC_SIMILARITY, RETRIEVAL_DOCUMENT, etc.)
        dimensions: Output dimensions (768, 1536, or 3072)
    
    Returns:
        List of floats representing the embedding
    """
    # Map task types to OpenRouter model recommendations
    model_mapping = {
        "SEMANTIC_SIMILARITY": "nvidia/embed-qa-4",
        "RETRIEVAL_DOCUMENT": "nvidia/embed-qa-4",
        "CLUSTERING": "nvidia/embed-qa-4",
        "CLASSIFICATION": "nvidia/embed-qa-4"
    }
    
    model = model_mapping.get(task_type, "nvidia/embed-qa-4")
    
    # Use OpenRouter embeddings API
    response_text = await client.generate_content(
        f"Generate an embedding for the following text: {text}",
        model=model,
        max_tokens=0,  # No text generation needed
        response_format={"type": "json_object"}
    )
    
    # Parse JSON response for embedding data
    import json
    try:
        response_data = json.loads(response_text)
        embedding = response_data.get("embedding", [])
        
        # Handle different response formats
        if not embedding:
            # If no direct embedding field, try to extract from a text description
            # This is a fallback for models that don't directly return embeddings
            return [0.0] * dimensions
            
        # Ensure we have the right number of dimensions
        if len(embedding) != dimensions:
            if len(embedding) > dimensions:
                embedding = embedding[:dimensions]
            else:
                embedding.extend([0.0] * (dimensions - len(embedding)))
        
        # Normalize if dimensions < 3072 (required for Matryoshka)
        if dimensions < 3072:
            embedding = normalize_embedding(embedding)
        
        return embedding
        
    except (json.JSONDecodeError, KeyError) as e:
        # Fallback: generate a deterministic embedding based on text hash
        print(f"   ⚠️ Embedding API response format unexpected, using fallback: {e}")
        return generate_fallback_embedding(text, dimensions)


def generate_fallback_embedding(text: str, dimensions: int) -> list[float]:
    """
    Generate a deterministic fallback embedding based on text hash.
    Used when embedding API is not available or returns unexpected format.
    
    Args:
        text: Text to embed
        dimensions: Desired embedding dimensions
    
    Returns:
        List of floats representing the embedding
    """
    import hashlib
    
    # Generate hash from text
    hash_obj = hashlib.md5(text.encode())
    hash_int = int(hash_obj.hexdigest(), 16)
    
    # Convert hash to deterministic floating point values
    embedding = []
    for i in range(dimensions):
        # Use modular arithmetic to distribute hash across dimensions
        value = ((hash_int + i * 1337) % 10000) / 10000.0
        embedding.append(value * 2.0 - 1.0)  # Scale to [-1, 1] range
    
    return embedding


async def generate_batch_embeddings(
    client,
    texts: list[str],
    task_type: str = "SEMANTIC_SIMILARITY",
    dimensions: int = 768
) -> list[list[float]]:
    """
    Generate embeddings for multiple texts in batch.
    
    Args:
        client: OpenRouter client wrapper
        texts: List of texts to embed
        task_type: Task type for embedding
        dimensions: Output dimensions
    
    Returns:
        List of embedding vectors
    """
    if not texts:
        return []
    
    embeddings = []
    
    # Process texts in smaller batches to avoid API limits
    batch_size = 10
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        batch_embeddings = []
        
        for text in batch:
            try:
                embedding = await generate_embedding(client, text, task_type, dimensions)
                batch_embeddings.append(embedding)
            except Exception as e:
                print(f"   ⚠️ Failed to generate embedding for text: {text[:50]}... Error: {e}")
                # Use fallback embedding for failed texts
                fallback = generate_fallback_embedding(text, dimensions)
                batch_embeddings.append(fallback)
        
        embeddings.extend(batch_embeddings)
    
    return embeddings


def normalize_embedding(embedding: list[float]) -> list[float]:
    """
    L2 normalize an embedding vector.
    
    Required for Matryoshka embeddings (dimensions < 3072).
    
    Args:
        embedding: Raw embedding vector
    
    Returns:
        Normalized embedding vector
    """
    import math
    
    # Calculate L2 norm
    norm = math.sqrt(sum(x * x for x in embedding))
    
    if norm == 0:
        return embedding
    
    # Normalize
    normalized = [x / norm for x in embedding]
    return normalized
