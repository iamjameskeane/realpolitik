"""
Region extraction and mapping for geopolitical events.

This module provides functionality to extract geographic regions from
location names, enabling rule-based notification filtering by region.
"""

from typing import Literal

# Type alias for valid regions
RegionName = Literal[
    "MIDDLE_EAST",
    "EAST_ASIA",
    "SOUTHEAST_ASIA",
    "SOUTH_ASIA",
    "EUROPE",
    "AFRICA",
    "AMERICAS",
    "CENTRAL_ASIA",
    "OCEANIA",
    "OTHER",
]

# =============================================================================
# REGION DEFINITIONS
# =============================================================================

REGIONS: dict[str, list[str]] = {
    "MIDDLE_EAST": [
        "Israel",
        "Palestine",
        "Palestinian",
        "Gaza",
        "West Bank",
        "Lebanon",
        "Syria",
        "Syrian",
        "Iran",
        "Iranian",
        "Iraq",
        "Iraqi",
        "Yemen",
        "Yemeni",
        "Saudi Arabia",
        "Saudi",
        "UAE",
        "United Arab Emirates",
        "Emirati",
        "Qatar",
        "Qatari",
        "Jordan",
        "Jordanian",
        "Kuwait",
        "Kuwaiti",
        "Bahrain",
        "Bahraini",
        "Oman",
        "Omani",
        "Tel Aviv",
        "Jerusalem",
        "Beirut",
        "Damascus",
        "Tehran",
        "Baghdad",
        "Riyadh",
        "Sanaa",
        "Houthi",
        "Hezbollah",
        "Hamas",
    ],
    "EAST_ASIA": [
        "China",
        "Chinese",
        "Taiwan",
        "Taiwanese",
        "Japan",
        "Japanese",
        "South Korea",
        "Korean",
        "North Korea",
        "DPRK",
        "Hong Kong",
        "Mongolia",
        "Mongolian",
        "Beijing",
        "Shanghai",
        "Taipei",
        "Tokyo",
        "Seoul",
        "Pyongyang",
        "Xinjiang",
        "Uyghur",
        "Tibet",
        "Tibetan",
        "South China Sea",
        "East China Sea",
        "Yellow Sea",
    ],
    "SOUTHEAST_ASIA": [
        "Vietnam",
        "Vietnamese",
        "Philippines",
        "Filipino",
        "Philippine",
        "Indonesia",
        "Indonesian",
        "Malaysia",
        "Malaysian",
        "Thailand",
        "Thai",
        "Myanmar",
        "Burmese",
        "Burma",
        "Singapore",
        "Singaporean",
        "Cambodia",
        "Cambodian",
        "Laos",
        "Lao",
        "Laotian",
        "Brunei",
        "Timor-Leste",
        "East Timor",
        "Hanoi",
        "Manila",
        "Jakarta",
        "Kuala Lumpur",
        "Bangkok",
        "Naypyidaw",
        "Rohingya",
    ],
    "SOUTH_ASIA": [
        "India",
        "Indian",
        "Pakistan",
        "Pakistani",
        "Bangladesh",
        "Bangladeshi",
        "Sri Lanka",
        "Sri Lankan",
        "Nepal",
        "Nepali",
        "Nepalese",
        "Afghanistan",
        "Afghan",
        "Bhutan",
        "Bhutanese",
        "Maldives",
        "Maldivian",
        "New Delhi",
        "Delhi",
        "Mumbai",
        "Islamabad",
        "Karachi",
        "Lahore",
        "Dhaka",
        "Kabul",
        "Kathmandu",
        "Colombo",
        "Kashmir",
        "Kashmiri",
        "Taliban",
    ],
    "EUROPE": [
        "Ukraine",
        "Ukrainian",
        "Russia",
        "Russian",
        "Poland",
        "Polish",
        "Germany",
        "German",
        "France",
        "French",
        "UK",
        "United Kingdom",
        "British",
        "Britain",
        "England",
        "English",
        "Scotland",
        "Scottish",
        "Wales",
        "Welsh",
        "Northern Ireland",
        "Belarus",
        "Belarusian",
        "Moldova",
        "Moldovan",
        "Romania",
        "Romanian",
        "Hungary",
        "Hungarian",
        "Serbia",
        "Serbian",
        "Kosovo",
        "Kosovan",
        "Bosnia",
        "Bosnian",
        "Herzegovina",
        "Croatia",
        "Croatian",
        "Slovenia",
        "Slovenian",
        "Montenegro",
        "Montenegrin",
        "Albania",
        "Albanian",
        "North Macedonia",
        "Macedonian",
        "Greece",
        "Greek",
        "Bulgaria",
        "Bulgarian",
        "Italy",
        "Italian",
        "Spain",
        "Spanish",
        "Portugal",
        "Portuguese",
        "Netherlands",
        "Dutch",
        "Belgium",
        "Belgian",
        "Austria",
        "Austrian",
        "Switzerland",
        "Swiss",
        "Czech Republic",
        "Czechia",
        "Czech",
        "Slovakia",
        "Slovak",
        "Denmark",
        "Danish",
        "Norway",
        "Norwegian",
        "Sweden",
        "Swedish",
        "Finland",
        "Finnish",
        "Estonia",
        "Estonian",
        "Latvia",
        "Latvian",
        "Lithuania",
        "Lithuanian",
        "Ireland",
        "Irish",
        "Iceland",
        "Icelandic",
        "Kyiv",
        "Kiev",
        "Moscow",
        "Minsk",
        "Warsaw",
        "Berlin",
        "Paris",
        "London",
        "Rome",
        "Madrid",
        "Brussels",
        "Vienna",
        "Amsterdam",
        "Prague",
        "Budapest",
        "Bucharest",
        "Athens",
        "Sofia",
        "Donbas",
        "Donetsk",
        "Luhansk",
        "Crimea",
        "Kharkiv",
        "Zaporizhzhia",
        "Odesa",
        "Odessa",
        "Kherson",
        "Mariupol",
        "NATO",
        "European Union",
        "EU",
        "Wagner",
        "Kremlin",
    ],
    "AFRICA": [
        "Sudan",
        "Sudanese",
        "South Sudan",
        "Ethiopia",
        "Ethiopian",
        "Libya",
        "Libyan",
        "Egypt",
        "Egyptian",
        "Nigeria",
        "Nigerian",
        "South Africa",
        "South African",
        "DRC",
        "Democratic Republic of Congo",
        "Congolese",
        "Congo",
        "Somalia",
        "Somali",
        "Mali",
        "Malian",
        "Niger",
        "Nigerien",
        "Burkina Faso",
        "Burkinabe",
        "Chad",
        "Chadian",
        "Central African Republic",
        "CAR",
        "Cameroon",
        "Cameroonian",
        "Kenya",
        "Kenyan",
        "Uganda",
        "Ugandan",
        "Rwanda",
        "Rwandan",
        "Tanzania",
        "Tanzanian",
        "Mozambique",
        "Mozambican",
        "Zimbabwe",
        "Zimbabwean",
        "Algeria",
        "Algerian",
        "Morocco",
        "Moroccan",
        "Tunisia",
        "Tunisian",
        "Eritrea",
        "Eritrean",
        "Senegal",
        "Senegalese",
        "Ghana",
        "Ghanaian",
        "Ivory Coast",
        "Côte d'Ivoire",
        "Ivorian",
        "Angola",
        "Angolan",
        "Khartoum",
        "Cairo",
        "Addis Ababa",
        "Tripoli",
        "Lagos",
        "Abuja",
        "Nairobi",
        "Johannesburg",
        "Pretoria",
        "Cape Town",
        "Kinshasa",
        "Mogadishu",
        "Tigray",
        "Amhara",
        "Sahel",
        "Al-Shabaab",
        "Boko Haram",
        "RSF",
        "Rapid Support Forces",
        "SAF",
        "Sudanese Armed Forces",
    ],
    "AMERICAS": [
        "USA",
        "US",
        "United States",
        "American",
        "America",
        "Mexico",
        "Mexican",
        "Venezuela",
        "Venezuelan",
        "Brazil",
        "Brazilian",
        "Argentina",
        "Argentine",
        "Argentinian",
        "Colombia",
        "Colombian",
        "Cuba",
        "Cuban",
        "Canada",
        "Canadian",
        "Peru",
        "Peruvian",
        "Chile",
        "Chilean",
        "Ecuador",
        "Ecuadorian",
        "Bolivia",
        "Bolivian",
        "Paraguay",
        "Paraguayan",
        "Uruguay",
        "Uruguayan",
        "Haiti",
        "Haitian",
        "Dominican Republic",
        "Dominican",
        "Guatemala",
        "Guatemalan",
        "Honduras",
        "Honduran",
        "El Salvador",
        "Salvadoran",
        "Nicaragua",
        "Nicaraguan",
        "Panama",
        "Panamanian",
        "Puerto Rico",
        "Puerto Rican",
        "Washington",
        "Washington DC",
        "New York",
        "Los Angeles",
        "Chicago",
        "Houston",
        "Miami",
        "Mexico City",
        "Bogotá",
        "Lima",
        "São Paulo",
        "Rio de Janeiro",
        "Buenos Aires",
        "Caracas",
        "Havana",
        "Ottawa",
        "Toronto",
        "Pentagon",
        "White House",
        "Capitol Hill",
        "State Department",
    ],
    "CENTRAL_ASIA": [
        "Kazakhstan",
        "Kazakh",
        "Uzbekistan",
        "Uzbek",
        "Turkmenistan",
        "Turkmen",
        "Tajikistan",
        "Tajik",
        "Kyrgyzstan",
        "Kyrgyz",
        "Azerbaijan",
        "Azerbaijani",
        "Azeri",
        "Armenia",
        "Armenian",
        "Georgia",
        "Georgian",
        "Astana",
        "Nur-Sultan",
        "Tashkent",
        "Ashgabat",
        "Dushanbe",
        "Bishkek",
        "Baku",
        "Yerevan",
        "Tbilisi",
        "Nagorno-Karabakh",
        "Artsakh",
    ],
    "OCEANIA": [
        "Australia",
        "Australian",
        "New Zealand",
        "Papua New Guinea",
        "Fiji",
        "Fijian",
        "Solomon Islands",
        "Vanuatu",
        "Samoa",
        "Tonga",
        "Canberra",
        "Sydney",
        "Melbourne",
        "Brisbane",
        "Wellington",
        "Auckland",
        "Port Moresby",
        "Pacific Islands",
    ],
}

# Build a reverse lookup dictionary for faster matching
# Maps lowercase keywords to their region
_KEYWORD_TO_REGION: dict[str, str] = {}
for region, keywords in REGIONS.items():
    for keyword in keywords:
        _KEYWORD_TO_REGION[keyword.lower()] = region


def get_region(location_name: str) -> RegionName:
    """
    Extract the geographic region from a location name.
    
    Checks the location string for known country/city/region keywords
    and returns the corresponding region code.
    
    Args:
        location_name: Human-readable location (e.g., "Kyiv, Ukraine")
        
    Returns:
        Region code (e.g., "EUROPE") or "OTHER" if not recognized
    """
    if not location_name:
        return "OTHER"
    
    location_lower = location_name.lower()
    
    # Check each keyword (longer keywords checked implicitly first due to contains)
    # Sort by length descending to match more specific terms first
    # (e.g., "South Korea" before "Korea")
    for keyword in sorted(_KEYWORD_TO_REGION.keys(), key=len, reverse=True):
        if keyword in location_lower:
            return _KEYWORD_TO_REGION[keyword]  # type: ignore
    
    return "OTHER"


def get_region_from_coordinates(lat: float, lng: float) -> RegionName:
    """
    Fallback region detection based on coordinates.
    
    Uses rough bounding boxes to estimate region when keyword
    matching fails. This is less precise but provides a fallback.
    
    Args:
        lat: Latitude
        lng: Longitude
        
    Returns:
        Region code or "OTHER"
    """
    # Rough bounding boxes for regions (lat_min, lat_max, lng_min, lng_max)
    REGION_BOUNDS: dict[str, tuple[float, float, float, float]] = {
        "MIDDLE_EAST": (12, 42, 25, 65),
        "EAST_ASIA": (15, 55, 100, 150),
        "SOUTHEAST_ASIA": (-10, 30, 90, 140),
        "SOUTH_ASIA": (5, 40, 60, 100),
        "EUROPE": (35, 72, -25, 60),
        "AFRICA": (-35, 37, -20, 55),
        "AMERICAS": (-55, 72, -170, -30),
        "CENTRAL_ASIA": (35, 55, 45, 90),
        "OCEANIA": (-50, 0, 110, 180),
    }
    
    for region, (lat_min, lat_max, lng_min, lng_max) in REGION_BOUNDS.items():
        if lat_min <= lat <= lat_max and lng_min <= lng <= lng_max:
            return region  # type: ignore
    
    return "OTHER"


def enrich_event_with_region(event: dict) -> dict:
    """
    Add region field to an event based on its location.
    
    Attempts keyword matching first, then falls back to coordinates.
    
    Args:
        event: Event dictionary with location_name and optionally coordinates
        
    Returns:
        Event dictionary with 'region' field added
    """
    # Try keyword-based extraction first
    location_name = event.get("location_name", "")
    region = get_region(location_name)
    
    # If still OTHER, try coordinates
    if region == "OTHER":
        coords = event.get("coordinates")
        if coords and len(coords) == 2:
            lng, lat = coords  # GeoJSON format: [lng, lat]
            region = get_region_from_coordinates(lat, lng)
    
    event["region"] = region
    return event


# =============================================================================
# TESTING
# =============================================================================

if __name__ == "__main__":
    # Test cases
    test_locations = [
        "Kyiv, Ukraine",
        "Tel Aviv, Israel",
        "Beijing, China",
        "Taipei, Taiwan",
        "Moscow, Russia",
        "Gaza Strip",
        "South China Sea",
        "Washington DC, United States",
        "Kabul, Afghanistan",
        "Addis Ababa, Ethiopia",
        "Unknown Location",
        "",
        "NATO headquarters",
        "The Kremlin",
        "Donbas region",
    ]
    
    print("Region Extraction Test")
    print("=" * 50)
    for loc in test_locations:
        region = get_region(loc)
        print(f"{loc:40} -> {region}")
