import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

const REGRESSION_CASES = [
  { phone: "+1 800 692 7753", label: "Known legitimate / Apple", expectation: "legitimate" },
  { phone: "+44 800 048 0408", label: "Known legitimate / Embargo Lifestyle", expectation: "legitimate" },
  { phone: "+1 800 642 7676", label: "Known legitimate / Microsoft", expectation: "legitimate" },
  { phone: "+44 800 026 0329", label: "Known legitimate / Microsoft", expectation: "legitimate" },
  { phone: "+1 800 442 4000", label: "Known legitimate / Beats by Apple", expectation: "legitimate" },
  { phone: "+44 1256306995", label: "Known scam regression", expectation: "scam" },
  { phone: "+44 7700178674", label: "Known scam regression", expectation: "scam" },
  { phone: "+81 120435500", label: "Unknown / Japan", expectation: "unknown" },
  { phone: "+61 1300365083", label: "Unknown / Australia", expectation: "unknown" },
  { phone: "+971 80004441849", label: "Unknown / UAE", expectation: "unknown" },
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
    { name: "confidence_not_fake_100", pass: confidence < 100 || Number(result?.report_count) > 0 || result?.web_evidence_state === "verified_evidence_found", detail: `${confidence}% confidence` },
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
      pass: status === "SCAM" || score >= 60 || Number(result?.scam_report_count) > 0 || result?.web_evidence_state === "verified_evidence_found",
      detail: `${status} at ${score}/100; scam reports=${result?.scam_report_count ?? 0}`,
    });
  } else if (expectation === "unknown") {
    checks.push({
      name: "unknown_not_marked_safe_without_evidence",
      pass: status === "UNKNOWN" || Number(result?.report_count) > 0 || Number(result?.confidence_score) < 70,
      detail: `${status} at ${score}/100; evidence=${result?.report_count ?? 0}`,
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

    const results: any[] = [];
    for (const testCase of cases) {
      const started = Date.now();
      try {
        const sourceResponse = await base44.functions.invoke("lookupPhoneSources", { phone_number: String(testCase.phone) });
        const phoneSources = sourceResponse?.data || sourceResponse;
        if (!phoneSources || phoneSources.error) throw new Error(phoneSources?.error || "Source lookup failed");

        const webResponse = await base44.functions.invoke("searchPhoneWebEvidence", { phone: String(testCase.phone) });
        const webEvidence = webResponse?.data || webResponse;
        if (!webEvidence || webEvidence.error) throw new Error(webEvidence?.error || "Web evidence search failed");

        const evidenceResponse = await base44.functions.invoke("normalizePhoneEvidence", {
          phone_sources: phoneSources,
          web_evidence: webEvidence,
          phone: String(testCase.phone),
        });
        const evidence = evidenceResponse?.data || evidenceResponse;
        if (!evidence || evidence.error) throw new Error(evidence?.error || "Evidence normalization failed");

        const riskResponse = await base44.functions.invoke("scorePhoneRisk", {
          phone: String(testCase.phone),
          phone_evidence: evidence,
        });
        const risk = riskResponse?.data?.result || riskResponse?.result;
        if (!risk) throw new Error(riskResponse?.data?.error || riskResponse?.error || "Risk scoring failed");

        const validation = checkResult(risk, testCase.expectation || "unknown");
        results.push({
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
            verified_web_result_count: evidence.counts?.verified_web_result_count ?? 0,
          },
          duration_ms: Date.now() - started,
        });
      } catch (error: any) {
        results.push({
          phone: testCase.phone,
          label: testCase.label || "Custom",
          expectation: testCase.expectation || "unknown",
          pass: false,
          checks: [],
          error: error?.message || "Test failed",
          duration_ms: Date.now() - started,
        });
      }
    }

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
