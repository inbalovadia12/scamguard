import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { url } = await req.json();
    if (!url) return Response.json({ error: 'URL is required' }, { status: 400 });

    let targetUrl = url.trim();
    if (!targetUrl.match(/^https?:\/\//)) {
      targetUrl = 'https://' + targetUrl;
    }

    let websiteContent = '';
    let httpStatus = 0;
    let fetchError = null;

    try {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      });
      httpStatus = response.status;
      const html = await response.text();
      websiteContent = extractContent(html);
      if (websiteContent.length > 8000) {
        websiteContent = websiteContent.substring(0, 8000) + '...[truncated]';
      }
    } catch (e) {
      fetchError = e.message;
    }

    const prompt = `You are a scam detection expert. Analyze this URL and its website content for scam/phishing risk.

URL: ${targetUrl}
HTTP Status: ${httpStatus}
${fetchError ? `Website fetch error: ${fetchError}` : 'Website fetched successfully.'}

Website content extracted:
${websiteContent || '(Could not fetch website content — analyze based on URL structure and domain only)'}

Analyze:
- Domain: typosquatting, suspicious TLDs, recently registered domains, non-matching brand domains
- Website content: product listings, pricing anomalies (too good to be true), payment methods (gift cards, crypto, wire), contact info legitimacy, trust signals
- For marketplace listings: compare price vs market value, seller reputation, stock photos vs real photos
- Phishing patterns: login forms, credential harvesting, fake payment portals
- Urgency/scarcity tactics in the content
- Missing legal pages (terms, privacy, refund policy)

Rules: never say "definitely a scam" — use "likely" or "highly likely". Be educational and plain-English. Include concrete next steps.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
          risk_score: { type: 'number' },
          explanation: { type: 'string' },
          tactics_detected: { type: 'array', items: { type: 'string' } },
          next_steps: { type: 'array', items: { type: 'string' } },
          why_scammers_do_this: { type: 'string' },
          what_they_want: { type: 'string' },
          what_to_say: { type: 'string' },
        },
      },
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function extractContent(html) {
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
  const title = titleMatch ? titleMatch[1].trim() : '';

  const descMatch = html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']*)["']/is);
  const description = descMatch ? descMatch[1].trim() : '';

  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/is);
  const ogTitle = ogTitleMatch ? ogTitleMatch[1].trim() : '';

  const hasLoginForm = /<(?:form|input)[^>]*(?:password|login|signin|log-in|sign-in)/i.test(html);
  const hasPaymentForm = /<(?:form|input|button)[^>]*(?:payment|credit|card|cvv|checkout|paypal|stripe)/i.test(html);

  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  let result = '';
  if (ogTitle) result += `Page Title: ${ogTitle}\n`;
  else if (title) result += `Page Title: ${title}\n`;
  if (description) result += `Meta Description: ${description}\n`;
  result += `Has Login Form: ${hasLoginForm}\n`;
  result += `Has Payment Form: ${hasPaymentForm}\n`;
  result += `\n--- Website Content ---\n${text}`;

  return result;
}