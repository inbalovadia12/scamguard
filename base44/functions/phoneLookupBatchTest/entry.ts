import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

type Expected = {
  number: string;
  country?: string;
  business?: string;
  status?: 'SCAM' | 'SPAM' | 'SUSPICIOUS' | 'SAFE' | 'UNKNOWN';
};

const DEFAULT_CASES: Expected[] = [
  { number: '+1 800 692 7753', country: 'United States', business: 'Apple', status: 'SAFE' },
  { number: '+44 800 048 0408', country: 'United Kingdom', business: 'Embargo Lifestyle Limited', status: 'SAFE' },
  { number: '+1 800 642 7676', country: 'United States', business: 'Microsoft', status: 'SAFE' },
  { number: '+44 800 026 0329', country: 'United Kingdom', status: 'UNKNOWN' },
  { number: '+1 800 442 4000', country: 'United States', business: 'Beats by Apple', status: 'SAFE' },
  { number: '+44 12 5630 6995', country: 'United Kingdom', status: 'SCAM' },
  { number: '+44 77 0017 8674', country: 'United Kingdom', status: 'SCAM' },
  { number: '+81 120 435 500', country: 'Japan', status: 'UNKNOWN' },
  { number: '+61 1 300 365 083', country: 'Australia' },
  { number: '+971 8000 444 1849', country: 'United Arab Emirates' },
  { number: '+90 850 390 2777', country: 'Turkey' },
  { number: '+27 800 167 344', country: 'South Africa' },
];

function digits(value: unknown) {
  return String(value || '').replace(/\D/g, '');
}

function scoreCase(expected: Expected, actual: any) {
  const failures: string[] = [];
  if (expected.country && !String(actual.country || '').toLowerCase().includes(expected.country.toLowerCase())) {
    failures.push(`country expected ${expected.country}, got ${actual.country || 'empty'}`);
  }
  if (expected.business && !String(actual.business_name || '').toLowerCase().includes(expected.business.toLowerCase())) {
    failures.push(`business expected ${expected.business}, got ${actual.business_name || 'empty'}`);
  }
  if (expected.status && actual.caller_id_status !== expected.status) {
    failures.push(`status expected ${expected.status}, got ${actual.caller_id_status || 'empty'}`);
  }
  const returnedDigits = digits(actual.phone_number || actual.normalized_number);
  const expectedDigits = digits(expected.number);
  if (returnedDigits && !returnedDigits.endsWith(expectedDigits)) {
    failures.push(`number mismatch: returned ${actual.phone_number || actual.normalized_number}`);
  }
  const score = Number(actual.reputation_score);
  if (!Number.isFinite(score) || score < 0 || score > 100) failures.push(`invalid risk score ${actual.reputation_score}`);
  return failures;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const cases: Expected[] = Array.isArray(body.cases) && body.cases.length
      ? body.cases.slice(0, 25)
      : DEFAULT_CASES;

    const results = [];
    for (const testCase of cases) {
      const started = Date.now();
      try {
        const response = await base44.functions.invoke('lookupPhoneNumber', {
          phone_number: testCase.number,
          country_hint: testCase.country || '',
          language: 'en',
        });
        // Base44 function invocation returns an envelope; lookupPhoneNumber
        // puts the actual lookup under data.result.
        const payload = response?.data ?? response;
        const result = payload?.result ?? payload;
        const lookup = payload?.lookup;
        if (!result || typeof result !== 'object') {
          throw new Error('lookupPhoneNumber returned no result payload');
        }
        const failures = scoreCase(testCase, result);
        results.push({
          number: testCase.number,
          ok: failures.length === 0,
          failures,
          elapsed_ms: Date.now() - started,
          actual: {
            phone_number: lookup?.phone_number || result.phone_number || result.normalized_number || '',
            country: result.country,
            business_name: result.business_name,
            caller_id_status: result.caller_id_status,
            reputation_score: result.reputation_score,
            risk_level: result.risk_level,
            confidence_score: result.confidence_score,
            verified_business: result.verified_business,
            report_count: result.report_count,
            scam_report_count: result.scam_report_count,
            spam_report_count: result.spam_report_count,
            suspicious_report_count: result.suspicious_report_count,
            safe_report_count: result.safe_report_count,
          },
        });
      } catch (error) {
        results.push({
          number: testCase.number,
          ok: false,
          failures: [error instanceof Error ? error.message : String(error)],
          elapsed_ms: Date.now() - started,
        });
      }
    }

    const passed = results.filter((r) => r.ok).length;
    return Response.json({
      success: true,
      total: results.length,
      passed,
      failed: results.length - passed,
      pass_rate: results.length ? Math.round((passed / results.length) * 100) : 0,
      results,
      note: 'Admin-only live regression harness. It invokes the production lookup function and therefore uses normal lookup credits.',
    });
  } catch (error) {
    console.error('phoneLookupBatchTest error', error);
    return Response.json({ error: error instanceof Error ? error.message : 'Phone lookup batch test failed' }, { status: 500 });
  }
});
