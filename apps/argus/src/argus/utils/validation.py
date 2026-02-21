"""
Validation utilities for clamping values to valid ranges.
"""


def clamp_latitude(v: float) -> float:
    """Clamp latitude to valid range [-90, 90]."""
    return max(-90.0, min(90.0, float(v)))


def clamp_longitude(v: float) -> float:
    """Clamp longitude to valid range [-180, 180]."""
    return max(-180.0, min(180.0, float(v)))


def clamp_severity(v: int) -> int:
    """Clamp severity to valid range [1, 10]."""
    return max(1, min(10, int(v)))
