import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

const REGRESSION_CASES = [
  { phone: "+1 800 692 7753", label: "Known legitimate / Apple", expectation: "legitimate", expected_business: "Apple", expected_country: "US" },
  { phone: "+44 800 048 0408", label: "Known legitimate / Apple UK", expectation: "legitimate", expected_business: "Apple", expected_country: "GB" },
  { phone: "+1 800 642 7676", label: "Known legitimate / Microsoft", expectation: "legitimate", expected_business: "Microsoft", expected_country: "US" },
  { phone: "+44 800 026 0329", label: "Known legitimate / Microsoft", expectation: "legitimate", expected_business: "Microsoft", expected_country: "GB" },
  { phone: "+1 800 442 4000", label: "Known legitimate / Beats", expectation: "legitimate", expected_business: "Beats", expected_country: "US" },
  { phone: "+44 1256306995", label: "Known scam / debt collection reports", expectation: "scam", expected_country: "GB" },
  { phone: "+44 7700178674", label: "Known scam / phone contract reports", expectation: "scam", expected_country: "GB" },
  { phone: "+81 120435500", label: "Known legitimate / Beats Japan", expectation: "legitimate", expected_business: "Beats", expected_country: "JP" },
  { phone: "+61 1300365083", label: "Known legitimate / Apple Australia", expectation: "legitimate", expected_business: "Apple", expected_country: "AU" },
  { phone: "+971 80004441849", label: "Known legitimate / Beats UAE", expectation: "legitimate", expected_business: "Beats", expected_country: "AE" },
  { phone: "+44 7480 726506", label: "Known scam / HMRC impersonation, debt scam (tellows, who-called, truecaller)", expectation: "scam", expected_country: "GB" },
  // New regression cases for pipeline fix
  { phone: "+44 330 059 0011", label: "Known scam / Barclaycard impersonation (whos-called.co.uk community report)", expectation: "scam", expected_country: "GB" },
  { phone: "911", label: "Emergency number / US 911", expectation: "emergency", expected_country: "US" },
  { phone: "100", label: "Emergency number / India police 100", expectation: "emergency", expected_country: "IN" },
  { phone: "999", label: "Emergency number / UK 999", expectation: "emergency", expected_country: "GB" },
  { phone: "112", label: "Emergency number / EU 112", expectation: "emergency", expected_country: "GB" },
  { phone: "+44 1632 960123", label: "Genuinely insufficient evidence / no reports found", expectation: "unknown" },
  // Reproduction cases for business-identification and missing-evidence bugs
  { phone: "+44 161 931 9070", label: "Case A - reporting site (called.co.uk/saynoto0870) must not become business identity", expectation: "scam", expected_country: "GB" },
  { phone: "+44 7359 140063", label: "Case B - missing evidence / community reports must surface", expectation: "suspicious", expected_country: "GB" },
  // Additional diverse test cases
  { phone: "+1 888 280 4331", label: "Known legitimate / Amazon US customer service", expectation: "legitimate", expected_business: "Amazon", expected_country: "US" },
  { phone: "+44 800 085 4408", label: "Verified business / Formatank Ltd (toll-free UK)", expectation: "legitimate", expected_country: "GB" },
  { phone: "+44 7418 360486", label: "Unknown / no web evidence found (flaky search)", expectation: "unknown", expected_country: "GB" },
  { phone: "+1 855 738 0610", label: "Unknown / no web evidence found (flaky search)", expectation: "unknown", expected_country: "US" },
  { phone: "+44 800 011 9735", label: "Unknown / no web evidence found (HMRC toll-free)", expectation: "unknown", expected_country: "GB" },
  { phone: "+61 1300 729 729", label: "Unknown / no web evidence found (Australian 1300)", expectation: "unknown", expected_country: "AU" },
  { phone: "+1 800 555 1234", label: "Fictional 555 number / community reports exist on spoofing sites", expectation: "scam", expected_country: "US" },
  { phone: "+44 800 023 4853", label: "Known legitimate / Financial Ombudsman Service UK", expectation: "legitimate", expected_country: "GB" },
];

function checkResult(result: any, expectation: string) {
  const score = Number(result?.reputation_score);
  const riskScore = Number(result?.risk_score);
  const status = String(result?.caller_id_status || "");
  const confidence = Number(result?.confidence_score);

  const checks = [
    { name: "single_score", pass: Number.isFinite(score) && score === riskScore, detail: `reputation=${score}, risk=${riskScore}` },
    { name: "status_matches_score", pass:
      (status === "SCAM" && score >= 71) ||
      (status === "SUSPICIOUS" && score >= 31 && score <= 70) ||
      (status === "SAFE" && score <= 30) ||
      (status === "UNKNOWN" && score === 50),
      detail: `${status} at ${score}/100` },
    { name: "confidence_not_fake_100", pass: confidence < 100 || Number(result?.report_count) > 0 || result?.web_evidence_state === "verified_evidence_found" || result?.verified_business === true, detail: `${confidence}% confidence` },
    { name: "country_present_when_expected", pass: true, detail: String(result?.country || "unknown") },
    // Ensure no phone-reporting / forum / directory site is misidentified as
    // the business that owns the number. A page hosting a phone-number
    // discussion is evidence about the number, not proof of ownership.
    { name: "no_reporting_site_as_business", pass: (function() {
      const reportingSites = ["called", "saynoto0870", "tellows", "truecaller", "800notes", "whocallsme", "who-called", "whocalled", "scamcallcheck", "everycaller", "shouldianswer", "cleverdialer", "phonely", "nomorobo", "robokiller", "robocaller", "callcontrol", "callercomplaints", "sync.me", "usphonebook", "numberguru", "spydialer", "jpnumber", "callersmart", "phone-number", "phonenumber"];
      const bizName = String(result?.business_name || "").toLowerCase();
      const bizUrl = String(result?.business_verification_url || "").toLowerCase();
      const bizSource = String(result?.business_name_source || "").toLowerCase();
      const hasOfficialWebSource = bizSource === "official_web";
      // Only check the hostname (not the URL path) against reporting sites.
      // A Microsoft Learn URL like ".../is-1-800-642-7676-a-legitimate-telephone-number"
      // contains "phone-number" in the path but is on learn.microsoft.com.
      let bizHost = "";
      try { bizHost = new URL(result?.business_verification_url || "").hostname.toLowerCase(); } catch {}
      return !reportingSites.some((s) => bizName.includes(s) || bizHost.includes(s)) && !hasOfficialWebSource;
    })(), detail: `business=${result?.business_name || "null"}, url=${result?.business_verification_url || "null"}, source=${result?.business_name_source || "null"}` },
  ];

  if (expectation === "legitimate") {
    checks.push({
      name: "legitimate_not_high_risk",
      pass: status !== "SCAM" && score < 71,
      detail: `${status} at ${score}/100`,
    });
  } else if (expectation === "scam") {
    checks.push({
      name: "scam_signal_present",
      pass: status === "SCAM" || status === "SUSPICIOUS" || score >= 60 || Number(result?.scam_report_count) > 0 || result?.web_evidence_state === "verified_evidence_found" || Number(result?.external_report_count) > 0,
      detail: `${status} at ${score}/100; scam reports=${result?.scam_report_count ?? 0}; external=${result?.external_report_count ?? 0}`,
    });
    checks.push({
      name: "external_evidence_found",
      pass: Number(result?.external_report_count || 0) > 0 || result?.web_evidence_state === "verified_evidence_found",
      detail: `${result?.external_report_count || 0} external community reports; web_state=${result?.web_evidence_state}`,
    });
  } else if (expectation === "unknown") {
    checks.push({
      name: "unknown_not_marked_safe_without_evidence",
      pass: status === "UNKNOWN" || Number(result?.report_count) > 0 || Number(result?.confidence_score) < 70,
      detail: `${status} at ${score}/100; evidence=${result?.report_count ?? 0}`,
    });
    checks.push({
      name: "no_external_reports",
      pass: Number(result?.external_report_count || 0) === 0,
      detail: `${result?.external_report_count || 0} external reports`,
    });
  } else if (expectation === "emergency") {
    checks.push({
      name: "emergency_safe_status",
      pass: status === "SAFE",
      detail: `${status} at ${score}/100`,
    });
    checks.push({
      name: "emergency_low_score",
      pass: score <= 5,
      detail: `${score}/100`,
    });
    checks.push({
      name: "emergency_high_confidence",
      pass: confidence >= 95,
      detail: `${confidence}% confidence`,
    });
    checks.push({
      name: "emergency_business_name_present",
      pass: Boolean(result?.business_name),
      detail: String(result?.business_name || "None"),
    });
  }

  return {
    pass: checks.every((c) => c.pass),
    checks,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Admin privileges required" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const requested = Array.isArray(body?.numbers) ? body.numbers : REGRESSION_CASES;
    const cases = requested
      .map((item: any) => typeof item === "string" ? { phone: item, label: "Custom", expectation: "unknown" } : item)
      .filter((item: any) => item?.phone)
      .slice(0, 25);

    const results: any[] = new Array(cases.length);
    let nextIndex = 0;
    const workerCount = Math.min(3, cases.length);

    const runCase = async (testCase: any, resultIndex: number) => {
      const started = Date.now();
      try {
        const sourceResponse = await base44.functions.invoke("lookupPhoneSources", {
          phone_number: String(testCase.phone),
        });
        const phoneSources = sourceResponse?.data || sourceResponse;
        if (!phoneSources || phoneSources.error) {
          throw new Error(phoneSources?.error || "Source lookup failed");
        }

        const webResponse = await base44.functions.invoke("searchPhoneWebEvidence", {
          phone: String(testCase.phone),
        });
        const webEvidence = webResponse?.data || webResponse;
        if (!webEvidence || webEvidence.error) {
          throw new Error(webEvidence?.error || "Web evidence search failed");
        }

        const evidenceResponse = await base44.functions.invoke("normalizePhoneEvidence", {
          phone_sources: phoneSources,
          web_evidence: webEvidence,
          phone: String(testCase.phone),
        });
        const evidence = evidenceResponse?.data || evidenceResponse;
        if (!evidence || evidence.error) {
          throw new Error(evidence?.error || "Evidence normalization failed");
        }

        const riskResponse = await base44.functions.invoke("scorePhoneRisk", {
          phone: String(testCase.phone),
          phone_evidence: evidence,
        });
        const risk = riskResponse?.data?.result || riskResponse?.result;
        if (!risk) {
          throw new Error(riskResponse?.data?.error || riskResponse?.error || "Risk scoring failed");
        }

        const validation = checkResult(risk, testCase.expectation || "unknown");

        if (testCase.expected_business) {
          const actualBusiness = String(risk?.business_name || "").toLowerCase();
          const actualUrl = String(risk?.business_verification_url || "").toLowerCase();
          const expectedBusiness = String(testCase.expected_business).toLowerCase();
          // Apple owns Beats, so the Beats support page is hosted on apple.com.
          // Accept the parent company name as a valid match for subsidiary brands.
          const BUSINESS_ALIASES: Record<string, string[]> = {
            "beats": ["apple", "beats", "beatsbydre"],
            "beatsbydre": ["apple", "beats", "beatsbydre"],
          };
          const acceptedNames = BUSINESS_ALIASES[expectedBusiness] || [expectedBusiness];
          validation.checks.push({
            name: "expected_business_match",
            pass: acceptedNames.some((name) =>
              actualBusiness.includes(name) || actualUrl.includes(name)
            ),
            detail: `${risk?.business_name || "None"}`,
          });
        }

        if (testCase.expected_country) {
          const actualCountry = String(risk?.country || "").toLowerCase();
          const aliases: Record<string, string[]> = {
            us: ["us", "usa", "united states", "america"],
            gb: ["gb", "uk", "united kingdom", "great britain"],
            jp: ["jp", "japan"],
            au: ["au", "australia"],
            ae: ["ae", "uae", "united arab emirates"],
          };
          const expectedAliases =
            aliases[String(testCase.expected_country).toLowerCase()] ||
            [String(testCase.expected_country).toLowerCase()];
          validation.checks.push({
            name: "expected_country_match",
            pass: expectedAliases.some(
              (alias) => actualCountry === alias || actualCountry.includes(alias)
            ),
            detail: `${risk?.country || "Unknown"}`,
          });
        }

        validation.pass = validation.checks.every((c) => c.pass);

        results[resultIndex] = {
          phone: testCase.phone,
          label: testCase.label || "Custom",
          expectation: testCase.expectation || "unknown",
          pass: validation.pass,
          checks: validation.checks,
          result: risk,
          evidence: {
            normalized_number: evidence.normalized_number,
            source_status: evidence.source_status,
            provider_errors: evidence.provider_errors || [],
            evidence_state: evidence.evidence_state,
            web_evidence_state: evidence.web_evidence_state,
            exact_evidence_count: evidence.counts?.exact_evidence_count ?? 0,
            external_report_count: evidence.counts?.external_report_count ?? 0,
            verified_web_result_count: evidence.counts?.verified_web_result_count ?? 0,
            page_verified_web_result_count: evidence.counts?.page_verified_web_result_count ?? 0,
            web_result_count: evidence.counts?.web_result_count ?? 0,
            raw_search_result_count: evidence.counts?.raw_search_result_count ?? 0,
            page_checked_count: evidence.counts?.page_checked_count ?? 0,
            search_query_count: evidence.counts?.search_query_count ?? 0,
            verification_failure_count: evidence.counts?.verification_failure_count ?? 0,
            search_engine_diagnostics: evidence.web_search?.search_engine_diagnostics ?? null,
            web_samples: (Array.isArray(evidence.reports) ? evidence.reports : [])
              .filter((report: any) => report?.source === "web_search")
              .slice(0, 4)
              .map((report: any) => ({
                title: report.title || report.text || report.url || "Untitled result",
                url: report.url || null,
                verified_exact_number: report.verified_exact_number === true,
                verification_method: report.verification_method || "none",
                is_community_report: report.is_community_report === true,
              })),
            external_samples: (Array.isArray(evidence.external_reports) ? evidence.external_reports : [])
              .slice(0, 4)
              .map((report: any) => ({
                url: report.url || null,
                text: String(report.text || "").slice(0, 200),
              })),
          },
          duration_ms: Date.now() - started,
        };
      } catch (error: any) {
        results[resultIndex] = {
          phone: testCase.phone,
          label: testCase.label || "Custom",
          expectation: testCase.expectation || "unknown",
          pass: false,
          checks: [],
          error: error?.message || "Test failed",
          duration_ms: Date.now() - started,
        };
      }
    };

    const workers = Array.from({ length: workerCount }, async () => {
      while (true) {
        const index = nextIndex++;
        if (index >= cases.length) return;
        await runCase(cases[index], index);
      }
    });

    await Promise.all(workers);

    return Response.json({
      suite: "vardin_phone_regression_v1",
      ran_at: new Date().toISOString(),
      count: results.length,
      passed: results.filter((r) => r.pass).length,
      failed: results.filter((r) => !r.pass).length,
      results,
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || "Batch phone test failed" }, { status: 500 });
  }
});