// Phone country detection for the UI. The backend (lookupPhoneNumber) performs
// the authoritative normalization; this lightweight helper is used only to
// auto-set the country selector when a user enters a number with an explicit
// international prefix (+ or 00). Keep this table in sync with the backend's
// PHONE_COUNTRY_TABLE in base44/functions/lookupPhoneNumber/entry.ts.
const PHONE_COUNTRY_TABLE = [
  { code: '1', country: 'United States', stripLeadingZero: false },
  { code: '1', country: 'Canada', stripLeadingZero: false },
  { code: '7', country: 'Russia', stripLeadingZero: true },
  { code: '20', country: 'Egypt', stripLeadingZero: true },
  { code: '27', country: 'South Africa', stripLeadingZero: true },
  { code: '30', country: 'Greece', stripLeadingZero: true },
  { code: '31', country: 'Netherlands', stripLeadingZero: true },
  { code: '32', country: 'Belgium', stripLeadingZero: true },
  { code: '33', country: 'France', stripLeadingZero: true },
  { code: '34', country: 'Spain', stripLeadingZero: true },
  { code: '36', country: 'Hungary', stripLeadingZero: true },
  { code: '39', country: 'Italy', stripLeadingZero: false },
  { code: '40', country: 'Romania', stripLeadingZero: true },
  { code: '41', country: 'Switzerland', stripLeadingZero: true },
  { code: '43', country: 'Austria', stripLeadingZero: true },
  { code: '44', country: 'United Kingdom', stripLeadingZero: true },
  { code: '45', country: 'Denmark', stripLeadingZero: false },
  { code: '46', country: 'Sweden', stripLeadingZero: true },
  { code: '47', country: 'Norway', stripLeadingZero: false },
  { code: '48', country: 'Poland', stripLeadingZero: true },
  { code: '49', country: 'Germany', stripLeadingZero: true },
  { code: '51', country: 'Peru', stripLeadingZero: true },
  { code: '52', country: 'Mexico', stripLeadingZero: true },
  { code: '53', country: 'Cuba', stripLeadingZero: true },
  { code: '54', country: 'Argentina', stripLeadingZero: true },
  { code: '55', country: 'Brazil', stripLeadingZero: true },
  { code: '56', country: 'Chile', stripLeadingZero: true },
  { code: '57', country: 'Colombia', stripLeadingZero: true },
  { code: '58', country: 'Venezuela', stripLeadingZero: true },
  { code: '60', country: 'Malaysia', stripLeadingZero: true },
  { code: '61', country: 'Australia', stripLeadingZero: true },
  { code: '62', country: 'Indonesia', stripLeadingZero: true },
  { code: '63', country: 'Philippines', stripLeadingZero: true },
  { code: '64', country: 'New Zealand', stripLeadingZero: true },
  { code: '65', country: 'Singapore', stripLeadingZero: false },
  { code: '66', country: 'Thailand', stripLeadingZero: true },
  { code: '81', country: 'Japan', stripLeadingZero: true },
  { code: '82', country: 'South Korea', stripLeadingZero: true },
  { code: '84', country: 'Vietnam', stripLeadingZero: true },
  { code: '86', country: 'China', stripLeadingZero: true },
  { code: '90', country: 'Turkey', stripLeadingZero: true },
  { code: '91', country: 'India', stripLeadingZero: true },
  { code: '92', country: 'Pakistan', stripLeadingZero: true },
  { code: '94', country: 'Sri Lanka', stripLeadingZero: true },
  { code: '95', country: 'Myanmar', stripLeadingZero: true },
  { code: '98', country: 'Iran', stripLeadingZero: true },
  { code: '212', country: 'Morocco', stripLeadingZero: true },
  { code: '213', country: 'Algeria', stripLeadingZero: true },
  { code: '216', country: 'Tunisia', stripLeadingZero: true },
  { code: '234', country: 'Nigeria', stripLeadingZero: true },
  { code: '254', country: 'Kenya', stripLeadingZero: true },
  { code: '255', country: 'Tanzania', stripLeadingZero: true },
  { code: '256', country: 'Uganda', stripLeadingZero: true },
  { code: '260', country: 'Zambia', stripLeadingZero: true },
  { code: '263', country: 'Zimbabwe', stripLeadingZero: true },
  { code: '351', country: 'Portugal', stripLeadingZero: true },
  { code: '353', country: 'Ireland', stripLeadingZero: true },
  { code: '358', country: 'Finland', stripLeadingZero: true },
  { code: '370', country: 'Lithuania', stripLeadingZero: true },
  { code: '371', country: 'Latvia', stripLeadingZero: true },
  { code: '372', country: 'Estonia', stripLeadingZero: true },
  { code: '375', country: 'Belarus', stripLeadingZero: true },
  { code: '380', country: 'Ukraine', stripLeadingZero: true },
  { code: '385', country: 'Croatia', stripLeadingZero: true },
  { code: '386', country: 'Slovenia', stripLeadingZero: true },
  { code: '420', country: 'Czech Republic', stripLeadingZero: true },
  { code: '421', country: 'Slovakia', stripLeadingZero: true },
  { code: '505', country: 'Nicaragua', stripLeadingZero: true },
  { code: '506', country: 'Costa Rica', stripLeadingZero: true },
  { code: '507', country: 'Panama', stripLeadingZero: true },
  { code: '595', country: 'Paraguay', stripLeadingZero: true },
  { code: '598', country: 'Uruguay', stripLeadingZero: true },
  { code: '880', country: 'Bangladesh', stripLeadingZero: true },
  { code: '886', country: 'Taiwan', stripLeadingZero: true },
  { code: '961', country: 'Lebanon', stripLeadingZero: true },
  { code: '962', country: 'Jordan', stripLeadingZero: true },
  { code: '965', country: 'Kuwait', stripLeadingZero: true },
  { code: '966', country: 'Saudi Arabia', stripLeadingZero: true },
  { code: '968', country: 'Oman', stripLeadingZero: true },
  { code: '971', country: 'United Arab Emirates', stripLeadingZero: true },
  { code: '974', country: 'Qatar', stripLeadingZero: true },
  { code: '972', country: 'Israel', stripLeadingZero: true },
];

// Returns the country name for a number entered with an explicit international
// prefix (+ or 00), or null for local-format numbers (no prefix to detect from).
export function detectPhoneCountry(phone) {
  if (!phone) return null;
  const raw = String(phone).trim();
  let digits = raw.replace(/[^\d]/g, '');
  let explicitIntl = raw.startsWith('+');
  if (!explicitIntl && digits.startsWith('00')) { digits = digits.slice(2); explicitIntl = true; }
  if (!explicitIntl || digits.length === 0) return null;
  const sorted = PHONE_COUNTRY_TABLE.slice().sort((a, b) => b.code.length - a.code.length);
  for (const e of sorted) {
    if (digits.startsWith(e.code)) return e.country;
  }
  return null;
}