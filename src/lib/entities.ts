/**
 * Entity utility functions and constants for Constellation
 */

import { EntityType } from "@/types/entities";

/**
 * Icon mapping for entity types (emoji fallbacks)
 */
export const ENTITY_ICONS: Record<EntityType, string> = {
  country: "🌍",
  company: "🏢",
  leader: "👤",
  organization: "🏛️",
  alliance: "🤝",
  chokepoint: "🌊",
  facility: "🏭",
  commodity: "📦",
  product: "📱",
  weapon_system: "🚀",
};

/**
 * Get icon for entity type
 */
export function getEntityIcon(type: EntityType): string {
  return ENTITY_ICONS[type] || "•";
}

/**
 * Country name to ISO 3166-1 alpha-2 code mapping
 * Used for country-flag-icons package
 */
const COUNTRY_CODES: Record<string, string> = {
  china: "CN",
  "united states": "US",
  usa: "US",
  america: "US",
  russia: "RU",
  taiwan: "TW",
  india: "IN",
  germany: "DE",
  france: "FR",
  "united kingdom": "GB",
  uk: "GB",
  britain: "GB",
  japan: "JP",
  "south korea": "KR",
  "north korea": "KP",
  iran: "IR",
  israel: "IL",
  "saudi arabia": "SA",
  ukraine: "UA",
  canada: "CA",
  australia: "AU",
  brazil: "BR",
  mexico: "MX",
  italy: "IT",
  spain: "ES",
  poland: "PL",
  turkey: "TR",
  egypt: "EG",
  nigeria: "NG",
  "south africa": "ZA",
  pakistan: "PK",
  indonesia: "ID",
  vietnam: "VN",
  philippines: "PH",
  thailand: "TH",
  netherlands: "NL",
  belgium: "BE",
  sweden: "SE",
  norway: "NO",
  finland: "FI",
  denmark: "DK",
  switzerland: "CH",
  austria: "AT",
  greece: "GR",
  portugal: "PT",
  romania: "RO",
  hungary: "HU",
  "czech republic": "CZ",
  czechia: "CZ",
  iraq: "IQ",
  syria: "SY",
  lebanon: "LB",
  jordan: "JO",
  yemen: "YE",
  qatar: "QA",
  "united arab emirates": "AE",
  uae: "AE",
  kuwait: "KW",
  algeria: "DZ",
  morocco: "MA",
  tunisia: "TN",
  libya: "LY",
  ethiopia: "ET",
  kenya: "KE",
  somalia: "SO",
  sudan: "SD",
  afghanistan: "AF",
  bangladesh: "BD",
  myanmar: "MM",
  singapore: "SG",
  malaysia: "MY",
  argentina: "AR",
  chile: "CL",
  colombia: "CO",
  venezuela: "VE",
  peru: "PE",
  cuba: "CU",
  belarus: "BY",
  serbia: "RS",
  croatia: "HR",
  bosnia: "BA",
  albania: "AL",
  armenia: "AM",
  azerbaijan: "AZ",
  georgia: "GE",
  kazakhstan: "KZ",
  uzbekistan: "UZ",
  mongolia: "MN",
  "new zealand": "NZ",
  niger: "NE",
  mali: "ML",
  "burkina faso": "BF",
  palestine: "PS",
  gaza: "PS",
  "hong kong": "HK",
  ireland: "IE",
  iceland: "IS",
  luxembourg: "LU",
  slovakia: "SK",
  slovenia: "SI",
  bulgaria: "BG",
  cyprus: "CY",
  malta: "MT",
  estonia: "EE",
  latvia: "LV",
  lithuania: "LT",
  oman: "OM",
  bahrain: "BH",
  "sri lanka": "LK",
  nepal: "NP",
  cambodia: "KH",
  laos: "LA",
  brunei: "BN",
  "costa rica": "CR",
  panama: "PA",
  ecuador: "EC",
  bolivia: "BO",
  paraguay: "PY",
  uruguay: "UY",
  guatemala: "GT",
  honduras: "HN",
  "el salvador": "SV",
  nicaragua: "NI",
  "dominican republic": "DO",
  haiti: "HT",
  jamaica: "JM",
  "trinidad and tobago": "TT",
  guyana: "GY",
  ghana: "GH",
  "ivory coast": "CI",
  cameroon: "CM",
  senegal: "SN",
  tanzania: "TZ",
  uganda: "UG",
  rwanda: "RW",
  congo: "CG",
  drc: "CD",
  "democratic republic of the congo": "CD",
  zimbabwe: "ZW",
  zambia: "ZM",
  mozambique: "MZ",
  angola: "AO",
  namibia: "NA",
  botswana: "BW",
  mauritius: "MU",
};

/**
 * Get ISO country code for a country name, or null if not found
 */
export function getCountryCode(name: string): string | null {
  const normalized = name.toLowerCase().trim();
  return COUNTRY_CODES[normalized] || null;
}

/**
 * Get flag CDN URL for a country code
 * Uses flagcdn.com which provides high-quality SVG flags
 */
export function getFlagUrl(countryCode: string, size: number = 40): string {
  return `https://flagcdn.com/w${size}/${countryCode.toLowerCase()}.png`;
}

/**
 * Legacy function - kept for backwards compatibility
 * Returns null to signal that SVG flag should be used instead
 */
export function getCountryFlag(name: string): string | null {
  // Return null to signal callers should use the new flag component approach
  return null;
}
