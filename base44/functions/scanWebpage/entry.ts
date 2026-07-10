import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // === Authentication: validate user token server-side ===
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    // === Premium verification: checked server-side, never trust client ===
    const plan = user.subscription_plan || 'starter';
    if (plan !== 'premium' && plan !== 'plus') {
      return Response.json({
        error: 'Premium subscription required',
        upgrade_url: 'https://vardin.base44.app/pricing'
      }, { status: 403 });
    }

    // Parse request body
    const body = await req.json();
    const { page_text, screenshot_data_url, page_url, options } = body;

    const scanMode = options?.scan_mode || 'text';
    const answerType = options?.answer_type || 'detailed';
    const customFocus = typeof options?.custom_focus === 'string' ? options.custom_focus.slice(0, 500) : '';
    const customInstructions = typeof options?.custom_instructions === 'string' ? options.custom_instructions.slice(0, 1000) : '';

    // Build prompt
    let prompt = `You are Vardin, an expert scam and fraud detection AI. Analyze the following webpage for potential scam, phishing, or fraud indicators.\n\n`;
    prompt += `Page URL: ${page_url || 'unknown'}\n\n`;

    if (scanMode === 'text' || scanMode === 'both') {
      prompt += `Page Content (first 10000 chars):\n${(page_text || '').slice(0, 10000)}\n\n`;
    }

    if (scanMode === 'url') {
      prompt += `Analyze based on the URL structure and domain only. Look for suspicious patterns like typosquatted domains, misleading subdomains, or known scam URL patterns.\n\n`;
    }

    if (customFocus) {
      prompt += `Specific focus: ${customFocus}\n\n`;
    }

    if (customInstructions) {
      prompt += `Additional instructions: ${customInstructions}\n\n`;
    }

    // Define response schema based on answer type
    let responseSchema;

    switch (answerType) {
      case 'quick':
        prompt += `Provide a quick verdict: Is this a scam? Answer with a clear yes/no and one sentence explaining why.`;
        responseSchema = {
          type: 'object',
          properties: {
            is_scam: { type: 'boolean' },
            confidence: { type: 'number', description: '0-100 confidence level' },
            verdict: { type: 'string', description: 'One sentence verdict' }
          },
          required: ['is_scam', 'verdict']
        };
        break;
      case 'risk_score':
        prompt += `Provide only a risk score assessment with minimal text.`;
        responseSchema = {
          type: 'object',
          properties: {
            risk_score: { type: 'number', description: '0-100 risk score where 100 is most dangerous' },
            risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
            summary: { type: 'string', description: 'One sentence summary' }
          },
          required: ['risk_score', 'risk_level']
        };
        break;
      case 'red_flags':
        prompt += `List only the specific red flags and warning signs found. Be specific and cite evidence from the page.`;
        responseSchema = {
          type: 'object',
          properties: {
            red_flags: { type: 'array', items: { type: 'string' }, description: 'Specific warning signs found' },
            overall_risk: { type: 'string', enum: ['low', 'medium', 'high'] }
          },
          required: ['red_flags', 'overall_risk']
        };
        break;
      default:
        prompt += `Provide a detailed scam analysis report with risk assessment, explanation, and recommended next steps.`;
        responseSchema = {
          type: 'object',
          properties: {
            risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
            risk_score: { type: 'number', description: '0-100 risk score' },
            is_scam: { type: 'boolean' },
            explanation: { type: 'string', description: 'Detailed explanation of the assessment' },
            tactics_detected: { type: 'array', items: { type: 'string' }, description: 'Manipulation tactics detected' },
            red_flags: { type: 'array', items: { type: 'string' }, description: 'Specific warning signs' },
            next_steps: { type: 'array', items: { type: 'string' }, description: 'Recommended actions' },
            what_they_want: { type: 'string', description: 'What the scammer is trying to get, if applicable' }
          },
          required: ['risk_level', 'risk_score', 'explanation']
        };
    }

    const llmOptions: any = {
      prompt,
      response_json_schema: responseSchema,
    };

    // Handle screenshot upload if provided
    if ((scanMode === 'screenshot' || scanMode === 'both') && screenshot_data_url) {
      try {
        const base64Data = screenshot_data_url.split(',')[1] || '';
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'image/jpeg' });
        const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: blob });
        llmOptions.file_urls = [file_url];
        llmOptions.prompt += '\n\nAlso analyze the attached screenshot of the webpage visually.';
      } catch (_uploadErr) {
        // Continue without screenshot if upload fails
      }
    }

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM(llmOptions);

    return Response.json({ analysis: result, scan_mode: scanMode, answer_type: answerType });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});