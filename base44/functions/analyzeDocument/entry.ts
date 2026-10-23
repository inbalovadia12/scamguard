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
  if (value >= 81) return 'very_high';
  if (value >= 61) return 'high';
  if (value >= 36) return 'medium';
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
  prompt += '2. risk_score: a number from 0 to 100 (higher = more unfair or more risky for the person signing) and risk_level: Low (0-35), Medium (36-60), High (61-80) or Very High (81-100).\n';
  prompt += '   The score reflects how unfair the deal is overall, not how many clauses you listed. Standard terms that a fair document of this kind normally contains, and any risky term the document balances with a real protection for the person signing, must not push the score up. A document with only standard terms, or with one or two mildly one-sided clauses, belongs at 0-35 (Low).\n';
  prompt += '3. red_flags: EVERY clause that is risky, one-sided or costly for the person signing, judged with the context rules further down: a clause is only risky when the document gives the person no real way to protect themselves from it. Be thorough about genuinely unfair clauses and do not merge several separate problems into one flag, but do not pad the list with standard terms that the document balances elsewhere; a fair document may need no flags at all. After your first pass, reread the document once and add every risky clause you missed, including late-payment fees, interest on overdue amounts, a deposit the company may keep, and anything the company refuses to guarantee. For each flag give: title (short), severity (low, medium or high), exact_quote (the clause itself, copied word for word from the document, at most about 30 words), plain_explanation (why it matters, in everyday words), suggested_action (what the person could ask for or do). Put the most serious first. Return an empty list only if nothing is concerning.\n';
  prompt += '4. key_terms: the important facts, as label and detail pairs. List every charge and amount that appears anywhere in the document, including late fees, interest, deposits and the price charged on renewal. Cover any that appear: price and total cost, extra fees or charges, contract length, renewal and auto-renewal, notice period, how to cancel, penalties, deposit, and interest or late fees.\n';
  prompt += '5. missing_info: important things a fair document of this type normally includes but this one does not (for example no cancellation terms, no fee schedule, no notice period for price changes, no refund policy).\n';
  prompt += '6. questions_to_ask: 3 to 5 smart questions to ask the other side before signing.\n\n';

  prompt += 'ALWAYS CHECK FOR THESE, and raise a red flag for each one that is present:\n';
  prompt += '- automatic renewal, especially renewal at a price the document never fixes, and only when cancelling is genuinely hard, as set out in the context rules below;\n';
  prompt += '- hidden or recurring fees that are not part of the headline price (maintenance, processing, administration, restocking, service or "miscellaneous" charges);\n';
  prompt += '- early termination or cancellation penalties, judged against the context rules below before you give them a severity;\n';
  prompt += '- the right to change the terms, the fees or the service unilaterally, with little or no notice;\n';
  prompt += '- broad data sharing, or permission to sell the person\'s personal data;\n';
  prompt += '- liability waivers that also cover the company\'s own negligence or misconduct;\n';
  prompt += '- forced arbitration;\n';
  prompt += '- a waiver of the right to join a class action or to sue in court, as its own separate flag;\n';
  prompt += '- vague or catch-all fee wording, such as "additional charges may apply" with no amounts;\n';
  prompt += '- no guarantee of service, uptime or results, or a right to suspend the service without a refund;\n';
  prompt += '- anything else one-sided, unusual or costly: one-sided indemnities, no-refund rules, a deposit the company may keep, waived notice rights, unusual or short deadlines, or terms that make cancelling or complaining practically impossible.\n\n';

  prompt += 'CONTEXT RULES - READ THE WHOLE DOCUMENT BEFORE JUDGING ANY CLAUSE:\n';
  prompt += '- A clause is only risky when the person signing has no effective way to protect themselves from it. When the same document gives them a real, workable protection, that clause is fair and must not be flagged, or at most may be described as low.\n';
  prompt += '- Price, fee, or agreement changes: if the company may raise the price, change its fees, or change the agreement, but the document also gives the member a clear right to cancel or leave without penalty when that happens (or the change only applies from the next renewal, which they can refuse by cancelling), do NOT flag the change as risky. Flag it only when the change can take effect with no way out, or when the notice is too short for the person to act (for example 7 days or less with no cancellation right).\n';
  prompt += '- Auto-renewal: flag it only when cancelling is deliberately difficult. If the person can cancel easily and accessibly - by email, by phone, in person, or from an online account - with 30 days notice or less, auto-renewal is ordinary practice and must be low at most, never medium or high. Keep it medium or high only when cancellation is genuinely hard: registered or certified mail only, an unreasonably narrow cancellation window, cancellation by phone during limited hours only, in-person cancellation at a single location only, or several hoops that must all be cleared in sequence. When cancellation is genuinely hard in that way, auto-renewal must appear as its own red flag at medium or high severity with the renewal clause quoted, and the summary must say how far ahead of the renewal the deadline falls (for example, that the member has to act 120 days in advance).\n';
  prompt += '- Cancelling counts as easy when the document allows at least one simple, commonly available route (email, an online account, a phone call, or in person) and gives at least 30 days notice, or a window of that length, before the deadline.\n';
  prompt += '- Early termination penalties: on a yearly or multi-year contract, or any contract where the person agreed to pay for the full term upfront, being responsible for the remaining term is standard practice, not a trap, and on a prepaid plan not getting the unused months back when cancelling early is standard too. Rate both low at most, and only call a penalty unusually harsh when it is charged on top of the remaining fees, when the amount clearly exceeds what is still owed, or when it has nothing to do with the cost of the remaining term (for example a penalty of around 150% of the remaining fees, or a fee charged on a term that was already paid in full).\n';
  prompt += '- Standard wording such as "you must pay through the end of the term if you cancel early", and a prepaid term that is simply not refunded when cancelled early, are standard, not traps. Trap wording is different: paying 100% of the remaining fees PLUS an additional penalty fee, an extra penalty charged on top of a term that was already paid in full, or a penalty that exceeds what is still owed (around 150% of the remaining fees).\n';
  prompt += '- Compare the clause with what a reasonable person would expect from a fair contract of this exact type. If it matches normal, fair practice, do not flag it.\n\n';

  prompt += 'SEVERITY RULES:\n';
  prompt += '- Rate a clause high only when all four of these are true: it is hard to notice or easy to miss, it is financially severe, it is one-sided compared with what a fair contract would say, and it is actually enforced rather than theoretical.\n';
  prompt += '- Hard to notice means the person would probably not realise it applies to them: buried in a defined term, in a schedule or annex, behind a cross-reference to another document, or written so that it does not state the real cost.\n';
  prompt += '- If any one of those four is missing, rate the clause medium or low instead. A clause the document balances, or one the person can fully escape by cancelling, is low.\n';
  prompt += '- Medium is for a clause that is genuinely one-sided but clearly worded, plainly disclosed and limited in size. Low is for a clause that is normal for this type of document, or slightly one-sided but easy to escape.\n';
  prompt += '- Fair context - a cancellation right, advance notice, no extra penalty, a complete price with no hidden charges - must visibly lower the overall score. Never let one standard clause, or a handful of minor ones, carry a document into medium or high on their own.\n\n';

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

  prompt += '\n\nFINAL CHECK before you answer. Go through the document once more, applying the context and severity rules above to each item below. Raise a red flag only where the document leaves the person without a real way to protect themselves: automatic renewal only when cancelling is genuinely hard; renewal pricing; hidden or recurring fees that are not in the headline price; catch-all fee wording; early termination or cancellation penalties; a cancellation process that is hard to follow; the right to change the terms, the prices or the service unilaterally; broad data sharing or the sale of personal data; a liability waiver that covers the company\'s own negligence; forced arbitration; a class action or right-to-sue waiver; no guarantee of service; late-payment fees and interest; and a deposit the company may keep. When the document balances a clause with a clear cancellation right, advance notice, or no extra penalty, say so instead of flagging it. A genuinely one-sided document normally deserves several red flags; a fair document, or one whose one-sided clauses are balanced by a real protection, deserves few or none.';

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