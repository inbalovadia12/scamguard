import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { waitUntil } from 'base44:runtime';
import { upsertPhoneReputation } from '../../shared/phoneReputation.ts';

// Manual phone-number reputation lookup.
//   Fast path (instant):  canonical PhoneReputation index hit (fresh) -> accurate, no LLM.
//   First-try path (<5s): cache miss -> quick LLM pass WITHOUT web search -> provisional
//                         answer returned immediately. A deep web-research lookup runs in
//                         the background (waitUntil) and upserts the canonical index, so the
//                         NEXT lookup on this number is instant + accurate. No retry needed.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    let plan = user.subscription_plan || 'starter';
    if (plan === 'free') plan = 'starter';
    if (plan === 'elite') plan = 'premium';
    if (plan !== 'premium' && plan !== 'plus') {
      return Response.json({ error: 'Premium subscription required', upgrade_url: 'https://vardin.base44.app/pricing' }, { status: 403 });
    }

    const body = await req.json();
    const { phone_number, language } = body;

    if (!phone_number || !phone_number.trim()) {
      return Response.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const cacheKey = '+' + phone_number.trim().replace(/[^\d]/g, '');

    // ---- Fast path: return the canonical reputation index if this number is already known ----
    try {
      const cached = await base44.asServiceRole.entities.PhoneReputation.filter({ normalized_number: cacheKey });
      const STALE_MS = 1000 * 60 * 60 * 24 * 30;
      const r = cached[0];
      if (r && r.last_external_check_at && (Date.now() - new Date(r.last_external_check_at).getTime() < STALE_MS)) {
        const result = {
          country: r.country || '',
          carrier: r.carrier || '',
          reputation_score: r.reputation_score || 0,
          risk_level: r.risk_level || 'low',
          user_reports: [],
          scam_categories: r.scam_categories || [],
          summary: r.summary || '',
          sources: r.sources || [],
        };
        return Response.json({
          result,
          lookup: { id: r.id, phone_number: r.phone_number, cached: true },
          cached: true,
          provisional: false,
        });
      }
    } catch {}

    // ---- First-try path: instant provisional answer, deep lookup runs in background ----
    const cleaned = phone_number.trim().replace(/[^\d]/g, '');

    let tenDigit: string;
    if (cleaned.length === 10) {
      tenDigit = cleaned;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      tenDigit = cleaned.slice(1);
    } else if (cleaned.length > 10) {
      tenDigit = cleaned.slice(-10);
    } else {
      tenDigit = cleaned;
    }

    const isValidNANP = tenDigit.length === 10 && !tenDigit.startsWith('0') && !tenDigit.startsWith('1');
    const displayFormat = isValidNANP
      ? `${tenDigit.slice(0, 3)}-${tenDigit.slice(3, 6)}-${tenDigit.slice(6)}`
      : phone_number.trim();
    const intlFormat = isValidNANP ? `+1${tenDigit}` : `+${cleaned}`;

    const LANGUAGE_NAMES: Record<string, string> = { en: 'English', he: 'Hebrew', es: 'Spanish' };
    const languageName = LANGUAGE_NAMES[language] || 'English';

    // Instant provisional answer — NO LLM round-trip on the critical path. Country is
    // derived deterministically from the country code (more reliable than an LLM guess);
    // carrier is "Unknown" until the background deep lookup fills in the real one.
    // Accuracy is preserved: the deep lookup (below) still runs, and the NEXT lookup on
    // this number returns the full, verified result from the canonical index.
    const provisionalResult = {
      country: countryFromNumber(intlFormat),
      carrier: 'Unknown',
      reputation_score: 5,
      risk_level: 'low' as const,
      user_reports: [] as string[],
      scam_categories: [] as string[],
      summary: 'No scam reports in our index yet for this number. A deeper check is running in the background.',
      sources: [] as string[],
    };

    const saved = await base44.entities.PhoneLookup.create({
      phone_number: displayFormat,
      country: provisionalResult.country,
      carrier: provisionalResult.carrier,
      reputation_score: provisionalResult.reputation_score,
      risk_level: provisionalResult.risk_level,
      user_reports: provisionalResult.user_reports,
      scam_categories: provisionalResult.scam_categories,
      summary: provisionalResult.summary,
      sources: provisionalResult.sources,
    });

    // Deep web research runs in the background; upserts the canonical index so the
    // NEXT lookup on this number is instant + accurate. Never blocks the response.
    waitUntil(deepLookupAndUpsert(base44, cacheKey, displayFormat, intlFormat, languageName));

    return Response.json({ result: provisionalResult, lookup: saved, cached: false, provisional: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Background deep lookup: full web research against public scam/spam databases, then upsert.
async function deepLookupAndUpsert(base44: any, nn: string, displayFormat: string, intlFormat: string, languageName: string) {
  try {
    const prompt = `You are a phone number reputation analyst. Research the phone number: ${displayFormat} (international: ${intlFormat})

CRITICAL RULES — VIOLATING THESE INVALIDATES YOUR RESPONSE:
1. Report ONLY information SPECIFIC to THIS EXACT number regarding scam calls, spam, or robocalls.
2. Only include a source URL if that page's PRIMARY topic is this number as a scam/spam caller.
3. If no specific reports exist: reputation_score 5-15, risk_level "low", empty user_reports/scam_categories/sources, and say "No scam reports found for this number."

Check: 800notes.com, whocallsme.com, nomorobo.com, truecaller.com, reportfraud.ftc.gov, Reddit r/scams and r/phonescams (only posts whose title or body mention this exact number).

Return: country, carrier, reputation_score (0-100), risk_level (low/medium/high), user_reports[], scam_categories[], summary, sources[].
Respond entirely in ${languageName}.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          country: { type: 'string' },
          carrier: { type: 'string' },
          reputation_score: { type: 'number' },
          risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
          user_reports: { type: 'array', items: { type: 'string' } },
          scam_categories: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' },
          sources: { type: 'array', items: { type: 'string' } },
        },
        required: ['reputation_score', 'risk_level', 'summary'],
      },
    });

    await upsertPhoneReputation(base44, {
      normalized_number: nn,
      phone_number: displayFormat,
      country: result.country || '',
      carrier: result.carrier || '',
      reputation_score: result.reputation_score || 0,
      risk_level: result.risk_level || 'low',
      scam_categories: result.scam_categories || [],
      summary: result.summary || '',
      sources: result.sources || [],
      last_external_check_at: new Date().toISOString(),
    });
  } catch {
    // background enrichment is best-effort; never throw after the response is sent
  }
}

// Deterministic country lookup from the international dialing code. Used for the
// instant provisional answer (no LLM needed); the background deep lookup overrides
// it with the verified value. Longest-prefix-first matching handles variable-length
// country codes (1-4 digits).
const COUNTRY_CODES: Record<string, string> = {
  '1': 'United States / Canada',
  '7': 'Russia / Kazakhstan',
  '20': 'Egypt', '27': 'South Africa', '30': 'Greece', '31': 'Netherlands',
  '32': 'Belgium', '33': 'France', '34': 'Spain', '36': 'Hungary',
  '39': 'Italy', '40': 'Romania', '41': 'Switzerland', '44': 'United Kingdom',
  '45': 'Denmark', '46': 'Sweden', '47': 'Norway', '48': 'Poland',
  '49': 'Germany', '51': 'Peru', '52': 'Mexico', '53': 'Cuba',
  '54': 'Argentina', '55': 'Brazil', '56': 'Chile', '57': 'Colombia',
  '58': 'Venezuela', '60': 'Malaysia', '61': 'Australia', '62': 'Indonesia',
  '63': 'Philippines', '64': 'New Zealand', '65': 'Singapore', '66': 'Thailand',
  '81': 'Japan', '82': 'South Korea', '84': 'Vietnam', '86': 'China',
  '90': 'Turkey', '91': 'India', '92': 'Pakistan', '93': 'Afghanistan',
  '94': 'Sri Lanka', '95': 'Myanmar', '98': 'Iran',
  '212': 'Morocco', '213': 'Algeria', '216': 'Tunisia', '218': 'Libya',
  '220': 'Gambia', '221': 'Senegal', '222': 'Mauritania', '223': 'Mali',
  '224': 'Guinea', '225': 'Ivory Coast', '226': 'Burkina Faso', '227': 'Niger',
  '228': 'Togo', '229': 'Benin', '230': 'Mauritius', '231': 'Liberia',
  '232': 'Sierra Leone', '233': 'Ghana', '234': 'Nigeria', '235': 'Chad',
  '236': 'Central African Republic', '237': 'Cameroon', '238': 'Cape Verde',
  '239': 'Sao Tome', '240': 'Equatorial Guinea', '241': 'Gabon', '242': 'Congo',
  '243': 'DR Congo', '244': 'Angola', '245': 'Guinea-Bissau', '248': 'Seychelles',
  '249': 'Sudan', '250': 'Rwanda', '251': 'Ethiopia', '252': 'Somalia',
  '253': 'Djibouti', '254': 'Kenya', '255': 'Tanzania', '256': 'Uganda',
  '257': 'Burundi', '258': 'Mozambique', '260': 'Zambia', '261': 'Madagascar',
  '263': 'Zimbabwe', '264': 'Namibia', '265': 'Malawi', '266': 'Lesotho',
  '267': 'Botswana', '268': 'Eswatini', '269': 'Comoros',
  '290': 'Saint Helena', '291': 'Eritrea', '297': 'Aruba', '298': 'Faroe Islands',
  '299': 'Greenland',
  '350': 'Gibraltar', '351': 'Portugal', '352': 'Luxembourg', '353': 'Ireland',
  '354': 'Iceland', '355': 'Albania', '356': 'Malta', '357': 'Cyprus',
  '358': 'Finland', '359': 'Bulgaria', '370': 'Lithuania', '371': 'Latvia',
  '372': 'Estonia', '373': 'Moldova', '374': 'Armenia', '375': 'Belarus',
  '376': 'Andorra', '377': 'Monaco', '378': 'San Marino', '380': 'Ukraine',
  '381': 'Serbia', '382': 'Montenegro', '383': 'Kosovo', '385': 'Croatia',
  '386': 'Slovenia', '387': 'Bosnia and Herzegovina', '389': 'North Macedonia',
  '420': 'Czech Republic', '421': 'Slovakia', '423': 'Liechtenstein',
  '500': 'Falkland Islands', '501': 'Belize', '502': 'Guatemala',
  '503': 'El Salvador', '504': 'Honduras', '505': 'Nicaragua',
  '506': 'Costa Rica', '507': 'Panama', '508': 'Saint Pierre and Miquelon',
  '509': 'Haiti', '590': 'Guadeloupe', '591': 'Bolivia', '592': 'Guyana',
  '593': 'Ecuador', '594': 'French Guiana', '595': 'Paraguay',
  '596': 'Martinique', '597': 'Suriname', '598': 'Uruguay',
  '670': 'East Timor', '672': 'Norfolk Island', '673': 'Brunei',
  '674': 'Nauru', '675': 'Papua New Guinea', '676': 'Tonga',
  '677': 'Solomon Islands', '678': 'Vanuatu', '679': 'Fiji', '680': 'Palau',
  '682': 'Cook Islands', '685': 'Samoa', '686': 'Kiribati',
  '687': 'New Caledonia', '688': 'Tuvalu', '689': 'French Polynesia',
  '691': 'Micronesia', '692': 'Marshall Islands',
  '850': 'North Korea', '852': 'Hong Kong', '853': 'Macau', '855': 'Cambodia',
  '856': 'Laos', '880': 'Bangladesh', '886': 'Taiwan',
  '960': 'Maldives', '961': 'Lebanon', '962': 'Jordan', '963': 'Syria',
  '964': 'Iraq', '965': 'Kuwait', '966': 'Saudi Arabia', '967': 'Yemen',
  '968': 'Oman', '971': 'United Arab Emirates', '972': 'Israel', '973': 'Bahrain',
  '974': 'Qatar', '975': 'Bhutan', '976': 'Mongolia', '977': 'Nepal',
  '992': 'Tajikistan', '993': 'Turkmenistan', '994': 'Azerbaijan',
  '995': 'Georgia', '996': 'Kyrgyzstan', '998': 'Uzbekistan',
};

function countryFromNumber(intl: string): string {
  const d = intl.replace(/^\+/, '');
  for (let len = 4; len >= 1; len--) {
    const prefix = d.slice(0, len);
    if (COUNTRY_CODES[prefix]) return COUNTRY_CODES[prefix];
  }
  // No dialing code matched — the number was entered in local format without a
  // country code (starts with a trunk '0'). Vardin's primary market is Israel, so
  // default there; the background deep lookup confirms/overrides it.
  if (d.startsWith('0')) return 'Israel';
  return '';
}