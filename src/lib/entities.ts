/**
 * Entity utility functions and constants for Constellation
 */

import { EntityType } from "@/types/entities";

/**
 * Icon mapping for entity types
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
 * Country name to flag emoji mapping
 */
const COUNTRY_FLAGS: Record<string, string> = {
  china: "🇨🇳",
  "united states": "🇺🇸",
  usa: "🇺🇸",
  america: "🇺🇸",
  russia: "🇷🇺",
  taiwan: "🇹🇼",
  india: "🇮🇳",
  germany: "🇩🇪",
  france: "🇫🇷",
  "united kingdom": "🇬🇧",
  uk: "🇬🇧",
  britain: "🇬🇧",
  japan: "🇯🇵",
  "south korea": "🇰🇷",
  "north korea": "🇰🇵",
  iran: "🇮🇷",
  israel: "🇮🇱",
  "saudi arabia": "🇸🇦",
  ukraine: "🇺🇦",
  canada: "🇨🇦",
  australia: "🇦🇺",
  brazil: "🇧🇷",
  mexico: "🇲🇽",
  italy: "🇮🇹",
  spain: "🇪🇸",
  poland: "🇵🇱",
  turkey: "🇹🇷",
  egypt: "🇪🇬",
  nigeria: "🇳🇬",
  "south africa": "🇿🇦",
  pakistan: "🇵🇰",
  indonesia: "🇮🇩",
  vietnam: "🇻🇳",
  philippines: "🇵🇭",
  thailand: "🇹🇭",
  netherlands: "🇳🇱",
  belgium: "🇧🇪",
  sweden: "🇸🇪",
  norway: "🇳🇴",
  finland: "🇫🇮",
  denmark: "🇩🇰",
  switzerland: "🇨🇭",
  austria: "🇦🇹",
  greece: "🇬🇷",
  portugal: "🇵🇹",
  romania: "🇷🇴",
  hungary: "🇭🇺",
  "czech republic": "🇨🇿",
  iraq: "🇮🇶",
  syria: "🇸🇾",
  lebanon: "🇱🇧",
  jordan: "🇯🇴",
  yemen: "🇾🇪",
  qatar: "🇶🇦",
  "united arab emirates": "🇦🇪",
  uae: "🇦🇪",
  kuwait: "🇰🇼",
  algeria: "🇩🇿",
  morocco: "🇲🇦",
  tunisia: "🇹🇳",
  libya: "🇱🇾",
  ethiopia: "🇪🇹",
  kenya: "🇰🇪",
  somalia: "🇸🇴",
  sudan: "🇸🇩",
  afghanistan: "🇦🇫",
  bangladesh: "🇧🇩",
  myanmar: "🇲🇲",
  singapore: "🇸🇬",
  malaysia: "🇲🇾",
  argentina: "🇦🇷",
  chile: "🇨🇱",
  colombia: "🇨🇴",
  venezuela: "🇻🇪",
  peru: "🇵🇪",
  cuba: "🇨🇺",
  belarus: "🇧🇾",
  serbia: "🇷🇸",
  croatia: "🇭🇷",
  bosnia: "🇧🇦",
  albania: "🇦🇱",
  armenia: "🇦🇲",
  azerbaijan: "🇦🇿",
  georgia: "🇬🇪",
  kazakhstan: "🇰🇿",
  uzbekistan: "🇺🇿",
  mongolia: "🇲🇳",
  "new zealand": "🇳🇿",
  niger: "🇳🇪",
  mali: "🇲🇱",
  "burkina faso": "🇧🇫",
};

/**
 * Get flag emoji for a country name, or null if not found
 */
export function getCountryFlag(name: string): string | null {
  const normalized = name.toLowerCase().trim();
  return COUNTRY_FLAGS[normalized] || null;
}
