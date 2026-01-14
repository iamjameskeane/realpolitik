"""
Location Reference Dictionary for Geopolitical Event Geocoding
===============================================================

This module provides a comprehensive dictionary of geopolitical locations
with canonical coordinates. It's designed to be included in LLM prompts
to help smaller models accurately geocode events.

The LLM should:
1. Match article locations to dictionary entries when possible
2. Use nearby known locations as reference points for interpolation
3. Only estimate coordinates when no good reference exists

Coordinates are [longitude, latitude] to match GeoJSON convention.
"""

# Format: "Location Name": (longitude, latitude)
# Organized by region for easier maintenance

LOCATIONS: dict[str, tuple[float, float]] = {
    # =========================================================================
    # MIDDLE EAST - High activity region
    # =========================================================================
    
    # Israel & Palestine
    "Gaza City, Palestine": (34.45, 31.50),
    "Gaza, Palestine": (34.45, 31.50),
    "Gaza Strip": (34.45, 31.50),
    "Rafah, Palestine": (34.25, 31.28),
    "Rafah Border Crossing": (34.25, 31.28),
    "Khan Younis, Palestine": (34.30, 31.35),
    "Jabalia, Palestine": (34.48, 31.53),
    "Tel Aviv, Israel": (34.78, 32.08),
    "Jerusalem, Israel": (35.21, 31.77),
    "East Jerusalem, Palestine": (35.23, 31.78),
    "West Bank, Palestine": (35.25, 31.95),
    "Ramallah, Palestine": (35.20, 31.90),
    "Haifa, Israel": (34.99, 32.82),
    "Golan Heights": (35.75, 33.00),
    
    # Iran
    "Tehran, Iran": (51.39, 35.69),
    "Iran": (53.69, 32.43),  # Country centroid
    "Isfahan, Iran": (51.67, 32.65),
    "Shiraz, Iran": (52.53, 29.59),
    "Tabriz, Iran": (46.29, 38.08),
    "Mashhad, Iran": (59.57, 36.30),
    "Natanz, Iran": (51.72, 33.51),  # Nuclear facility
    "Fordow, Iran": (51.58, 34.88),  # Nuclear facility
    "Bushehr, Iran": (50.84, 28.97),  # Nuclear plant
    "Bandar Abbas, Iran": (56.27, 27.18),
    "Qom, Iran": (50.88, 34.64),
    
    # Gulf States
    "Riyadh, Saudi Arabia": (46.72, 24.71),
    "Jeddah, Saudi Arabia": (39.17, 21.54),
    "Mecca, Saudi Arabia": (39.83, 21.42),
    "Dubai, UAE": (55.27, 25.20),
    "Abu Dhabi, UAE": (54.37, 24.45),
    "Doha, Qatar": (51.53, 25.29),
    "Al Udeid Air Base, Qatar": (51.17, 25.12),
    "Manama, Bahrain": (50.58, 26.23),
    "Kuwait City, Kuwait": (47.98, 29.38),
    "Muscat, Oman": (58.41, 23.59),
    
    # Iraq
    "Baghdad, Iraq": (44.37, 33.31),
    "Erbil, Iraq": (44.01, 36.19),
    "Mosul, Iraq": (43.13, 36.34),
    "Basra, Iraq": (47.78, 30.51),
    "Kirkuk, Iraq": (44.39, 35.47),
    
    # Syria
    "Damascus, Syria": (36.29, 33.51),
    "Aleppo, Syria": (37.16, 36.20),
    "Idlib, Syria": (36.63, 35.93),
    "Homs, Syria": (36.72, 34.73),
    "Latakia, Syria": (35.78, 35.52),
    "Deir ez-Zor, Syria": (40.14, 35.34),
    "Syria": (38.50, 35.00),  # Country centroid
    
    # Lebanon
    "Beirut, Lebanon": (35.50, 33.89),
    "Lebanon": (35.86, 33.87),
    "Hezbollah-controlled Lebanon": (35.50, 33.50),
    
    # Yemen
    "Sanaa, Yemen": (44.21, 15.35),
    "Aden, Yemen": (45.04, 12.78),
    "Hodeidah, Yemen": (42.95, 14.80),
    "Yemen": (48.52, 15.55),
    
    # Jordan
    "Amman, Jordan": (35.93, 31.95),
    
    # Turkey
    "Ankara, Turkey": (32.86, 39.93),
    "Istanbul, Turkey": (28.98, 41.01),
    "Incirlik Air Base, Turkey": (35.43, 37.00),
    
    # Regional
    "Middle East": (45.00, 29.00),
    "Persian Gulf": (51.00, 26.50),
    "Red Sea": (38.50, 20.00),
    "Strait of Hormuz": (56.50, 26.50),
    "Gulf of Aden": (48.00, 12.50),
    
    # =========================================================================
    # EUROPE
    # =========================================================================
    
    # Ukraine & Russia conflict
    "Kyiv, Ukraine": (30.52, 50.45),
    "Kharkiv, Ukraine": (36.23, 49.99),
    "Odesa, Ukraine": (30.73, 46.48),
    "Mariupol, Ukraine": (37.54, 47.10),
    "Donetsk, Ukraine": (37.80, 48.00),
    "Luhansk, Ukraine": (39.31, 48.57),
    "Zaporizhzhia, Ukraine": (35.14, 47.84),
    "Kherson, Ukraine": (32.62, 46.64),
    "Dnipro, Ukraine": (35.04, 48.46),
    "Lviv, Ukraine": (24.03, 49.84),
    "Crimea, Ukraine": (34.10, 44.95),
    "Sevastopol, Crimea": (33.52, 44.62),
    "Ukraine": (30.52, 50.45),  # Use Kyiv as default
    
    # Russia
    "Moscow, Russia": (37.62, 55.75),
    "St. Petersburg, Russia": (30.31, 59.94),
    "Vladivostok, Russia": (131.89, 43.12),
    "Kaliningrad, Russia": (20.51, 54.71),
    "Rostov-on-Don, Russia": (39.70, 47.24),
    "Russia": (37.62, 55.75),  # Use Moscow as default
    
    # Western Europe
    "London, UK": (-0.13, 51.51),
    "Paris, France": (2.35, 48.85),
    "Berlin, Germany": (13.41, 52.52),
    "Rome, Italy": (12.50, 41.90),
    "Madrid, Spain": (-3.70, 40.42),
    "Brussels, Belgium": (4.35, 50.85),
    "Amsterdam, Netherlands": (4.90, 52.37),
    "The Hague, Netherlands": (4.30, 52.08),  # ICJ location
    "Vienna, Austria": (16.37, 48.21),
    "Geneva, Switzerland": (6.14, 46.20),  # UN European HQ
    "Zurich, Switzerland": (8.54, 47.38),
    "Strasbourg, France": (7.75, 48.58),  # EU Parliament
    
    # Eastern Europe
    "Warsaw, Poland": (21.02, 52.23),
    "Prague, Czech Republic": (14.42, 50.08),
    "Budapest, Hungary": (19.04, 47.50),
    "Bucharest, Romania": (26.10, 44.43),
    "Sofia, Bulgaria": (23.32, 42.70),
    "Belgrade, Serbia": (20.46, 44.82),
    "Zagreb, Croatia": (15.98, 45.81),
    "Sarajevo, Bosnia": (18.41, 43.86),
    "Pristina, Kosovo": (21.17, 42.66),
    "Chisinau, Moldova": (28.83, 47.01),
    "Minsk, Belarus": (27.57, 53.90),
    "Tallinn, Estonia": (24.75, 59.44),
    "Riga, Latvia": (24.11, 56.95),
    "Vilnius, Lithuania": (25.28, 54.69),
    
    # Nordic
    "Helsinki, Finland": (24.94, 60.17),
    "Stockholm, Sweden": (18.07, 59.33),
    "Oslo, Norway": (10.75, 59.91),
    "Copenhagen, Denmark": (12.57, 55.68),
    "Reykjavik, Iceland": (-21.90, 64.15),
    
    # Regional
    "Europe": (10.00, 50.00),
    "European Union": (4.35, 50.85),  # Brussels
    "NATO Headquarters": (4.42, 50.88),  # Brussels
    "Balkans": (20.00, 43.00),
    "Baltic States": (24.00, 56.00),
    "Scandinavia": (15.00, 62.00),
    
    # =========================================================================
    # AMERICAS
    # =========================================================================
    
    # United States
    "Washington D.C., USA": (-77.04, 38.91),
    "Washington, D.C.": (-77.04, 38.91),
    "White House, USA": (-77.04, 38.90),
    "Pentagon, USA": (-77.06, 38.87),
    "New York City, USA": (-74.01, 40.71),
    "United Nations, New York": (-73.97, 40.75),
    "Los Angeles, USA": (-118.24, 34.05),
    "Chicago, USA": (-87.63, 41.88),
    "Houston, USA": (-95.37, 29.76),
    "Miami, USA": (-80.19, 25.76),
    "San Francisco, USA": (-122.42, 37.77),
    "USA": (-77.04, 38.91),  # Use DC as default
    "United States": (-77.04, 38.91),
    
    # Latin America
    "Mexico City, Mexico": (-99.13, 19.43),
    "Caracas, Venezuela": (-66.90, 10.48),
    "Bogota, Colombia": (-74.07, 4.71),
    "Lima, Peru": (-77.03, -12.05),
    "Santiago, Chile": (-70.67, -33.45),
    "Buenos Aires, Argentina": (-58.38, -34.60),
    "Brasilia, Brazil": (-47.88, -15.79),
    "Sao Paulo, Brazil": (-46.63, -23.55),
    "Rio de Janeiro, Brazil": (-43.17, -22.91),
    "Havana, Cuba": (-82.37, 23.11),
    "Managua, Nicaragua": (-86.25, 12.11),
    "Panama City, Panama": (-79.52, 8.98),
    "Guantanamo Bay, Cuba": (-75.13, 19.91),  # US Naval Base
    
    # Caribbean
    "San Juan, Puerto Rico": (-66.11, 18.47),
    "Port-au-Prince, Haiti": (-72.34, 18.54),
    "Santo Domingo, Dominican Republic": (-69.93, 18.47),
    "Kingston, Jamaica": (-76.79, 18.00),
    
    # Canada
    "Ottawa, Canada": (-75.70, 45.42),
    "Toronto, Canada": (-79.38, 43.65),
    "Vancouver, Canada": (-123.12, 49.28),
    "Montreal, Canada": (-73.57, 45.50),
    
    # Arctic
    "Nuuk, Greenland": (-51.74, 64.18),
    "Greenland": (-41.39, 74.72),
    "Arctic": (0.00, 85.00),
    
    # =========================================================================
    # ASIA-PACIFIC
    # =========================================================================
    
    # East Asia
    "Beijing, China": (116.41, 39.90),
    "Shanghai, China": (121.47, 31.23),
    "Hong Kong, China": (114.17, 22.32),
    "Taipei, Taiwan": (121.56, 25.03),
    "Taiwan": (120.96, 23.75),
    "Taiwan Strait": (119.50, 24.50),
    "Tokyo, Japan": (139.69, 35.69),
    "Okinawa, Japan": (127.68, 26.33),
    "Seoul, South Korea": (126.98, 37.57),
    "Pyongyang, North Korea": (125.76, 39.04),
    "North Korea": (127.00, 40.00),
    "Ulaanbaatar, Mongolia": (106.91, 47.92),
    "China": (116.41, 39.90),  # Use Beijing as default
    
    # Southeast Asia
    "Manila, Philippines": (120.98, 14.60),
    "South China Sea": (115.00, 12.00),
    "Spratly Islands": (114.00, 10.00),
    "Scarborough Shoal": (117.77, 15.17),
    "Hanoi, Vietnam": (105.85, 21.03),
    "Ho Chi Minh City, Vietnam": (106.63, 10.82),
    "Bangkok, Thailand": (100.50, 13.76),
    "Singapore": (103.82, 1.35),
    "Kuala Lumpur, Malaysia": (101.69, 3.14),
    "Jakarta, Indonesia": (106.85, -6.21),
    "Naypyidaw, Myanmar": (96.13, 19.75),
    "Yangon, Myanmar": (96.15, 16.87),
    "Phnom Penh, Cambodia": (104.92, 11.56),
    "Vientiane, Laos": (102.63, 17.97),
    
    # South Asia
    "New Delhi, India": (77.21, 28.61),
    "Mumbai, India": (72.88, 19.08),
    "Kashmir": (76.00, 34.00),
    "Islamabad, Pakistan": (73.05, 33.69),
    "Karachi, Pakistan": (67.01, 24.86),
    "Lahore, Pakistan": (74.33, 31.55),
    "Kabul, Afghanistan": (69.17, 34.53),
    "Afghanistan": (67.00, 34.00),
    "Dhaka, Bangladesh": (90.41, 23.81),
    "Colombo, Sri Lanka": (79.86, 6.93),
    "Sri Lanka": (80.77, 7.87),
    "Kathmandu, Nepal": (85.32, 27.72),
    
    # Central Asia
    "Nur-Sultan, Kazakhstan": (71.47, 51.17),
    "Tashkent, Uzbekistan": (69.28, 41.31),
    "Bishkek, Kyrgyzstan": (74.59, 42.87),
    "Dushanbe, Tajikistan": (68.77, 38.56),
    "Ashgabat, Turkmenistan": (58.38, 37.95),
    
    # Oceania
    "Canberra, Australia": (149.13, -35.28),
    "Sydney, Australia": (151.21, -33.87),
    "Melbourne, Australia": (144.96, -37.81),
    "Wellington, New Zealand": (174.78, -41.29),
    "Auckland, New Zealand": (174.76, -36.85),
    "Suva, Fiji": (178.44, -18.14),
    "Port Moresby, Papua New Guinea": (147.18, -9.44),
    "Manus Island, Papua New Guinea": (147.00, -2.00),
    
    # =========================================================================
    # AFRICA
    # =========================================================================
    
    # North Africa
    "Cairo, Egypt": (31.24, 30.04),
    "Alexandria, Egypt": (29.92, 31.20),
    "Suez Canal, Egypt": (32.34, 30.46),
    "Rafah, Egypt": (34.24, 31.27),  # Egyptian side
    "Tripoli, Libya": (13.18, 32.90),
    "Benghazi, Libya": (20.07, 32.12),
    "Tunis, Tunisia": (10.18, 36.81),
    "Algiers, Algeria": (3.06, 36.75),
    "Rabat, Morocco": (-6.83, 34.01),
    
    # Sub-Saharan Africa
    "Khartoum, Sudan": (32.56, 15.50),
    "Port Sudan, Sudan": (37.22, 19.62),
    "Sudan": (32.56, 15.50),
    "Darfur, Sudan": (25.00, 13.50),
    "Addis Ababa, Ethiopia": (38.76, 9.01),
    "Mogadishu, Somalia": (45.34, 2.04),
    "Nairobi, Kenya": (36.82, -1.29),
    "Kampala, Uganda": (32.58, 0.32),
    "Kigali, Rwanda": (30.06, -1.94),
    "Kinshasa, DRC": (15.27, -4.44),
    "Lagos, Nigeria": (3.38, 6.52),
    "Abuja, Nigeria": (7.49, 9.08),
    "Accra, Ghana": (-0.19, 5.56),
    "Dakar, Senegal": (-17.47, 14.69),
    "Pretoria, South Africa": (28.19, -25.75),
    "Johannesburg, South Africa": (28.04, -26.20),
    "Cape Town, South Africa": (18.42, -33.93),
    "Harare, Zimbabwe": (31.05, -17.83),
    "Lusaka, Zambia": (28.28, -15.39),
    "Maputo, Mozambique": (32.59, -25.97),
    "Luanda, Angola": (13.23, -8.84),
    
    # Regional
    "Africa": (20.00, 5.00),
    "Sahel Region": (0.00, 15.00),
    "Horn of Africa": (45.00, 8.00),
    "Sub-Saharan Africa": (20.00, -5.00),
    
    # =========================================================================
    # MILITARY BASES & STRATEGIC LOCATIONS
    # =========================================================================
    
    "Ramstein Air Base, Germany": (7.60, 49.44),
    "Aviano Air Base, Italy": (12.60, 46.03),
    "Camp Bondsteel, Kosovo": (21.25, 42.37),
    "Diego Garcia": (72.42, -7.32),
    "Guam": (144.79, 13.44),
    "Pearl Harbor, Hawaii": (-157.95, 21.35),
    "Fort Bragg, USA": (-79.00, 35.14),
    "Camp David, USA": (-77.46, 39.65),
    "Yokosuka Naval Base, Japan": (139.67, 35.28),
    "Kadena Air Base, Japan": (127.77, 26.35),
    "Camp Humphreys, South Korea": (127.03, 36.96),
    "Bagram Airfield, Afghanistan": (69.27, 34.95),
    
    # Waters & Straits
    "Atlantic Ocean": (-40.00, 35.00),
    "Pacific Ocean": (-150.00, 0.00),
    "Indian Ocean": (75.00, -10.00),
    "Mediterranean Sea": (18.00, 35.00),
    "Black Sea": (35.00, 43.50),
    "Baltic Sea": (18.00, 57.00),
    "Bab el-Mandeb Strait": (43.33, 12.58),
    "Suez Canal": (32.34, 30.46),
    "Panama Canal": (-79.92, 9.08),
    "Malacca Strait": (101.00, 2.50),
    
    # Global / Worldwide (mid-Atlantic, out of the way)
    "Global": (-30.00, 35.00),
    "Worldwide": (-30.00, 35.00),
    "International": (-30.00, 35.00),
    "Multiple Countries": (-30.00, 35.00),
}


def get_location_prompt_context() -> str:
    """
    Generate a formatted string of locations for inclusion in LLM prompts.
    
    Groups locations by region for better readability and includes
    instructions for the LLM on how to use the reference data.
    """
    lines = [
        "LOCATION REFERENCE (use these coordinates for accuracy):",
        "",
    ]
    
    # Group by rough regions for readability
    regions = {
        "Middle East": [],
        "Europe": [],
        "Americas": [],
        "Asia-Pacific": [],
        "Africa": [],
        "Military/Strategic": [],
    }
    
    for loc, coords in LOCATIONS.items():
        lng, lat = coords
        entry = f"  {loc}: ({lng}, {lat})"
        
        # Simple region detection
        if any(x in loc for x in ["Iran", "Iraq", "Syria", "Israel", "Palestine", "Gaza", 
                                   "Lebanon", "Yemen", "Saudi", "Qatar", "UAE", "Kuwait",
                                   "Jordan", "Turkey", "Gulf", "Strait of Hormuz", "Red Sea"]):
            regions["Middle East"].append(entry)
        elif any(x in loc for x in ["Ukraine", "Russia", "UK", "France", "Germany", "Poland",
                                     "Italy", "Spain", "NATO", "EU", "Europe", "Baltic", 
                                     "Balkan", "Nordic", "Geneva", "Brussels", "Hague"]):
            regions["Europe"].append(entry)
        elif any(x in loc for x in ["USA", "Canada", "Mexico", "Brazil", "Venezuela", 
                                     "Cuba", "Colombia", "Argentina", "Chile", "Greenland",
                                     "Caribbean", "Atlantic", "Panama"]):
            regions["Americas"].append(entry)
        elif any(x in loc for x in ["China", "Japan", "Korea", "Taiwan", "India", "Pakistan",
                                     "Afghanistan", "Philippines", "Vietnam", "Thailand",
                                     "Singapore", "Indonesia", "Australia", "Pacific", "Sri Lanka"]):
            regions["Asia-Pacific"].append(entry)
        elif any(x in loc for x in ["Egypt", "Sudan", "Ethiopia", "Nigeria", "Kenya", "South Africa",
                                     "Libya", "Morocco", "Africa", "Sahel", "DRC", "Somalia"]):
            regions["Africa"].append(entry)
        else:
            regions["Military/Strategic"].append(entry)
    
    for region, entries in regions.items():
        if entries:
            lines.append(f"[{region}]")
            lines.extend(sorted(entries)[:30])  # Limit per region to avoid token bloat
            lines.append("")
    
    return "\n".join(lines)


# For quick testing
if __name__ == "__main__":
    print(f"Total locations: {len(LOCATIONS)}")
    print("\nSample prompt context (truncated):")
    context = get_location_prompt_context()
    print(context[:2000] + "...")
