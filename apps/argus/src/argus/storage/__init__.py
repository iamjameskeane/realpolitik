"""
Storage backends for event output.
"""

from .database import write_database, update_event_fallout
from .local import write_local

__all__ = [
    "write_database",
    "update_event_fallout",
    "write_local",
]
