import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Fine Print Scanner: explains a document in plain language and flags risky terms.
//
// Flow: (optional) extract text from an uploaded file, check the free monthly
// allowance, ask the LLM for a structured report, save it to ScanHistory, return it.

const FREE_MONTHLY_SCANS = 3;
const MIN_TEXT_CHARS = 100;
const MAX_TEXT_CHARS = 50000;
const LLM_TIMEOUT_MS = 90000;

const DOCUMENT_TYPES = ['auto', 'lease', 'subscription', 'gym_service', 'loan_credit', 'medical_bill', 'terms_of_service', 'other'];

const TYPE_LABELS = {
  auto: 'Auto-detect',
  lease: 'Lease',
  subscription: 'Subscription',
  gym_service: 'Gym or Service Contract',
  loan_credit: 'Loan or Credit',
  medical_bill: 'Medical Bill',
  terms_of_service: 'Terms of Service',
  other: 'Other',
};

const LANGUAGE_NAMES = { en: 'English', he: 'Hebrew', es: 'Spanish' };

const DOCUMENT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    risk_score: { type: 'number' },
    risk_level: { type: 'string', enum: ['Low', 'Medium', 'High', 'Very High'] },
    document_type: { type: 'string', enum: DOCUMENT_TYPES },
    red_flags: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
          exact_quote: { type: 'string' },
          plain_explanation: { type: 'string' },
          suggested_action: { type: 'string' },
        },
        required: ['title', 'severity', 'exact_quote', 'plain_explanation', 'suggested_action'],
      },
    },
    key_terms: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          detail: { type: 'string' },
        },
        required: ['label', 'detail'],
      },
    },
    missing_info: { type: 'array', items: { type: 'string' } },
    questions_to_ask: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'risk_score', 'risk_level', 'document_type', 'red_flags', 'key_terms', 'missing_info', 'questions_to_ask'],
};

function normalizePlan(plan) {
  if (plan === 'free' || !plan) return 'starter';
  if (plan === 'elite') return 'premium';
  return plan;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function normalizeRiskLevel(level, score) {
  const raw = String(level || '').toLowerCase().replace(/[\s-]+/g, '_');
  if (['low', 'medium', 'high', 'very_high'].includes(raw)) return raw;
  const value = Number(score) || 0;
  if (value >= 71) return 'very_high';
  if (value >= 46) return 'high';
  if (value >= 21) return 'medium';
  return 'low';
}

function buildTitle(fileName, storedType, summary) {
  if (fileName) return fileName.slice(0, 120);
  const label = TYPE_LABELS[storedType] || 'Document';
  const firstLine = String(summary || '').split(/(?<=\.)\s/)[0] || '';
  return firstLine ? `${label}: ${firstLine.slice(0, 80)}` : label;
}

// Counts only the signed-in user's scans for the current month. The scan records
// are created with the user's own client, so created_by_id is the owner.
async function countScansThisMonth(base44, userId) {
  try {
    const records = await base44.asServiceRole.entities.ScanHistory.filter({ created_by_id: userId });
    const list = Array.isArray(records) ? records : [];
    const month = currentMonth();
    return list.filter((record) => String(record?.created_date || '').slice(0, 7) === month).length;
  } catch (error) {
    return 0;
  }
}

// Reads the text out of a PDF or a photo of a document. The file lives in private
// storage, so it is handed to the integrations as a short-lived signed URL.
async function extractTextFromFile(base44, fileUri) {
  let fileUrl = '';
  try {
    const signed = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri, expires_in: 600 });
    fileUrl = signed?.signed_url || '';
  } catch (error) {
    fileUrl = '';
  }
  if (!fileUrl) return '';

  try {
    const extracted = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
      file_url: fileUrl,
      json_schema: { type: 'object', properties: { text: { type: 'string' } } },
    });
    const text = extracted?.output?.text;
    if (typeof text === 'string' && text.trim().length >= MIN_TEXT_CHARS) return text.trim();
  } catch (error) {
    // Fall through to the vision reading below.
  }

  try {
    const transcribed = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: 'Transcribe every word of text in this document, in reading order, keeping headings and numbered clauses. Return only the transcribed text, with no commentary or summary.',
      file_urls: [fileUrl],
    });
    return typeof transcribed === 'string' ? transcribed.trim() : '';
  } catch (error) {
    return '';
  }
}

function buildPrompt({ text, requestedType, language, truncated }) {
  const languageName = LANGUAGE_NAMES[language] || 'English';
  const typeLabel = TYPE_LABELS[requestedType] || 'Auto-detect';

  let prompt = 'You are Vardin\'s Fine Print Scanner. You read contracts, leases, subscription terms, service agreements and bills, and explain them in plain language for people with no legal training.\n\n';
  prompt += `Respond entirely in ${languageName}. Use short sentences and everyday words.\n\n`;
  prompt += `THE USER SAYS THIS DOCUMENT IS: ${typeLabel}\n\n`;
  prompt += 'DOCUMENT TEXT:\n"""\n' + text + '\n"""\n\n';

  prompt += 'PRODUCE:\n';
  prompt += '1. summary: 3 to 4 sentences explaining, in plain language, what the person is agreeing to and what it costs them.\n';
  prompt += '2. risk_score: a number from 0 to 100 (higher = more unfair or more risky for the person signing) and risk_level: Low (0-20), Medium (21-45), High (46-70) or Very High (71-100).\n';
  prompt += '3. red_flags: EVERY clause that is risky, one-sided or costly for the person signing. Be exhaustive and prefer completeness over brevity: a typical problematic contract should produce 8 or more flags. Do not stop at the worst few, and do not merge several separate problems into one flag. After your first pass, reread the document once and add every risky clause you missed, including late-payment fees, interest on overdue amounts, a deposit the company may keep, and anything the company refuses to guarantee. For each flag give: title (short), severity (low, medium or high), exact_quote (the clause itself, copied word for word from the document, at most about 30 words), plain_explanation (why it matters, in everyday words), suggested_action (what the person could ask for or do). Put the most serious first. Return an empty list only if nothing is concerning.\n';
  prompt += '4. key_terms: the important facts, as label and detail pairs. List every charge and amount that appears anywhere in the document, including late fees, interest, deposits and the price charged on renewal. Cover any that appear: price and total cost, extra fees or charges, contract length, renewal and auto-renewal, notice period, how to cancel, penalties, deposit, and interest or late fees.\n';
  prompt += '5. missing_info: important things a fair document of this type normally includes but this one does not (for example no cancellation terms, no fee schedule, no notice period for price changes, no refund policy).\n';
  prompt += '6. questions_to_ask: 3 to 5 smart questions to ask the other side before signing.\n\n';

  prompt += 'ALWAYS CHECK FOR THESE, and raise a red flag for each one that is present:\n';
  prompt += '- automatic renewal, especially renewal at a price the document never fixes;\n';
  prompt += '- hidden or recurring fees that are not part of the headline price (maintenance, processing, administration, restocking, service or "miscellaneous" charges);\n';
  prompt += '- early termination or cancellation penalties;\n';
  prompt += '- the right to change the terms, the fees or the service unilaterally, with little or no notice;\n';
  prompt += '- broad data sharing, or permission to sell the person\'s personal data;\n';
  prompt += '- liability waivers that also cover the company\'s own negligence or misconduct;\n';
  prompt += '- forced arbitration;\n';
  prompt += '- a waiver of the right to join a class action or to sue in court, as its own separate flag;\n';
  prompt += '- vague or catch-all fee wording, such as "additional charges may apply" with no amounts;\n';
  prompt += '- no guarantee of service, uptime or results, or a right to suspend the service without a refund;\n';
  prompt += '- anything else one-sided, unusual or costly: one-sided indemnities, no-refund rules, a deposit the company may keep, waived notice rights, unusual or short deadlines, or terms that make cancelling or complaining practically impossible.\n\n';

  prompt += 'QUOTE AND COMPLETENESS RULES:\n';
  prompt += '- Each red flag must quote the exact clause that is the problem. For arbitration, quote the arbitration clause itself, and give the class action waiver its own separate flag rather than folding it in.\n';
  prompt += '- Any key term that is financially harmful to the person signing (a penalty, a hidden or recurring fee, renewal pricing, interest or late charges, a deposit that can be kept) must ALSO appear as a red flag with its exact quote.\n';
  prompt += '- Do NOT flag standard, fair boilerplate that is normal for this kind of document. Only flag a common clause when this wording is actually unusual, vague, or one-sided against the person signing.\n\n';

  prompt += 'EVIDENCE RULES:\n';
  prompt += '- Only report what is actually in the document text above. Never invent a clause, a fee, an amount, a date or a quote.\n';
  prompt += '- exact_quote must be copied word for word from the document. If you cannot quote it exactly, leave exact_quote empty.\n';
  prompt += '- Explain legal wording in plain words. Do not use jargon without explaining it.\n';
  prompt += '- If the text is not a contract or agreement, or is too fragmentary to judge, say so plainly in the summary, keep the risk score low (30 or less), and leave red_flags empty.\n';
  prompt += '- Do not give legal advice and do not tell the person whether to sign. Explain what the terms mean so they can decide.';

  prompt += '\n\nFINAL CHECK before you answer. Go through the document once more and confirm that each of these is either raised as its own red flag, with its exact quote, or is genuinely not in the document: automatic renewal; renewal pricing; hidden or recurring fees that are not in the headline price; catch-all fee wording; early termination or cancellation penalties; a cancellation process that is hard to follow; the right to change the terms, the prices or the service unilaterally; broad data sharing or the sale of personal data; a liability waiver that covers the company\'s own negligence; forced arbitration; a class action or right-to-sue waiver; no guarantee of service; late-payment fees and interest; and a deposit the company may keep. A one-sided document like this normally deserves 8 or more red flags, so only return fewer when the document really is fair.';

  if (truncated) {
    prompt += '\n\nNOTE: this document was very long and only the beginning was received, so the ending is missing. Analyze what you received, and mention in missing_info that the rest of the document could not be checked.';
  }

  return prompt;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Please sign in to scan a document.' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const pastedText = typeof body.document_text === 'string' ? body.document_text.trim() : '';
    const fileUri = typeof body.file_uri === 'string' ? body.file_uri.trim() : '';
    const fileName = typeof body.file_name === 'string' ? body.file_name.slice(0, 200) : '';
    const requestedType = DOCUMENT_TYPES.includes(body.document_type) ? body.document_type : 'auto';
    const language = typeof body.language === 'string' ? body.language.slice(0, 5) : 'en';

    if (!pastedText && !fileUri) {
      return Response.json({ error: 'Please paste your document text or upload a file first.' }, { status: 400 });
    }

    const plan = normalizePlan(user.subscription_plan);
    const isPaid = plan === 'plus' || plan === 'premium';
    const scansUsed = await countScansThisMonth(base44, user.id);

    if (!isPaid && scansUsed >= FREE_MONTHLY_SCANS) {
      return Response.json({
        limited: true,
        scans_used: scansUsed,
        scan_limit: FREE_MONTHLY_SCANS,
        message: `You have used all ${FREE_MONTHLY_SCANS} free document scans this month.`,
      });
    }

    let text = pastedText;
    let sourceType = 'text';
    if (!text && fileUri) {
      sourceType = 'file';
      text = await extractTextFromFile(base44, fileUri);
    }

    text = String(text || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();

    if (text.length < MIN_TEXT_CHARS) {
      return Response.json({
        error: sourceType === 'file'
          ? 'We could not read enough text from that file. If it is a photo, try a sharper one, or paste the text instead.'
          : 'There is too little text to analyze. Paste at least a few paragraphs of the actual terms (around 100 characters or more).',
      }, { status: 400 });
    }

    const truncated = text.length > MAX_TEXT_CHARS;
    const prompt = buildPrompt({
      text: truncated ? text.slice(0, MAX_TEXT_CHARS) : text,
      requestedType,
      language,
      truncated,
    });

    let raw;
    try {
      const llmCall = base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: DOCUMENT_SCHEMA,
      });
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Analysis timed out')), LLM_TIMEOUT_MS));
      raw = await Promise.race([llmCall, timeout]);
    } catch (error) {
      return Response.json({
        error: 'The analysis could not be completed. This is usually temporary, so please try again in a moment.',
      }, { status: 502 });
    }

    if (!raw || typeof raw !== 'object') {
      return Response.json({
        error: 'The analysis came back incomplete. Please try scanning the document again.',
      }, { status: 502 });
    }

    const riskScore = Math.max(0, Math.min(100, Math.round(Number(raw.risk_score) || 0)));
    const detectedType = DOCUMENT_TYPES.includes(raw.document_type) ? raw.document_type : requestedType;
    const storedType = requestedType === 'auto' ? detectedType : requestedType;

    const analysis = {
      summary: typeof raw.summary === 'string' ? raw.summary.trim() : '',
      risk_score: riskScore,
      risk_level: normalizeRiskLevel(raw.risk_level, riskScore),
      red_flags: Array.isArray(raw.red_flags) ? raw.red_flags.slice(0, 40) : [],
      key_terms: Array.isArray(raw.key_terms) ? raw.key_terms.slice(0, 30) : [],
      missing_info: Array.isArray(raw.missing_info) ? raw.missing_info.slice(0, 20) : [],
      questions_to_ask: Array.isArray(raw.questions_to_ask) ? raw.questions_to_ask.slice(0, 6) : [],
    };

    // Saved with the user's own client so the record belongs to them and follows
    // the ScanHistory ownership rule.
    let scanId = '';
    try {
      const saved = await base44.entities.ScanHistory.create({
        user_id: user.id,
        title: buildTitle(fileName, storedType, analysis.summary),
        document_type: storedType,
        source_type: sourceType,
        file_name: fileName,
        risk_score: analysis.risk_score,
        risk_level: analysis.risk_level,
        summary: analysis.summary.slice(0, 2000),
        results_json: JSON.stringify(analysis),
      });
      scanId = saved?.id || '';
    } catch (error) {
      scanId = '';
    }

    return Response.json({
      analysis,
      scan_id: scanId,
      document_type: storedType,
      document_type_label: TYPE_LABELS[storedType] || 'Document',
      scans_used: scansUsed + 1,
      scan_limit: isPaid ? null : FREE_MONTHLY_SCANS,
      truncated,
      characters: text.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}