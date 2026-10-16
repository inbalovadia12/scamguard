import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

type AnyRecord = Record<string, any>;

// Check if phone_sources indicates an emergency/government short code
function isEmergencySource(phoneSources: AnyRecord): AnyRecord | null {
  if (phoneSources?.is_emergency_number && phoneSources?.emergency_info) {
    return phoneSources.emergency_info;
  }
  return null;
}

function first(...values: any[]) {
  return values.find((v) => v !== undefined && v !== null && v !== "");
}

function arr(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.reports)) return value.reports;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.complaints)) return value.complaints;
  if (Array.isArray(value?.records)) return value.records;
  return [];
}

function normalizeText(value: any): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s || null;
}

function normalizeReport(report: AnyRecord, source: string, index: number) {
  const text = normalizeText(first(
    report.text, report.description, report.summary, report.reason,
    report.subject, report.comment, report.details, report.report
  ));
  const category = normalizeText(first(
    report.category, report.scam_type, report.scamType,
    report.type, report.subject
  ));
  const url = normalizeText(first(report.url, report.link, report.source_url, report.links?.detail));
  const date = normalizeText(first(
    report.date, report.reported_at, report.created_at, report.createdAt,
    report.last_reported, report.lastReported
  ));
  return {
    source,
    id: normalizeText(first(report.id, report.report_id, report.slug)) || `${source}-${index + 1}`,
    category,
    text,
    date,
    url,
    raw: report,
  };
}

function extractNumbersOnline(data: AnyRecord) {
  const cnamObject = data.cnam && typeof data.cnam === "object" ? data.cnam : null;
  const carrierObject = data.carrier && typeof data.carrier === "object" ? data.carrier : null;
  const phoneObject = data.phone && typeof data.phone === "object" ? data.phone : null;
  const numberObject = data.number && typeof data.number === "object" ? data.number : null;
  const countryObject = data.country && typeof data.country === "object" ? data.country : null;
  const rangeCarrier = data.range_carrier && typeof data.range_carrier === "object" ? data.range_carrier : null;
  const riskObject = data.risk && typeof data.risk === "object" ? data.risk : null;

  const callerName = normalizeText(first(
    typeof data.cnam === "string" ? data.cnam : null,
    cnamObject?.name,
    cnamObject?.display_name,
    cnamObject?.displayName,
    cnamObject?.value,
    cnamObject?.label,
    data.caller_name,
    data.callerName,
    data.caller_id_name,
    data.callerIdName,
    data.name,
    data.display_name,
    data.displayName,
    data.business_name,
    data.businessName,
    data.organization,
    data.organization_name,
    data.caller?.name,
    data.caller?.display_name,
    data.identity?.name,
    data.identity?.display_name,
    phoneObject?.caller_name,
    phoneObject?.name,
    numberObject?.caller_name,
    numberObject?.name,
  ));

  return {
    valid: first(data.valid, data.is_valid, phoneObject?.valid, numberObject?.valid),
    country: normalizeText(first(
      typeof data.country === "string" ? data.country : null,
      data.country_name,
      data.countryName,
      countryObject?.name,
      countryObject?.country,
      phoneObject?.country,
      numberObject?.country,
    )),
    country_code: normalizeText(first(
      data.country_code,
      data.countryCode,
      countryObject?.code,
      countryObject?.country_code,
      phoneObject?.country_code,
      numberObject?.country_code,
      data.iso_country,
    )),
    carrier: normalizeText(first(
      typeof data.carrier === "string" ? data.carrier : null,
      data.carrier_name,
      data.network,
      data.range_carrier,
      data.rangeCarrier,
      carrierObject?.name,
      carrierObject?.carrier,
      rangeCarrier?.name,
      rangeCarrier?.carrier,
      phoneObject?.carrier,
      numberObject?.carrier,
    )),
    line_type: normalizeText(first(
      data.line_type,
      data.lineType,
      data.type,
      phoneObject?.line_type,
      phoneObject?.type,
      numberObject?.line_type,
      numberObject?.type,
    )),
    caller_name: callerName,
    spam_signal: first(
      data.spam,
      data.spam_score,
      data.spamScore,
      data.spam_signal,
      data.risk_score,
      data.riskScore,
      riskObject?.spam,
      riskObject?.spam_score,
      riskObject?.spamScore,
      riskObject?.score,
    ),
    source_risk_level: normalizeText(first(
      data.risk_level,
      data.riskLevel,
      riskObject?.level,
      riskObject?.risk_level,
    )),
  };
}

function normalizeBusinessKey(value: any): string {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Known brand names that may appear in directory page titles (e.g., jpnumber
// shows "Beatsサポート" for the Beats Japan support number). When the LLM
// can't find the official page, extracting the brand from a verified
// directory title is a reliable fallback.
const KNOWN_BRANDS = [
  "apple", "beats", "beatsbydre", "microsoft", "google", "amazon",
  "samsung", "netflix", "paypal", "ebay", "meta", "facebook",
  "instagram", "whatsapp", "twitter", "linkedin", "tiktok",
];

function extractBrandFromTitles(webResults: AnyRecord[]): string | null {
  for (const r of webResults) {
    if (!r?.verified_exact_number) continue;
    const text = normalizeBusinessKey([r.title, r.snippet].filter(Boolean).join(" "));
    if (!text) continue;
    for (const brand of KNOWN_BRANDS) {
      if (text.includes(brand)) {
        return brand.charAt(0).toUpperCase() + brand.slice(1);
      }
    }
  }
  return null;
}

function registeredDomain(hostname: string) {
  const parts = String(hostname || "").toLowerCase().replace(/^www\./i, "").split(".");
  if (parts.length < 2) return parts[0] || "";
  const secondLast = parts[parts.length - 2];
  const thirdLast = parts[parts.length - 3];
  // UK second-level domains (.co.uk, .me.uk, .org.uk, .ac.uk, .gov.uk, .ltd.uk, .plc.uk)
  if (["co", "com", "net", "org", "gov", "ac", "me", "ltd", "plc"].includes(secondLast) && thirdLast) {
    return thirdLast;
  }
  return secondLast;
}

const GENERIC_WEB_HOSTS = new Set([
  // Phone directory / scam-report aggregators (not official business sources)
  "who-called", "whos-called", "whocalled", "whoscalled", "truecaller",
  "scamcallcheck", "phonely", "everycaller", "connection-technologies",
  "who-calls", "cleverdialer", "tellows", "shouldianswer", "800notes",
  "whocalls", "whocallsme", "callercomplaints", "whocalledus", "callcontrol",
  "nomorobo", "robocaller", "robokiller", "phoneowner", "reversephone",
  "yellowpages", "whitepages", "callercheck", "numlookup", "411",
  "scamadviser", "scamchecker", "bizapedia", "whocall", "phonebook",
  "tel-directory", "numberguru", "spydialer", "usphonebook", "jpnumber",
  "sync", "callfilter", "unknownphone", "findwhoiscalling", "numbercheck",
  "checknumber", "who-is-calling", "whocalling", "who-calls",
  // Phone-reporting / forum / discussion sites
  "called", "saynoto0870", "callersmart", "phonepay", "phone-number",
  "phonenumber", "reverse-lookup", "reverselookup", "who-calledme",
  "whocalledme", "phone-report", "phonereport",
  // Social / search engines
  "reddit", "quora", "facebook", "bing", "duckduckgo",
  "180",
]);

// Content-based detection of phone-reporting / forum / discussion sites.
// Even when a site isn't in GENERIC_WEB_HOSTS, its page content often
// reveals that it's a community-reporting platform rather than an official
// business page. This prevents deriving a business identity from a site
// that merely hosts discussions about phone numbers.
const REPORTING_SITE_INDICATORS = /\b(who called|reverse (phone|lookup)|report (this|a) (number|scam|call)|reported by \d|community reports?|user reports?|spam calls?|scam calls?|nuisance calls?|callers? reported|yabb|phpbb|vbulletin|saynoto0870)\b/i;

function looksLikeReportingSite(result: AnyRecord): boolean {
  const text = String([result?.title, result?.snippet, result?.page_content].filter(Boolean).join(" "));
  if (!text || text.length < 20) return false;
  return REPORTING_SITE_INDICATORS.test(text);
}

function candidateFromWebResult(result: AnyRecord) {
  if (result?.verified_exact_number !== true || !result?.url) return null;
  try {
    const url = new URL(result.url);
    const host = url.hostname.toLowerCase();
    const domain = registeredDomain(host);
    if (!domain || GENERIC_WEB_HOSTS.has(domain)) return null;
    // The verified_exact_number check already confirmed the page contains the
    // exact phone number. Combined with a non-directory domain, that's strong
    // enough evidence — the title doesn't also need to contain the domain name
    // (e.g., Microsoft Learn Q&A titles often don't mention "Microsoft").
    const businessName = domain.length <= 4
      ? domain.toUpperCase()
      : domain.charAt(0).toUpperCase() + domain.slice(1);
    return { businessName, url: result.url, host };
  } catch {}
  return null;
}

function officialBusinessMatch(
  callerName: string | null,
  webResults: AnyRecord[],
  llmHintResults: AnyRecord[] = [],
) {
  const words = callerName
    ? normalizeBusinessKey(callerName)
        .split(/\s+/)
        .filter((word) => word.length >= 4)
        .filter((word) => !/^(inc|corp|llc|ltd|limited|company|co|the|group|services|service)$/i.test(word))
    : [];

  if (words.length) {
    // Check verified web results first — only on official (non-directory,
    // non-reporting) domains. A phone-reporting site like called.co.uk must
    // never be treated as the business that owns a number.
    for (const result of webResults) {
      if (result?.verified_exact_number !== true || !result?.url) continue;
      if (looksLikeReportingSite(result)) continue;
      try {
        const host = new URL(result.url).hostname.replace(/^www\./i, "").toLowerCase();
        const domain = registeredDomain(host);
        if (!domain || GENERIC_WEB_HOSTS.has(domain)) continue;
        const hostKey = normalizeBusinessKey(host);
        const matchedWord = words.find((word) => hostKey.includes(word));
        if (matchedWord) return { verified: true, business_name: callerName, url: result.url, host, source: "provider_and_web" };
      } catch {}
    }
    // Also check unverified LLM hint results (e.g., Apple Community discussions
    // page that identifies the business but doesn't contain the exact number)
    for (const result of llmHintResults) {
      if (result?.verified_exact_number === true || !result?.url) continue;
      if (looksLikeReportingSite(result)) continue;
      if ((result.raw as any)?.engine !== "llm_supplementary") continue;
      try {
        const host = new URL(result.url).hostname.replace(/^www\./i, "").toLowerCase();
        const domain = registeredDomain(host);
        if (!domain || GENERIC_WEB_HOSTS.has(domain)) continue;
        const hostKey = normalizeBusinessKey(host);
        const matchedWord = words.find((word) => hostKey.includes(word));
        if (matchedWord) return { verified: true, business_name: callerName, url: result.url, host, source: "llm_web_search" };
      } catch {}
    }
  }

  // No domain-based fallback: a web page containing a phone number does not
  // prove that the page's domain owner operates that number. If no provider
  // or LLM business name can be verified against an official domain, the
  // business identity is UNKNOWN. Risk is evaluated separately from
  // available reputation evidence.
  return { verified: false, business_name: callerName || null, url: null, host: null, source: null };
}

function extractScamCallCheck(data: AnyRecord) {
  const reports = arr(data?.community?.reports ?? data?.community_reports ?? data?.reports).map((r, i) => normalizeReport(r, "scamcallcheck", i));
  const communityCount = first(
    data?.community?.reportCount,
    data?.communityReportCount,
    data?.community_report_count,
    data?.community_reports?.total,
    reports.length
  );
  const agencyCount = first(
    data?.publicAgencyComplaints?.count,
    data?.agencyComplaintCount,
    data?.agency_complaint_count,
    data?.complaintCount,
    data?.complaint_count
  );
  return {
    found: data?.found ?? data?.exists ?? (Number(communityCount || 0) > 0 || Number(agencyCount || 0) > 0),
    risk_score: first(data?.risk?.score, data?.riskScore, data?.risk_score, data?.score),
    complaint_count: agencyCount ?? 0,
    community_report_count: communityCount ?? 0,
    agency_complaint_count: agencyCount ?? 0,
    risk_level: normalizeText(first(data?.risk?.level, data?.riskLevel, data?.risk_level, data?.verdict)),
    reports,
    canonical_url: normalizeText(first(data?.links?.canonical, data?.links?.detail, data?.url, data?.canonical_url)),
  };
}

function extractUsaCallerLookup(data: AnyRecord) {
  const communityReports = Array.isArray(data?.community_reports)
    ? data.community_reports
    : Array.isArray(data?.community_reports?.reports)
      ? data.community_reports.reports
      : [];
  const reports = communityReports.map((r: AnyRecord, i: number) => normalizeReport(r, "usa_caller_lookup", i));
  const complaints = arr(data?.complaints?.records ?? data?.complaints).map((r, i) => normalizeReport(r, "usa_caller_lookup_ftc", i));
  return {
    location: data?.location ?? null,
    carrier: normalizeText(first(data?.carrier, data?.location?.carrier)),
    caller_name: normalizeText(first(
      data?.caller_name, data?.callerName, data?.name, data?.business_name,
      data?.businessName, data?.organization, data?.organization_name,
      data?.location?.caller_name, data?.location?.business_name
    )),
    toll_free: Boolean(data?.toll_free),
    complaint_count: first(data?.complaints?.total, data?.complaint_count),
    robocall_flag: first(data?.complaints?.robocall_flag, data?.robocall_flag),
    first_reported: normalizeText(first(data?.complaints?.first_reported, data?.first_reported)),
    last_reported: normalizeText(first(data?.complaints?.last_reported, data?.last_reported)),
    top_subjects: data?.complaints?.top_subjects ?? [],
    community_reports: reports,
    agency_reports: complaints,
    attribution_url: normalizeText(first(data?.attribution?.url, data?.url)),
  };
}

function uniqueReports(reports: any[]) {
  const seen = new Set<string>();
  return reports.filter((r) => {
    const key = [
      r.source, r.id, r.url, r.category,
      r.text?.slice(0, 180)
    ].join("|").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const phoneSources = body?.phone_sources ?? body?.sources;
    if (!phoneSources || typeof phoneSources !== "object") {
      return Response.json({ error: "phone_sources is required" }, { status: 400 });
    }

    // Handle emergency/government short codes — return a safe verdict immediately
    const emergencyInfo = isEmergencySource(phoneSources);
    if (emergencyInfo) {
      return Response.json({
        normalized_number: normalizeText(first(phoneSources.normalized_number, body?.normalized_number, body?.phone)),
        is_emergency_number: true,
        emergency_info: emergencyInfo,
        evidence_version: "1.0",
        source_status: {
          numbers_online: "not_applicable",
          scamcallcheck: "not_applicable",
          usa_caller_lookup: "not_applicable",
        },
        identity_facts: {
          valid: true,
          country: emergencyInfo.countries?.[0] || null,
          country_code: null,
          carrier: null,
          line_type: "emergency",
          caller_name: emergencyInfo.service,
          caller_name_source: "emergency_database",
          verified_business: true,
          business_verification_url: null,
          business_verification_host: null,
          usa_location: null,
          toll_free: null,
        },
        reputation_signals: {
          numbers_online_spam_signal: null,
          numbers_online_source_risk_level: null,
          scamcallcheck_risk_score: null,
          scamcallcheck_risk_level: null,
          us_ftc_complaint_count: null,
          us_robocall_flag: null,
        },
        counts: {
          complaint_count: 0,
          community_report_count: 0,
          external_report_count: 0,
          reddit_db_report_count: 0,
          exact_evidence_count: 0,
          web_result_count: 0,
          verified_web_result_count: 0,
          page_verified_web_result_count: 0,
          raw_search_result_count: 0,
          page_checked_count: 0,
          search_query_count: 0,
          search_engine_diagnostics: null,
          verification_failure_count: 0,
        },
        reports: [],
        external_reports: [],
        web_search: { searched: false, result_count: 0, verified_result_count: 0, results_require_exact_number_verification: true, queries: [] },
        sources: [],
        provider_errors: [],
        evidence_state: "emergency_number",
        web_evidence_state: "not_searched",
        safety_note: "This is a known emergency or government service number. No web evidence search is needed.",
      });
    }

    const normalizedNumber = normalizeText(first(
      phoneSources.normalized_number, body?.normalized_number, body?.phone
    ));

    const no = phoneSources.sources?.numbers_online?.data;
    const scc = phoneSources.sources?.scamcallcheck?.data;
    const ucl = phoneSources.sources?.usa_caller_lookup?.data;
    const web = body?.web_evidence ?? {};

    const numbersOnline = no ? extractNumbersOnline(no) : null;
    const scamCallCheck = scc ? extractScamCallCheck(scc) : null;
    const usaCallerLookup = ucl ? extractUsaCallerLookup(ucl) : null;

    const webResults = Array.isArray(web?.results) ? web.results.map((r: AnyRecord, i: number) => ({
      source: "web_search",
      id: `web-${i + 1}`,
      category: null,
      text: normalizeText([r.title, r.snippet, r.page_content].filter(Boolean).join(" — ")),
      title: normalizeText(r.title),
      snippet: normalizeText(r.snippet),
      page_content: normalizeText(r.page_content),
      date: null,
      url: normalizeText(r.url),
      exact_match_required: true,
      verified_exact_number: r.verified_exact_number === true,
      verification_method: r.verification_method ?? null,
      verification_status: r.verification_status ?? null,
      is_community_report: r.is_community_report === true,
      raw: r,
    })) : [];

    // External community reports: third-party public phone-reporting sites
    // (tellows, who-called, truecaller, etc.) that have verified the exact
    // number. These are NOT Vardin user submissions — they are independent
    // reputation evidence from public community-reporting platforms.
    const externalReports = webResults
      .filter((r) => r.is_community_report && r.verified_exact_number)
      .map((r, i) => ({
        source: "external_community",
        id: `ext-${i + 1}`,
        category: null,
        text: r.page_content || r.text,
        url: r.url,
        verified_exact_number: true,
        is_community_report: true,
        raw: r.raw,
      }));

    let redditDbReports: AnyRecord[] = [];
    if (normalizedNumber) {
      try {
        const redditRows = await base44.asServiceRole.entities.RedditScamNumber.filter(
          { normalized_number: normalizedNumber },
          "-posted_at",
          50
        );
        redditDbReports = (Array.isArray(redditRows) ? redditRows : []).map((row: AnyRecord, index: number) => ({
          source: "reddit_db",
          id: normalizeText(first(row.post_id, row.id)) || `reddit-db-${index + 1}`,
          category: normalizeText(row.scam_category),
          text: normalizeText(first(row.summary, row.title)),
          date: normalizeText(row.posted_at),
          url: normalizeText(row.post_url),
          verified_exact_number: true,
          verification_status: "verified",
          raw: row,
        }));
      } catch {}
    }

    const reports = uniqueReports([
      ...(scamCallCheck?.reports ?? []),
      ...(usaCallerLookup?.community_reports ?? []),
      ...(usaCallerLookup?.agency_reports ?? []),
      ...redditDbReports,
      ...webResults,
    ]);

    const complaintCount = Math.max(
      Number(scamCallCheck?.complaint_count) || 0,
      Number(usaCallerLookup?.complaint_count) || 0,
    );

    const communityReportCount = Math.max(
      Number(scamCallCheck?.community_report_count) || 0,
      Number(usaCallerLookup?.community_reports?.length) || 0,
      redditDbReports.length,
    );

    const exactEvidenceCount = reports.filter((r) => {
      if (r.source === "web_search") return r.verified_exact_number === true;
      return Boolean(r.text || r.url || r.raw || r.category);
    }).length;

    const brandFromTitles = extractBrandFromTitles(webResults);
    const businessCandidates = [
      numbersOnline?.caller_name,
      usaCallerLookup?.caller_name,
      // Brand name extracted from verified directory page titles (e.g., "Beatsサポート")
      brandFromTitles,
      // LLM supplementary search may provide a business_name_hint for verified results
      ...webResults
        .filter((r) => r.verified_exact_number && (r.raw as any)?.business_name_hint)
        .map((r) => (r.raw as any).business_name_hint),
      // Also use business_name_hint from unverified LLM results when the URL
      // is from a legitimate (non-directory) domain. The LLM has web search
      // context and can identify the business even if the specific page it
      // found doesn't contain the exact phone number (e.g., an Apple Community
      // discussions page about calling Apple Australia).
      ...webResults
        .filter((r) => !r.verified_exact_number && (r.raw as any)?.business_name_hint && (r.raw as any)?.engine === "llm_supplementary")
        .filter((r) => {
          // Accept LLM hint results with no URL (synthetic result where the LLM
          // identified the business but couldn't find the official page).
          if (!r.url) return true;
          try {
            const host = new URL(r.url).hostname.toLowerCase();
            const domain = registeredDomain(host);
            return domain && !GENERIC_WEB_HOSTS.has(domain);
          } catch { return false; }
        })
        .map((r) => (r.raw as any).business_name_hint),
    ].filter((value, index, list) => {
      if (!Boolean(value) || list.indexOf(value) !== index) return false;
      // Filter out business names that are obviously from phone-reporting
      // sites (e.g., "Called" from called.co.uk, "Tellows" from tellows.de).
      // A reporting-site name is not a business identity.
      const key = normalizeBusinessKey(value);
      return !GENERIC_WEB_HOSTS.has(key);
    });

    const businessMatch = officialBusinessMatch(businessCandidates[0] ?? null, webResults, webResults);
    const resolvedBusinessName = businessMatch.business_name || businessCandidates[0] || null;

    // Determine if the business was verified on an official domain (not a
    // community-reporting site). This distinction is critical for scoring:
    // a business verified on apple.com is genuinely legitimate, while a
    // "business" identified from whos-called.co.uk is actually a scam-reporting
    // site being misidentified as the business owner.
    let isOfficiallyVerified = false;
    if (businessMatch.verified && businessMatch.url) {
      try {
        const host = new URL(businessMatch.url).hostname.toLowerCase();
        const domain = registeredDomain(host);
        isOfficiallyVerified = Boolean(domain) && !GENERIC_WEB_HOSTS.has(domain);
      } catch {}
    }

    const providerErrors = Array.isArray(phoneSources.source_errors)
      ? phoneSources.source_errors
      : [];

    return Response.json({
      normalized_number: normalizedNumber,
      evidence_version: "1.0",
      source_status: {
        numbers_online: phoneSources.sources?.numbers_online?.status ?? "not_run",
        scamcallcheck: phoneSources.sources?.scamcallcheck?.status ?? "not_run",
        usa_caller_lookup: phoneSources.sources?.usa_caller_lookup?.status ?? "not_run",
      },
      identity_facts: {
        valid: numbersOnline?.valid ?? null,
        country: numbersOnline?.country ?? null,
        country_code: numbersOnline?.country_code ?? null,
        carrier: numbersOnline?.carrier ?? usaCallerLookup?.carrier ?? null,
        line_type: numbersOnline?.line_type ?? null,
        caller_name: resolvedBusinessName,
        caller_name_source: businessMatch.source
          || (businessCandidates[0]
            ? (numbersOnline?.caller_name === businessCandidates[0] ? "numbers_online" : "usa_caller_lookup")
            : null),
        verified_business: businessMatch.verified,
        is_officially_verified: isOfficiallyVerified,
        business_verification_url: businessMatch.url,
        business_verification_host: businessMatch.host,
        usa_location: usaCallerLookup?.location ?? null,
        toll_free: usaCallerLookup?.toll_free ?? null,
      },
      reputation_signals: {
        numbers_online_spam_signal: numbersOnline?.spam_signal ?? null,
        numbers_online_source_risk_level: numbersOnline?.source_risk_level ?? null,
        scamcallcheck_risk_score: scamCallCheck?.risk_score ?? null,
        scamcallcheck_risk_level: scamCallCheck?.risk_level ?? null,
        us_ftc_complaint_count: usaCallerLookup?.complaint_count ?? null,
        us_robocall_flag: usaCallerLookup?.robocall_flag ?? null,
      },
      counts: {
        complaint_count: complaintCount,
        community_report_count: communityReportCount,
        external_report_count: externalReports.length,
        reddit_db_report_count: redditDbReports.length,
        exact_evidence_count: exactEvidenceCount,
        web_result_count: webResults.length,
        verified_web_result_count: webResults.filter((r) => r.verified_exact_number).length,
        page_verified_web_result_count: webResults.filter((r) => r.verified_exact_number && r.verification_method === "page").length,
        raw_search_result_count: Number(web?.raw_search_result_count || 0),
        page_checked_count: Number(web?.page_checked_count || webResults.length),
        search_query_count: Number(web?.search_query_count || (Array.isArray(web?.searches) ? web.searches.length : 0)),
        search_engine_diagnostics: web?.search_engine_diagnostics || null,
        verification_failure_count: Number(web?.verification_failure_count || 0),
      },
      reports,
      external_reports: externalReports,
      web_search: {
        searched: Boolean(web?.results),
        result_count: webResults.length,
        verified_result_count: webResults.filter((r) => r.verified_exact_number).length,
        page_verified_result_count: webResults.filter((r) => r.verified_exact_number && r.verification_method === "page").length,
        search_result_verified_count: webResults.filter((r) => r.verified_exact_number && r.verification_method === "search_result").length,
        raw_search_result_count: Number(web?.raw_search_result_count || 0),
        page_checked_count: Number(web?.page_checked_count || webResults.length),
        search_query_count: Number(web?.search_query_count || (Array.isArray(web?.searches) ? web.searches.length : 0)),
        search_engine_diagnostics: web?.search_engine_diagnostics || null,
        verification_failure_count: Number(web?.verification_failure_count || 0),
        results_require_exact_number_verification: true,
        queries: Array.isArray(web?.searches) ? web.searches : [],
      },
      sources: [
        phoneSources.sources?.numbers_online?.source_url,
        scamCallCheck?.canonical_url,
        usaCallerLookup?.attribution_url,
        ...redditDbReports.map((r) => r.url).filter(Boolean).slice(0, 10),
        ...webResults.filter((r) => r.verified_exact_number).map((r) => r.url).filter(Boolean).slice(0, 10),
      ].filter(Boolean),
      provider_errors: providerErrors,
      evidence_state: exactEvidenceCount > 0 || complaintCount > 0
        ? "evidence_found"
        : "insufficient_evidence",
      web_evidence_state: webResults.some((r) => r.verified_exact_number)
        ? "verified_evidence_found"
        : webResults.length > 0
          ? "discovered_unverified"
          : "no_web_results",
      safety_note: "Provider signals and complaints are evidence about reported behaviour, not proof of identity or wrongdoing. No-evidence results must not be treated as proof of safety.",
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || "Evidence normalization failed" }, { status: 500 });
  }
});