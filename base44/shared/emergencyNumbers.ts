// Known emergency, government, and enterprise short-code numbers (3-6 digits).
// These are well-known public-service numbers that don't require web evidence lookup.

export interface EmergencyNumberInfo {
  number: string;        // digits only, no country code (e.g., "911", "100")
  countries: string[];    // ISO country codes
  service: string;       // description
  type: "emergency" | "government" | "enterprise";
}

// Normalized to digits-only for matching. Each entry is the national short code.
const EMERGENCY_NUMBERS: EmergencyNumberInfo[] = [
  // North America
  { number: "911", countries: ["US", "CA", "MX"], service: "Emergency services (police, fire, ambulance)", type: "emergency" },
  // Europe
  { number: "112", countries: ["GB", "DE", "FR", "IT", "ES", "NL", "BE", "AT", "PT", "SE", "NO", "DK", "FI", "IE", "PL", "GR", "CZ", "HU", "RO", "BG", "HR", "SK", "SI", "LT", "LV", "EE", "LU", "CY", "MT", "IS"], service: "EU-wide emergency number", type: "emergency" },
  { number: "999", countries: ["GB", "IE", "MY", "SG", "AE", "BH", "QA", "OM", "KW"], service: "Emergency services", type: "emergency" },
  { number: "111", countries: ["GB", "NZ"], service: "Non-emergency police / health helpline", type: "government" },
  { number: "101", countries: ["GB", "NZ"], service: "Non-emergency police", type: "government" },
  { number: "105", countries: ["NZ"], service: "Non-emergency government helpline", type: "government" },
  // Australia
  { number: "000", countries: ["AU"], service: "Emergency services", type: "emergency" },
  // Japan
  { number: "110", countries: ["JP", "KR"], service: "Police", type: "emergency" },
  { number: "119", countries: ["JP", "KR", "CN"], service: "Fire / Ambulance", type: "emergency" },
  // China
  { number: "120", countries: ["CN"], service: "Medical emergency (ambulance)", type: "emergency" },
  { number: "122", countries: ["CN"], service: "Traffic emergency", type: "emergency" },
  { number: "123", countries: ["CN"], service: "Government services hotline", type: "government" },
  // India
  { number: "100", countries: ["IN"], service: "Police", type: "emergency" },
  { number: "101", countries: ["IN"], service: "Fire", type: "emergency" },
  { number: "102", countries: ["IN"], service: "Ambulance", type: "emergency" },
  { number: "108", countries: ["IN"], service: "Emergency medical service (disaster management)", type: "emergency" },
  { number: "1091", countries: ["IN"], service: "Women's helpline", type: "government" },
  { number: "1098", countries: ["IN"], service: "Child helpline", type: "government" },
  // Israel
  { number: "100", countries: ["IL"], service: "Police", type: "emergency" },
  { number: "101", countries: ["IL"], service: "Ambulance / Medical emergency", type: "emergency" },
  { number: "102", countries: ["IL"], service: "Fire department", type: "emergency" },
  { number: "103", countries: ["IL"], service: "Municipal services", type: "government" },
  // Southeast Asia
  { number: "191", countries: ["TH"], service: "Police", type: "emergency" },
  { number: "199", countries: ["TH", "ID"], service: "Fire", type: "emergency" },
  { number: "1669", countries: ["TH"], service: "Medical emergency (ambulance)", type: "emergency" },
  { number: "133", countries: ["ID", "AR"], service: "Police / Emergency", type: "emergency" },
  { number: "113", countries: ["ID"], service: "Fire", type: "emergency" },
  { number: "118", countries: ["ID"], service: "Ambulance", type: "emergency" },
  { number: "911", countries: ["PH"], service: "Emergency hotline", type: "emergency" },
  { number: "117", countries: ["PH"], service: "Emergency hotline (legacy)", type: "emergency" },
  // South America
  { number: "190", countries: ["BR"], service: "Police", type: "emergency" },
  { number: "192", countries: ["BR"], service: "Ambulance / Medical emergency", type: "emergency" },
  { number: "193", countries: ["BR"], service: "Fire department", type: "emergency" },
  { number: "911", countries: ["BR"], service: "Emergency (some states)", type: "emergency" },
  { number: "133", countries: ["AR", "CL", "CO"], service: "Police", type: "emergency" },
  { number: "107", countries: ["AR"], service: "Ambulance", type: "emergency" },
  { number: "100", countries: ["AR"], service: "Fire department", type: "emergency" },
  { number: "131", countries: ["CO"], service: "Ambulance", type: "emergency" },
  { number: "132", countries: ["CO"], service: "Fire department", type: "emergency" },
  { number: "123", countries: ["CO"], service: "National emergency line", type: "emergency" },
  // Russia
  { number: "112", countries: ["RU"], service: "Emergency services", type: "emergency" },
  { number: "102", countries: ["RU"], service: "Police", type: "emergency" },
  { number: "103", countries: ["RU"], service: "Ambulance / Medical emergency", type: "emergency" },
  { number: "101", countries: ["RU"], service: "Fire department", type: "emergency" },
  // South Africa
  { number: "10111", countries: ["ZA"], service: "Police", type: "emergency" },
  { number: "10177", countries: ["ZA"], service: "Ambulance", type: "emergency" },
  // UAE
  { number: "999", countries: ["AE"], service: "Police", type: "emergency" },
  { number: "997", countries: ["AE"], service: "Fire / Civil defense", type: "emergency" },
  { number: "998", countries: ["AE"], service: "Ambulance", type: "emergency" },
];

// Merge duplicate entries (same number, different countries) into one record
const EMERGENCY_MAP = new Map<string, EmergencyNumberInfo>();
for (const entry of EMERGENCY_NUMBERS) {
  const existing = EMERGENCY_MAP.get(entry.number);
  if (existing) {
    // Merge countries and keep the first (primary) service description
    const mergedCountries = Array.from(new Set([...existing.countries, ...entry.countries]));
    EMERGENCY_MAP.set(entry.number, {
      ...existing,
      countries: mergedCountries,
    });
  } else {
    EMERGENCY_MAP.set(entry.number, entry);
  }
}

// Check if a digits-only string is a known emergency/government short code.
export function isEmergencyNumber(digits: string): EmergencyNumberInfo | null {
  const normalized = String(digits || "").replace(/\D/g, "");
  if (normalized.length < 2 || normalized.length > 6) return null;
  return EMERGENCY_MAP.get(normalized) || null;
}

// Check if a raw phone input is likely a short emergency code.
// Strips country code prefix to check the national portion.
export function checkEmergencyFromRaw(rawPhone: string): EmergencyNumberInfo | null {
  const digits = String(rawPhone || "").replace(/\D/g, "");
  if (!digits) return null;

  // Direct match on full digits (e.g., user typed "911")
  const direct = isEmergencyNumber(digits);
  if (direct) return direct;

  // Strip common country codes and check the national portion
  const COUNTRY_CODES = ["1", "44", "61", "81", "82", "86", "91", "972", "971", "55", "54", "62", "63", "66", "60", "65", "7", "27", "49", "33", "39", "34", "31"];
  for (const cc of COUNTRY_CODES) {
    if (digits.startsWith(cc) && digits.length > cc.length) {
      const national = digits.slice(cc.length);
      const match = isEmergencyNumber(national);
      if (match) return match;
    }
  }

  return null;
}