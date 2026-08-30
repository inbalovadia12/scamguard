import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { getUrlhausReport } from '../../shared/urlhaus.ts';

const PLAN_LIMITS = { starter: 15, plus: 150, premium: 400 };
const ANSWER_TYPE_COSTS: Record<string, number> = {
  quick: 3, risk_score: 4, red_flags: 5, detailed: 8,
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
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(6000), // Reduced from 8000
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VardinScanner/1.0)' },
    });
    const finalUrl = response.url || url;
    const contentType = response.headers.get('content-type') || null;
    let pageTitle: string | null = null;
    if (contentType && contentType.includes('text/html')) {
      try {
        const html = await response.text();
        const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        if (titleMatch) pageTitle = titleMatch[1].trim();
      } catch {}
    }
    return { finalUrl, pageTitle, contentType };
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
      return Response.json({ error: 'Premium subscription required', upgrade_url: 'https://vardin.base44.app/pricing' }, { status: 403 });
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
    const kidMode = !!options?.kid_mode;

    const LANGUAGE_NAMES: Record<string, string> = { en: 'English', he: 'Hebrew', es: 'Spanish' };
    const languageName = LANGUAGE_NAMES[language] || 'English';

    const answerTypeCost = ANSWER_TYPE_COSTS[answerType] || 8;
    const scanModifier = scanType === 'page' ? (SCAN_TYPE_MODIFIERS[scanMode] || 0) : (SCAN_TYPE_MODIFIERS[scanType] || 0);
    const creditCost = answerTypeCost + scanModifier;
    const currentMonth = new Date().toISOString().slice(0, 7);
    let creditsUsed = user.credits_used || 0;
    if (user.credits_reset_month !== currentMonth) creditsUsed = 0;
    const creditLimit = (PLAN_LIMITS[plan] || PLAN_LIMITS.starter) + (user.referral_bonus_credits || 0);
    const creditsRemaining = Math.max(0, creditLimit - creditsUsed);

    if (creditsRemaining < creditCost) {
      return Response.json({
        error: 'Insufficient credits',
        credits_remaining: creditsRemaining, credits_limit: creditLimit, credit_cost: creditCost,
        upgrade_url: 'https://vardin.base44.app/pricing',
      }, { status: 402 });
    }

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

    const isUrlScan = scanType === 'url' || (scanType === 'page' && scanMode === 'url') || (page_url && scanType !== 'file');

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

        // Get VT report for final URL if not already done
        if (!vtReport && qrFinalUrl !== qrDecodedContent) {
          vtReport = await getVirusTotalReport(qrFinalUrl);
        } else if (!vtReport) {
          vtReport = await getVirusTotalReport(qrDecodedContent);
        }
      }
    }

    // === EARLY EXIT: If URLhaus says malware, return HIGH RISK immediately ===
    if (urlhausReport?.listed) {
      const newCreditsUsed = creditsUsed + creditCost;
      await base44.auth.updateMe({ credits_used: newCreditsUsed, credits_reset_month: currentMonth });

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
        credits_remaining: Math.max(0, creditLimit - newCreditsUsed),
        credits_limit: creditLimit,
        timing_ms: Date.now() - startTime,
      });
    }

    // === EARLY EXIT: If VT shows high malicious count, return HIGH RISK immediately ===
    if (vtReport && vtReport.malicious >= 5) {
      const newCreditsUsed = creditsUsed + creditCost;
      await base44.auth.updateMe({ credits_used: newCreditsUsed, credits_reset_month: currentMonth });

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
        credits_remaining: Math.max(0, creditLimit - newCreditsUsed),
        credits_limit: creditLimit,
        timing_ms: Date.now() - startTime,
      });
    }

    // === Build LLM prompt (only call if not obviously safe/dangerous) ===
    let prompt = 'You are Vardin, an expert scam and fraud detection AI.\n\n';
    prompt += 'IMPORTANT: Respond entirely in ' + languageName + '. All text must be in ' + languageName + '.\n\n';
    if (kidMode) {
      prompt += 'KID MODE: The user is a child. Use simple, easy-to-understand language. Be clear and direct. If it is a scam, say clearly "This is NOT safe!" and explain why in simple words a 10-year-old can understand.\n\n';
    }

    if (vtReport) {
      prompt += 'VIRUSTOTAL: ' + vtReport.malicious + ' malicious, ' + vtReport.suspicious + ' suspicious, ' + vtReport.harmless + ' harmless, reputation: ' + vtReport.reputation + '\n\n';
    }

    if (urlhausReport && !urlhausReport.listed) {
      prompt += 'URLHAUS: URL is NOT listed in malware database.\n\n';
    }

    prompt += 'Page URL: ' + (page_url || 'unknown') + '\n\n';

    if (scanType === 'page' || scanType === 'url') {
      if (scanMode === 'text' || scanMode === 'both') {
        prompt += 'Page Content:\n' + (page_text || '').slice(0, 8000) + '\n\n';
      }
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
          const uploadResult = await base44.integrations.Core.UploadFile({ file });
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
          const uploadResult = await base44.integrations.Core.UploadFile({ file });
          if (uploadResult?.file_url) {
            llmOptions.file_urls = [uploadResult.file_url];
          }
        }
      } catch (_e) {}
    }

    // LLM timeout at 1.5 seconds
    const llmPromise = base44.integrations.Core.InvokeLLM(llmOptions);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('LLM timeout')), 1500)
    );

    let result;
    try {
      result = await Promise.race([llmPromise, timeoutPromise]);
    } catch (e) {
      // LLM timeout - return basic analysis
      result = {
        risk_level: vtReport?.malicious ? 'medium' : 'low',
        risk_score: vtReport?.malicious ? 55 : 25,
        confidence: 60,
        is_scam: !!vtReport?.malicious,
        explanation: 'LLM analysis timeout. Check VirusTotal/URLhaus reports above.',
      };
    }

    // === Override QR decoded content with verified value ===
    if (scanType === 'qr' && qrDecodedContent) {
      (result as any).decoded_content = qrDecodedContent;
      if (qrFinalUrl) (result as any).final_destination_url = qrFinalUrl;
    }

    const newCreditsUsed = creditsUsed + creditCost;
    await base44.auth.updateMe({ credits_used: newCreditsUsed, credits_reset_month: currentMonth });

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
      credits_remaining: Math.max(0, creditLimit - newCreditsUsed),
      credits_limit: creditLimit,
      timing_ms: Date.now() - startTime,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
