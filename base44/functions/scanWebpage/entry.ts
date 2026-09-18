import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { getUrlhausReport } from '../../shared/urlhaus.ts';
import { safeFetchText } from '../../shared/ssrf.ts';
import { getAvailableCredits, applyCreditUsage, getMonthlyCreditLimit } from '../../shared/credits.ts';
import { matchKnownLegitimateDomain } from '../../shared/legitimateDomains.ts';
const ANSWER_TYPE_COSTS: Record<string, number> = {
  // Logical + monetizable: quick is the cheap gateway, detailed is the flagship
  // upsell (4x quick). More value always costs more credits.
  quick: 2, risk_score: 3, red_flags: 5, detailed: 8,
};
const SCAN_TYPE_MODIFIERS: Record<string, number> = {
  text: 0, screenshot: 2, both: 2, url: 2,
  email: 0, chat: 0, marketplace: 0, qr: 2, file: 4,
};

async function decodeQrServerSide(imageDataUrl: string): Promise<string> {
  try {
    const base64Data = imageDataUrl.split(',')[1] || '';
    if (!base64Data) return '';
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'image/png' });
    const formData = new FormData();
    formData.append('file', blob, 'qr.png');
    const response = await fetch('https://api.qrserver.com/v1/read-qr-code/', {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return '';
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0 && data[0].symbol && data[0].symbol[0]) {
      return data[0].symbol[0].data || '';
    }
    return '';
  } catch (_e) {
    return '';
  }
}

async function followRedirects(url: string): Promise<{ finalUrl: string; pageTitle: string | null; contentType: string | null }> {
  // Uses the shared SSRF-safe fetch: validates every redirect destination
  // against private/internal IPs (DNS-pinning), caps response size, and
  // applies a timeout. Prevents the QR redirect path from acting as an SSRF
  // proxy.
  try {
    const result = await safeFetchText(url, {
      timeoutMs: 6000,
      maxBytes: 1024 * 1024,
      maxRedirects: 4,
    });
    if (!result.ok) {
      return { finalUrl: url, pageTitle: null, contentType: null };
    }
    const contentType = result.contentType;
    let pageTitle: string | null = null;
    if (contentType && contentType.includes('text/html')) {
      const titleMatch = result.text.match(/<title[^>]*>([^<]*)<\/title>/i);
      if (titleMatch) pageTitle = titleMatch[1].trim();
    }
    return { finalUrl: result.finalUrl, pageTitle, contentType };
  } catch {
    return { finalUrl: url, pageTitle: null, contentType: null };
  }
}

async function getVirusTotalReport(url: string): Promise<any | null> {
  const apiKey = Deno.env.get("VIRUSTOTAL_API_KEY");
  if (!apiKey) return null;

  try {
    const urlBytes = new TextEncoder().encode(url);
    let binary = '';
    for (let i = 0; i < urlBytes.length; i++) binary += String.fromCharCode(urlBytes[i]);
    const base64 = btoa(binary);
    const urlId = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const response = await fetch(`https://www.virustotal.com/api/v3/urls/${urlId}`, {
      headers: { 'x-apikey': apiKey },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const attrs = data?.data?.attributes;
    if (!attrs) return null;

    const stats = attrs.last_analysis_stats || {};
    return {
      malicious: stats.malicious || 0,
      suspicious: stats.suspicious || 0,
      harmless: stats.harmless || 0,
      undetected: stats.undetected || 0,
      total_engines: (stats.malicious || 0) + (stats.suspicious || 0) + (stats.harmless || 0) + (stats.undetected || 0),
      reputation: attrs.reputation || 0,
      categories: attrs.categories || {},
      last_analysis_date: attrs.last_analysis_date || null,
    };
  } catch (_e) {
    return null;
  }
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    let plan = user.subscription_plan || 'starter';
    if (plan === 'free') plan = 'starter';
    if (plan === 'elite') plan = 'premium';
    if (plan !== 'premium' && plan !== 'plus') {
      return Response.json({ error: 'Premium subscription required', upgrade_url: '/pricing' }, { status: 403 });
    }

    const body = await req.json();
    const { page_text, screenshot_data_url, file_data, file_name, page_url, options } = body;

    const scanType = options?.scan_type || 'page';
    const scanMode = options?.scan_mode || 'text';
    const answerType = options?.answer_type || 'detailed';
    const customFocus = typeof options?.custom_focus === 'string' ? options.custom_focus.slice(0, 500) : '';
    const customInstructions = typeof options?.custom_instructions === 'string' ? options.custom_instructions.slice(0, 1000) : '';
    const language = options?.language || 'en';
    const clientDecodedContent = typeof options?.decoded_content === 'string' ? options.decoded_content.slice(0, 2000) : '';

    const LANGUAGE_NAMES: Record<string, string> = { en: 'English', he: 'Hebrew', es: 'Spanish' };
    const languageName = LANGUAGE_NAMES[language] || 'English';

    const answerTypeCost = ANSWER_TYPE_COSTS[answerType] || 8;
    const scanModifier = scanType === 'page' ? (SCAN_TYPE_MODIFIERS[scanMode] || 0) : (SCAN_TYPE_MODIFIERS[scanType] || 0);
    const creditCost = answerTypeCost + scanModifier;

    const available = getAvailableCredits(user);
    if (available.remaining < creditCost) {
      return Response.json({
        error: 'Insufficient credits',
        credits_remaining: available.remaining, credits_limit: getMonthlyCreditLimit(user), credit_cost: creditCost,
        upgrade_url: '/pricing',
      }, { status: 402 });
    }
    const chargeCredits = async () => {
      const usage = applyCreditUsage(user, creditCost);
      if (!usage) throw new Error('Credit balance changed during analysis. Please try again.');
      await base44.auth.updateMe(usage);
      return getAvailableCredits({ ...user, ...usage }).remaining;
    };

    if (scanType === 'page' && scanMode !== 'url') {
      const hasText = page_text && page_text.trim().length > 0;
      const hasScreenshot = screenshot_data_url && screenshot_data_url.length > 0;
      if (!hasText && !hasScreenshot) {
        return Response.json({ error: 'No page content could be extracted. Try a different scan mode or webpage.' }, { status: 400 });
      }
    }
    if ((scanType === 'email' || scanType === 'chat' || scanType === 'marketplace') && (!page_text || !page_text.trim())) {
      return Response.json({ error: 'No content provided for analysis.' }, { status: 400 });
    }
    if ((scanType === 'qr' || scanType === 'screenshot') && (!screenshot_data_url || !screenshot_data_url.length)) {
      return Response.json({ error: 'No image provided for analysis.' }, { status: 400 });
    }
    if (scanType === 'file' && !file_data && !screenshot_data_url) {
      return Response.json({ error: 'No file provided for analysis.' }, { status: 400 });
    }

    // === PARALLEL CHECK: VirusTotal + URLhaus + QR decode (all async) ===
    let vtReport = null;
    let urlhausReport = null;
    let qrDecodedContent = '';
    let qrFinalUrl = '';
    let qrPageTitle = '';

    // VirusTotal + URLhaus only matter for URL-based scans. Running them for
    // screenshot / email / chat / marketplace / page-screenshot scans wastes time,
    // can trigger false "malware" early-exits that ignore the actual content, and
    // risks timing out the whole scan (charging credits for nothing).
    const isUrlScan = scanType === 'url' || (scanType === 'page' && scanMode === 'url');

    // Start all parallel tasks
    const parallelTasks: Promise<any>[] = [];

    if (isUrlScan && page_url) {
      parallelTasks.push(
        getVirusTotalReport(page_url).then(r => { vtReport = r; }),
        getUrlhausReport(page_url).then(r => { urlhausReport = r; })
      );
    }

    if (scanType === 'qr') {
      if (clientDecodedContent) {
        qrDecodedContent = clientDecodedContent;
      } else if (screenshot_data_url) {
        parallelTasks.push(
          decodeQrServerSide(screenshot_data_url).then(r => { qrDecodedContent = r; })
        );
      }
    }

    // Wait for all parallel tasks
    if (parallelTasks.length > 0) {
      await Promise.all(parallelTasks);
    }

    // === QR: Handle redirects after decode ===
    if (scanType === 'qr') {
      if (!qrDecodedContent) {
        return Response.json({
          error: 'Could not decode this QR code. Please try a clearer or higher-resolution image.',
        }, { status: 400 });
      }

      if (qrDecodedContent.startsWith('http://') || qrDecodedContent.startsWith('https://')) {
        const redirectResult = await followRedirects(qrDecodedContent);
        qrFinalUrl = redirectResult.finalUrl;
        qrPageTitle = redirectResult.pageTitle;

        // Check the QR's actual destination (NOT the tab the user is on) against
        // both VirusTotal and URLhaus, in parallel.
        const qrTargetUrl = qrFinalUrl || qrDecodedContent;
        const [qrVt, qrUrlhaus] = await Promise.all([
          getVirusTotalReport(qrTargetUrl),
          getUrlhausReport(qrTargetUrl),
        ]);
        if (qrVt) vtReport = qrVt;
        if (qrUrlhaus) urlhausReport = qrUrlhaus;
      }
    }

    // === EARLY EXIT: If URLhaus says malware, return HIGH RISK immediately ===
    if (urlhausReport?.listed) {
      const creditsRemaining = await chargeCredits();

      return Response.json({
        analysis: {
          risk_level: 'high',
          risk_score: 95,
          confidence: 100,
          is_scam: true,
          scam_category: 'Malware Distribution',
          explanation: `URLhaus database confirms this URL is actively distributing malware: ${urlhausReport.threat || 'malware'}`,
          tactics_detected: ['Malware distribution'],
          red_flags: [
            `Listed in URLhaus malware database`,
            `Threat type: ${urlhausReport.threat || 'malware'}`,
            `Malware payloads found: ${urlhausReport.payload_count || 'unknown'}`,
          ],
          evidence_found: [`URLhaus report: ${urlhausReport.url_status || 'malware distribution site'}`],
          sources_checked: ['URLhaus', 'Vardin'],
          next_steps: ['Do NOT visit this link', 'Do NOT download files from this link', 'Report to URLhaus'],
          what_they_want: 'To infect your device with malware',
          decoded_content: qrDecodedContent,
          final_destination_url: qrFinalUrl,
          destination_title: qrPageTitle,
        },
        scan_type: scanType,
        scan_mode: scanMode,
        answer_type: answerType,
        virustotal: vtReport,
        urlhaus: urlhausReport,
        decoded_content: qrDecodedContent,
        final_destination_url: qrFinalUrl,
        destination_title: qrPageTitle,
        timestamp: new Date().toISOString(),
        credits_used: creditCost,
        credits_remaining: creditsRemaining,
        credits_limit: getMonthlyCreditLimit(user),
        timing_ms: Date.now() - startTime,
      });
    }

    // === EARLY EXIT: If VT shows high malicious count, return HIGH RISK immediately ===
    if (vtReport && vtReport.malicious >= 5) {
      const creditsRemaining = await chargeCredits();

      return Response.json({
        analysis: {
          risk_level: 'high',
          risk_score: 85,
          confidence: 95,
          is_scam: true,
          scam_category: 'Malware / Phishing',
          explanation: `VirusTotal detected ${vtReport.malicious} malware/phishing indicators from ${vtReport.total_engines} security vendors`,
          tactics_detected: ['Malware / Phishing Detection'],
          red_flags: [
            `${vtReport.malicious} vendors detected malware/phishing`,
            `${vtReport.suspicious || 0} vendors flagged as suspicious`,
          ],
          evidence_found: [`VirusTotal: ${vtReport.malicious}/${vtReport.total_engines} security engines detected threats`],
          sources_checked: ['VirusTotal'],
          next_steps: ['Do NOT visit this URL', 'Report to antivirus vendor'],
          what_they_want: 'To infect your device or steal credentials',
          decoded_content: qrDecodedContent,
          final_destination_url: qrFinalUrl,
          destination_title: qrPageTitle,
        },
        scan_type: scanType,
        scan_mode: scanMode,
        answer_type: answerType,
        virustotal: vtReport,
        urlhaus: urlhausReport,
        decoded_content: qrDecodedContent,
        final_destination_url: qrFinalUrl,
        destination_title: qrPageTitle,
        timestamp: new Date().toISOString(),
        credits_used: creditCost,
        credits_remaining: creditsRemaining,
        credits_limit: getMonthlyCreditLimit(user),
        timing_ms: Date.now() - startTime,
      });
    }

    // === KNOWN-LEGITIMATE SHORTCUT ===
    // Famous brands dominate the LLM's web-search context with brand-impersonation
    // scam articles, which biases it toward a generic scam narrative even for the
    // real official domain. When the target is a well-known official domain and
    // both threat-intel feeds are clean, return a safe verdict directly.
    const legitApex = (isUrlScan && page_url) ? matchKnownLegitimateDomain(page_url) : null;
    if (legitApex && !urlhausReport?.listed && (!vtReport || vtReport.malicious === 0)) {
      const brand = legitApex.split('.')[0] || legitApex;
      let safeAnalysis: any;
      if (answerType === 'quick') {
        safeAnalysis = { is_scam: false, verdict: `This is the official ${brand} website — safe.` };
      } else if (answerType === 'risk_score') {
        safeAnalysis = { risk_score: 4, risk_level: 'low', summary: `Official ${brand} website. No threats detected by VirusTotal or URLhaus.` };
      } else {
        safeAnalysis = {
          page_summary: `This is the official ${brand} website (${legitApex}).`,
          risk_level: 'low',
          risk_score: 4,
          confidence: 95,
          is_scam: false,
          scam_category: '',
          overall_risk: 'low',
          explanation: `This is the official ${brand} website. VirusTotal and URLhaus report no malware or phishing. Safe to visit.`,
          tactics_detected: [],
          red_flags: [],
          evidence_found: [],
          sources_checked: ['VirusTotal', 'URLhaus', 'Vardin'],
          next_steps: [],
          what_they_want: '',
        };
      }
      const creditsRemaining = await chargeCredits();
      return Response.json({
        analysis: safeAnalysis,
        scan_type: scanType,
        scan_mode: scanMode,
        answer_type: answerType,
        virustotal: vtReport,
        urlhaus: urlhausReport,
        timestamp: new Date().toISOString(),
        credits_used: creditCost,
        credits_remaining: creditsRemaining,
        credits_limit: getMonthlyCreditLimit(user),
        timing_ms: Date.now() - startTime,
      });
    }

    // === Build LLM prompt (only call if not obviously safe/dangerous) ===
    let prompt = 'You are Vardin, an expert scam and fraud detection AI.\n\n';
    prompt += 'IMPORTANT: Respond entirely in ' + languageName + '. All text must be in ' + languageName + '.\n\n';
    prompt += 'CRITICAL EVIDENCE RULES: Only report scam indicators that are actually present in the supplied URL, page content, redirects, screenshot, QR destination, or threat-intelligence results. Never invent a scam scenario, attacker goal, credential request, payment request, urgency, manipulation tactic, or other evidence. A legitimate official domain is not made suspicious just because scammers sometimes impersonate that brand elsewhere. Only say the page asks for credentials, payment, personal information, or access when the supplied evidence actually shows that request. For benign content, tactics_detected, red_flags, and scam-specific educational fields must be empty. what_they_want must describe what THIS PAGE is actually requesting, not what scammers generally want. what_to_say is only for suspicious/scam situations. If the URL is the official/primary domain of a well-known company (e.g. amazon.com, google.com, paypal.com, microsoft.com, apple.com) and the threat-intel results show no malicious reports, you MUST return risk_level "low", a low risk_score, and leave tactics_detected, red_flags, what_they_want, and scam_category EMPTY. Do NOT produce generic educational content about how scammers impersonate that brand.\n\n';
    if (vtReport) {
      prompt += 'VIRUSTOTAL: ' + vtReport.malicious + ' malicious, ' + vtReport.suspicious + ' suspicious, ' + vtReport.harmless + ' harmless, reputation: ' + vtReport.reputation + '\n\n';
    }

    if (urlhausReport && !urlhausReport.listed) {
      prompt += 'URLHAUS: URL is NOT listed in malware database.\n\n';
    }

    prompt += 'Page URL: ' + (page_url || 'unknown') + '\n\n';

    if (scanType === 'page') {
      if (scanMode === 'text' || scanMode === 'both') {
        prompt += 'Page Content:\n' + (page_text || '').slice(0, 8000) + '\n\n';
      }
      prompt += 'First, set page_summary to a plain-English description of what this page is and what it asks the user to do. Then evaluate whether it is a scam.\n';
      prompt += 'Analyze for: phishing, fake login, payment risks, urgency tactics, fake forms, social engineering.\n';
    } else if (scanType === 'url') {
      prompt += 'Analyze for: phishing, fake login, payment risks, urgency tactics, fake forms, social engineering.\n';
    } else if (scanType === 'email') {
      prompt += 'Email content:\n' + (page_text || '').slice(0, 8000) + '\n\nAnalyze for: sender spoofing, fake invoices, suspicious links, urgency tactics.\n';
    } else if (scanType === 'chat') {
      prompt += 'Chat messages:\n' + (page_text || '').slice(0, 8000) + '\n\nAnalyze for: romance scams, investment scams, tech support scams, verification scams.\n';
    } else if (scanType === 'qr') {
      prompt += 'QR decoded to: ' + qrDecodedContent + '\n';
      if (qrFinalUrl !== qrDecodedContent) prompt += 'Final destination after redirects: ' + qrFinalUrl + '\n';
      if (qrPageTitle) prompt += 'Destination page title: "' + qrPageTitle + '"\n';
      prompt += '\nAnalyze for: phishing, malware, scam risks.\n';
    } else if (scanType === 'screenshot') {
      prompt += 'Analyze the attached screenshot for scam indicators.\n';
    }

    let responseSchema;
    switch (answerType) {
      case 'quick':
        responseSchema = {
          type: 'object',
          properties: {
            is_scam: { type: 'boolean' },
            verdict: { type: 'string' },
          },
          required: ['is_scam', 'verdict'],
        };
        prompt += '\nProvide quick verdict: yes/no and one sentence.';
        break;
      case 'risk_score':
        responseSchema = {
          type: 'object',
          properties: {
            risk_score: { type: 'number', description: '0-100' },
            risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
            summary: { type: 'string' },
          },
          required: ['risk_score', 'risk_level'],
        };
        prompt += '\nProvide risk score only.';
        break;
      default:
        responseSchema = {
          type: 'object',
          properties: {
            page_summary: { type: 'string', description: 'Plain-English description of what this page is and what it asks the user to do' },
            risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
            risk_score: { type: 'number', description: '0-100' },
            confidence: { type: 'number', description: '0-100' },
            is_scam: { type: 'boolean' },
            scam_category: { type: 'string' },
            explanation: { type: 'string' },
            tactics_detected: { type: 'array', items: { type: 'string' } },
            red_flags: { type: 'array', items: { type: 'string' } },
            evidence_found: { type: 'array', items: { type: 'string' } },
            sources_checked: { type: 'array', items: { type: 'string' } },
            next_steps: { type: 'array', items: { type: 'string' } },
            what_they_want: { type: 'string' },
          },
          required: ['risk_level', 'risk_score', 'explanation'],
        };
    }

    // === LLM with TIMEOUT (1.5 seconds) ===
    const useWebSearch = scanType === 'url' || (scanType === 'page' && scanMode === 'url') || scanType === 'qr' || scanType === 'marketplace';
    const llmOptions: any = { 
      prompt, 
      response_json_schema: responseSchema, 
      add_context_from_internet: useWebSearch,
      model: 'gemini_3_flash'
    };

    if ((scanType === 'screenshot' || scanType === 'qr' || (scanType === 'page' && (scanMode === 'screenshot' || scanMode === 'both'))) && screenshot_data_url) {
      try {
        const base64Data = screenshot_data_url.split(',')[1] || '';
        if (base64Data) {
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
          const file = new File([bytes], 'screenshot.jpg', { type: 'image/jpeg' });
          const uploadResult = await base44.integrations.Core.UploadPublicFile({ file });
          if (uploadResult?.file_url) {
            llmOptions.file_urls = [uploadResult.file_url];
          }
        }
      } catch (_e) {}
    }

    if (scanType === 'file' && file_data) {
      try {
        const base64Data = file_data.split(',')[1] || file_data;
        if (base64Data) {
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
          const file = new File([bytes], file_name || 'file', { type: 'application/octet-stream' });
          const uploadResult = await base44.integrations.Core.UploadPublicFile({ file });
          if (uploadResult?.file_url) {
            llmOptions.file_urls = [uploadResult.file_url];
          }
        }
      } catch (_e) {}
    }

    // LLM timeout at 45 seconds (LLM calls need adequate time to return a real verdict)
    const llmPromise = base44.integrations.Core.InvokeLLM(llmOptions);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('LLM timeout')), 45000)
    );

    let result;
    try {
      result = await Promise.race([llmPromise, timeoutPromise]);
    } catch (e) {
      // LLM timed out - return an UNCERTAIN result, never a false "safe"
      result = {
        risk_level: vtReport?.malicious ? 'high' : 'medium',
        risk_score: vtReport?.malicious ? 80 : 50,
        confidence: 35,
        is_scam: !!vtReport?.malicious,
        explanation: 'AI analysis could not complete in time. Treat this result as uncertain — review the VirusTotal / URLhaus reports above before trusting this page.',
      };
    }

    // Prevent low-risk scans from displaying invented scam narratives.
    if (result && result.risk_level === 'low') {
      result.is_scam = false;
      result.tactics_detected = [];
      result.red_flags = [];
      result.scam_category = '';
      result.why_scammers_do_this = '';
      result.what_they_want = '';
      result.what_to_say = '';
    }

    // === Override QR decoded content with verified value ===
    if (scanType === 'qr' && qrDecodedContent) {
      (result as any).decoded_content = qrDecodedContent;
      if (qrFinalUrl) (result as any).final_destination_url = qrFinalUrl;
    }

    const creditsRemaining = await chargeCredits();

    return Response.json({
      analysis: result,
      scan_type: scanType,
      scan_mode: scanMode,
      answer_type: answerType,
      virustotal: vtReport,
      urlhaus: urlhausReport,
      decoded_content: qrDecodedContent,
      final_destination_url: qrFinalUrl,
      destination_title: qrPageTitle,
      timestamp: new Date().toISOString(),
      credits_used: creditCost,
      credits_remaining: creditsRemaining,
      credits_limit: getMonthlyCreditLimit(user),
      timing_ms: Date.now() - startTime,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});