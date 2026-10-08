import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

type AnyRecord = Record<string, any>;

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

function officialBusinessMatch(callerName: string | null, webResults: AnyRecord[]) {
  if (!callerName) return { verified: false, url: null, host: null };
  const words = normalizeBusinessKey(callerName)
    .split(/\s+/)
    .filter((word) => word.length >= 4)
    .filter((word) => !/^(inc|corp|llc|ltd|limited|company|co|the|group|services|service)$/i.test(word));

  if (!words.length) return { verified: false, url: null, host: null };

  for (const result of webResults) {
    if (result?.verified_exact_number !== true || !result?.url) continue;
    try {
      const host = new URL(result.url).hostname.replace(/^www\./i, "").toLowerCase();
      const hostKey = normalizeBusinessKey(host);
      const matchedWord = words.find((word) => hostKey.includes(word));
      if (matchedWord) return { verified: true, url: result.url, host };
    } catch {}
  }

  return { verified: false, url: null, host: null };
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
      text: normalizeText(r.title),
      date: null,
      url: normalizeText(r.url),
      exact_match_required: true,
      verified_exact_number: r.verified_exact_number === true,
      verification_status: r.verification_status ?? null,
      raw: r,
    })) : [];

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

    const exactEvidenceCount = reports.filter((r) =>
      r.source !== "web_search" ? Boolean(r.text || r.url) : r.verified_exact_number === true
    ).length;

    const businessCandidates = [
      numbersOnline?.caller_name,
      usaCallerLookup?.caller_name,
    ].filter((value, index, list) => Boolean(value) && list.indexOf(value) === index);

    const businessMatch = officialBusinessMatch(businessCandidates[0] ?? null, webResults);

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
        caller_name: businessCandidates[0] ?? null,
        caller_name_source: businessCandidates[0]
          ? (numbersOnline?.caller_name === businessCandidates[0] ? "numbers_online" : "usa_caller_lookup")
          : null,
        verified_business: businessMatch.verified,
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
        reddit_db_report_count: redditDbReports.length,
        exact_evidence_count: exactEvidenceCount,
        web_result_count: webResults.length,
        verified_web_result_count: webResults.filter((r) => r.verified_exact_number).length,
      },
      reports,
      web_search: {
        searched: Boolean(web?.results),
        result_count: webResults.length,
        verified_result_count: webResults.filter((r) => r.verified_exact_number).length,
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
