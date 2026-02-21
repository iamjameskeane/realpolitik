"""
Text cleaning and normalization utilities.
"""

import re


def clean_text(text: str) -> str:
    """
    Clean text output from GPT:
    - Strip whitespace
    - Remove broken Unicode/token artifacts
    - Normalize quotes and dashes
    """
    # Strip whitespace
    text = text.strip()
    # Remove non-ASCII that looks like broken tokens (Chinese chars in English text, etc.)
    # Keep common extended chars (accents, em-dashes, quotes)
    text = re.sub(r'[^\x00-\x7F\u00C0-\u00FF\u2010-\u2015\u2018-\u201F\u2026]+', '', text)
    # Clean up any resulting double spaces
    text = re.sub(r'\s+', ' ', text)
    # Remove trailing incomplete sentences (ending with comma, colon, etc.)
    text = re.sub(r'[,;:\s]+$', '', text)
    return text.strip()
