import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PLAN_LIMITS = { starter: 15, plus: 150, premium: 400 };
const CREDIT_COSTS: Record<string, number> = {
  text: 8, screenshot: 8, both: 12, url: 12,
  email: 8, chat: 8, marketplace: 8, qr: 10, file: 12,
};

// === VirusTotal URL reputation check (API key stays on backend, never exposed) ===
async function getVirusTotalReport(url: string): Promise<any | null> {
  const apiKey = Deno.env.get("VIRUSTOTAL_API_KEY");
  if (!apiKey) return null;

  try {
    // VirusTotal expects base64url-encoded URL
    const urlBytes = new TextEncoder().encode(url);
    let binary = '';
    for (let i = 0; i < urlBytes.length; i++) binary += String.fromCharCode(urlBytes[i]);
    const base64 = btoa(binary);
    const urlId = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const response = await fetch(`https://www.virustotal.com/api/v3/urls/${urlId}`, {
      headers: { 'x-apikey': apiKey },
      signal: AbortSignal.timeout(10000),
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
  try {
    const base44 = createClientFromRequest(req);

    // === Authentication ===
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    // === Premium verification (server-side only) ===
    let plan = user.subscription_plan || 'starter';
    if (plan === 'free') plan = 'starter';
    if (plan === 'elite') plan = 'premium';
    if (plan !== 'premium' && plan !== 'plus') {
      return Response.json({ error: 'Premium subscription required', upgrade_url: 'https://vardin.base44.app/pricing' }, { status: 403 });
    }

    // Parse request
    const body = await req.json();
    const { page_text, screenshot_data_url, file_data, file_name, page_url, options } = body;

    const scanType = options?.scan_type || 'page';
    const scanMode = options?.scan_mode || 'text';
    const answerType = options?.answer_type || 'detailed';
    const customFocus = typeof options?.custom_focus === 'string' ? options.custom_focus.slice(0, 500) : '';
    const customInstructions = typeof options?.custom_instructions === 'string' ? options.custom_instructions.slice(0, 1000) : '';
    const language = options?.language || 'en';

    const LANGUAGE_NAMES: Record<string, string> = { en: 'English', he: 'Hebrew', es: 'Spanish' };
    const languageName = LANGUAGE_NAMES[language] || 'English';

    // === Credit check ===
    const creditCost = scanType === 'page' ? (CREDIT_COSTS[scanMode] || 8) : (CREDIT_COSTS[scanType] || 8);
    const currentMonth = new Date().toISOString().slice(0, 7);
    let creditsUsed = user.credits_used || 0;
    if (user.credits_reset_month !== currentMonth) creditsUsed = 0;
    const creditLimit = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
    const creditsRemaining = Math.max(0, creditLimit - creditsUsed);

    if (creditsRemaining < creditCost) {
      return Response.json({
        error: 'Insufficient credits',
        credits_remaining: creditsRemaining, credits_limit: creditLimit, credit_cost: creditCost,
        upgrade_url: 'https://vardin.base44.app/pricing',
      }, { status: 402 });
    }

    // === Validate content exists (prevent hallucinated results) ===
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

    // === VirusTotal URL reputation (for URL-based scans) ===
    let vtReport = null;
    if (scanType === 'url' || (scanType === 'page' && scanMode === 'url') || (page_url && scanType !== 'file')) {
      vtReport = await getVirusTotalReport(page_url);
    }

    // === Build prompt ===
    let prompt = 'You are Vardin, an expert scam and fraud detection AI.\n\n';
    prompt += 'IMPORTANT: Respond entirely in ' + languageName + '. All text must be in ' + languageName + '.\n\n';

    if (vtReport) {
      prompt += 'VIRUSTOTAL REPORT for ' + (page_url || 'unknown') + ':\n';
      prompt += '- Malicious detections: ' + vtReport.malicious + '/' + vtReport.total_engines + ' security engines\n';
      prompt += '- Suspicious detections: ' + vtReport.suspicious + '\n';
      prompt += '- Harmless: ' + vtReport.harmless + '\n';
      prompt += '- Community reputation: ' + vtReport.reputation + '\n';
      if (Object.keys(vtReport.categories).length > 0) {
        prompt += '- Categories: ' + Object.values(vtReport.categories).join(', ') + '\n';
      }
      prompt += '\n';
    }

    prompt += 'Page URL: ' + (page_url || 'unknown') + '\n\n';

    // Scan-type-specific prompts
    if (scanType === 'page' || scanType === 'url') {
      if (scanType === 'url' || scanMode === 'url') {
        prompt += 'Analyze based on the URL structure and domain only. Look for typosquatted domains, misleading subdomains, suspicious TLDs, known scam URL patterns, and brand impersonation.\n';
        if (vtReport) prompt += 'Use the VirusTotal report above as a key data source.\n';
      } else {
        prompt += 'Analyze this webpage for scam, phishing, or fraud indicators.\n\n';
        if (scanMode === 'text' || scanMode === 'both') {
          prompt += 'Page Content (first 10000 chars):\n' + (page_text || '').slice(0, 10000) + '\n\n';
        }
        prompt += 'Analyze: domain reputation, SSL/HTTPS status, fake login pages, fake checkout/banking pages, payment risks, phishing forms, hidden elements, JavaScript indicators, social engineering tactics, urgency/scarcity tactics.\n';
      }
    } else if (scanType === 'email') {
      prompt += 'Analyze this email for scam indicators. Detect: sender spoofing, fake invoices, fake payment requests, suspicious links, urgency tactics, AI-generated scam content.\n\n';
      prompt += 'Email content:\n' + (page_text || '').slice(0, 10000) + '\n\n';
    } else if (scanType === 'chat') {
      prompt += 'Analyze these chat/SMS messages for scam indicators. Detect: romance scams, investment scams, crypto scams, tech support scams, bank/government impersonation, job scams, verification scams, gift card scams.\n';
      prompt += 'Supported platforms: SMS, iMessage, WhatsApp, Telegram, Messenger, Instagram, Discord.\n\n';
      prompt += 'Chat messages:\n' + (page_text || '').slice(0, 10000) + '\n\n';
    } else if (scanType === 'marketplace') {
      prompt += 'Analyze this marketplace listing for scam indicators. Detect: fake sellers, unrealistic prices, stolen images, payment scams, shipping scams, deposit scams, fake tracking scams.\n';
      prompt += 'Supported marketplaces: Facebook Marketplace, eBay, Craigslist, Gumtree, Amazon, Etsy, AliExpress.\n\n';
      prompt += 'Listing content:\n' + (page_text || '').slice(0, 10000) + '\n\n';
    } else if (scanType === 'qr') {
      prompt += 'Analyze this QR code image. Decode it if possible, then analyze the destination URL for: redirects, shortened URLs, phishing risks, and suspicious patterns.\n';
      prompt += 'If you can read the QR code, analyze the decoded URL. If not, describe what you see and assess risk.\n\n';
    } else if (scanType === 'file') {
      prompt += 'Analyze this uploaded file for: phishing language, fake invoices, fake job offers, suspicious documents, embedded URLs, and risky content.\n';
      prompt += 'File name: ' + (file_name || 'unknown') + '\n\n';
    } else if (scanType === 'screenshot') {
      prompt += 'Analyze this screenshot for scam indicators. This could be an email, SMS, WhatsApp, Telegram, Facebook, Instagram, marketplace listing, fake invoice, payment request, or login page.\n';
      prompt += 'Look for: urgency tactics, suspicious links, brand impersonation, payment requests, credential harvesting, and social engineering.\n\n';
    }

    if (customFocus) prompt += 'Specific focus: ' + customFocus + '\n\n';
    if (customInstructions) prompt += 'Additional instructions: ' + customInstructions + '\n\n';

    // === Response schema based on answer type ===
    let responseSchema;
    switch (answerType) {
      case 'quick':
        prompt += 'Provide a quick verdict: Is this a scam? Answer with yes/no and one sentence.';
        responseSchema = {
          type: 'object',
          properties: {
            is_scam: { type: 'boolean' },
            confidence: { type: 'number', description: '0-100 confidence level' },
            verdict: { type: 'string', description: 'One sentence verdict' },
          },
          required: ['is_scam', 'verdict'],
        };
        break;
      case 'risk_score':
        prompt += 'Provide only a risk score assessment with minimal text.';
        responseSchema = {
          type: 'object',
          properties: {
            risk_score: { type: 'number', description: '0-100 risk score where 100 is most dangerous' },
            risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
            summary: { type: 'string', description: 'One sentence summary' },
          },
          required: ['risk_score', 'risk_level'],
        };
        break;
      case 'red_flags':
        prompt += 'List only the specific red flags and warning signs found. Be specific and cite evidence.';
        responseSchema = {
          type: 'object',
          properties: {
            red_flags: { type: 'array', items: { type: 'string' }, description: 'Specific warning signs found' },
            overall_risk: { type: 'string', enum: ['low', 'medium', 'high'] },
          },
          required: ['red_flags', 'overall_risk'],
        };
        break;
      default:
        prompt += 'Provide a detailed scam analysis report with risk assessment, explanation, and recommended next steps.';
        responseSchema = {
          type: 'object',
          properties: {
            risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
            risk_score: { type: 'number', description: '0-100 risk score' },
            confidence: { type: 'number', description: '0-100 confidence level' },
            is_scam: { type: 'boolean' },
            scam_category: { type: 'string', description: 'Type of scam detected (e.g. phishing, romance scam, marketplace scam)' },
            explanation: { type: 'string', description: 'Detailed explanation of the assessment' },
            tactics_detected: { type: 'array', items: { type: 'string' }, description: 'Manipulation tactics detected' },
            red_flags: { type: 'array', items: { type: 'string' }, description: 'Specific warning signs' },
            evidence_found: { type: 'array', items: { type: 'string' }, description: 'Concrete evidence from the content' },
            sources_checked: { type: 'array', items: { type: 'string' }, description: 'Sources/databases checked' },
            next_steps: { type: 'array', items: { type: 'string' }, description: 'Recommended actions' },
            what_they_want: { type: 'string', description: 'What the scammer is trying to get, if applicable' },
          },
          required: ['risk_level', 'risk_score', 'explanation'],
        };
    }

    const llmOptions: any = { prompt, response_json_schema: responseSchema };

    // === Upload screenshot/QR image for vision analysis ===
    if ((scanType === 'screenshot' || scanType === 'qr' || (scanType === 'page' && (scanMode === 'screenshot' || scanMode === 'both'))) && screenshot_data_url) {
      try {
        const base64Data = screenshot_data_url.split(',')[1] || '';
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'image/jpeg' });
        const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: blob });
        llmOptions.file_urls = [file_url];
        llmOptions.prompt += '\n\nAlso analyze the attached image visually.';
      } catch (_uploadErr) {
        // Continue without image if upload fails
      }
    }

    // === Upload file for document analysis ===
    if (scanType === 'file' && file_data) {
      try {
        const base64Data = file_data.split(',')[1] || file_data;
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        const blob = new Blob([bytes]);
        const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: blob });
        llmOptions.file_urls = [file_url];
        llmOptions.prompt += '\n\nAlso analyze the attached file.';
      } catch (_fileUploadErr) {
        // Continue without file if upload fails
      }
    }

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM(llmOptions);

    // === Deduct credits after successful scan ===
    const newCreditsUsed = creditsUsed + creditCost;
    await base44.auth.updateMe({ credits_used: newCreditsUsed, credits_reset_month: currentMonth });

    return Response.json({
      analysis: result,
      scan_type: scanType,
      scan_mode: scanMode,
      answer_type: answerType,
      virustotal: vtReport,
      timestamp: new Date().toISOString(),
      credits_used: creditCost,
      credits_remaining: Math.max(0, creditLimit - newCreditsUsed),
      credits_limit: creditLimit,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});