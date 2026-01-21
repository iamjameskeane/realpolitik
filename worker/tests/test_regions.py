"""
Tests for regions.py - Region extraction from location names.
"""

import pytest
import sys
from pathlib import Path

# Add worker directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from regions import get_region, REGION_COUNTRIES


class TestGetRegion:
    """Tests for the get_region function."""

    def test_european_countries(self):
        """Should correctly identify European locations."""
        assert get_region("Berlin, Germany") == "EUROPE"
        assert get_region("Paris, France") == "EUROPE"
        assert get_region("London, UK") == "EUROPE"
        assert get_region("London, United Kingdom") == "EUROPE"
        assert get_region("Rome, Italy") == "EUROPE"

    def test_middle_east_countries(self):
        """Should correctly identify Middle East locations."""
        assert get_region("Tel Aviv, Israel") == "MIDDLE_EAST"
        assert get_region("Tehran, Iran") == "MIDDLE_EAST"
        assert get_region("Riyadh, Saudi Arabia") == "MIDDLE_EAST"
        assert get_region("Gaza City, Palestine") == "MIDDLE_EAST"
        assert get_region("Gaza Strip") == "MIDDLE_EAST"

    def test_asia_pacific_countries(self):
        """Should correctly identify Asia-Pacific locations."""
        assert get_region("Beijing, China") == "ASIA_PACIFIC"
        assert get_region("Tokyo, Japan") == "ASIA_PACIFIC"
        assert get_region("Seoul, South Korea") == "ASIA_PACIFIC"
        assert get_region("New Delhi, India") == "ASIA_PACIFIC"
        assert get_region("Sydney, Australia") == "ASIA_PACIFIC"

    def test_americas_countries(self):
        """Should correctly identify Americas locations."""
        assert get_region("Washington D.C., USA") == "AMERICAS"
        assert get_region("New York, United States") == "AMERICAS"
        assert get_region("Ottawa, Canada") == "AMERICAS"
        assert get_region("Mexico City, Mexico") == "AMERICAS"
        assert get_region("São Paulo, Brazil") == "AMERICAS"

    def test_africa_countries(self):
        """Should correctly identify African locations."""
        assert get_region("Cairo, Egypt") == "AFRICA"
        assert get_region("Lagos, Nigeria") == "AFRICA"
        assert get_region("Johannesburg, South Africa") == "AFRICA"
        assert get_region("Nairobi, Kenya") == "AFRICA"

    def test_unknown_locations(self):
        """Should return UNKNOWN for unrecognized locations."""
        assert get_region("Unknown Place") == "UNKNOWN"
        assert get_region("") == "UNKNOWN"
        assert get_region("International Waters") == "UNKNOWN"

    def test_case_insensitivity(self):
        """Should handle different cases."""
        assert get_region("BERLIN, GERMANY") == "EUROPE"
        assert get_region("berlin, germany") == "EUROPE"
        assert get_region("BeRlIn, GeRmAnY") == "EUROPE"

    def test_partial_matches(self):
        """Should match country names anywhere in the location string."""
        assert get_region("Some City in Germany") == "EUROPE"
        assert get_region("A place near Japan") == "ASIA_PACIFIC"

    def test_special_territories(self):
        """Should handle special territories and regions."""
        assert get_region("Greenland") == "EUROPE"  # Danish territory
        assert get_region("Hong Kong") == "ASIA_PACIFIC"
        assert get_region("Taiwan") == "ASIA_PACIFIC"


class TestRegionCountries:
    """Tests for the REGION_COUNTRIES mapping."""

    def test_all_regions_have_countries(self):
        """Each region should have at least one country."""
        for region, countries in REGION_COUNTRIES.items():
            assert len(countries) > 0, f"Region {region} has no countries"

    def test_no_duplicate_countries(self):
        """No country should appear in multiple regions."""
        all_countries = []
        for countries in REGION_COUNTRIES.values():
            all_countries.extend(countries)
        
        duplicates = [c for c in all_countries if all_countries.count(c) > 1]
        assert len(duplicates) == 0, f"Duplicate countries: {set(duplicates)}"
