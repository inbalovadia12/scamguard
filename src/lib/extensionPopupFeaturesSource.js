// Extension popup source: v3 feature layer.
// Appended to POPUP_JS by extensionPopupSource.js, so the generated popup.js is
// still one file while each concern stays reviewable here.

export const POPUP_FEATURES_JS = String.raw`// ==================== v3 features ====================
// Site trust, instant repeat verdicts, background-scan results, page phone
// numbers, Ask Family + guardian guidance, community reporting and history.
// All of it is additive: if any piece fails the scanning flow still works.

var I18N_EXTRA = {
  en: {
    history: 'History', clear_history: 'Clear history', back_to_scan: 'Back',
    never_warn: 'Never warn here', always_check: 'Always check',
    cached_title: 'You already checked this page', cached_recheck: 'Check it again',
    looks_safe: 'Looks safe', looks_risky: 'Looks risky', looks_dangerous: 'Dangerous page', risk_score_label: 'Risk score',
    bg_title: 'Result from a quick scan', bg_show: 'Show report', bg_dismiss: 'Dismiss',
    phone_found: 'Phone numbers on this page',
    ask_family: 'Ask family', report_community: 'Report',
    family_sent: 'Sent to your guardian. Their reply will appear here.',
    family_note_label: 'Add a note for your guardian (optional)',
    family_none: 'Ask Family is not set up on your account.',
    report_sent: 'Shared with the Vardin community. Thank you.',
    report_failed: 'Could not share that right now.',
    no_history: 'No scans yet.',
    blocked_note: 'Dangerous page', warn_note: 'Strong scam indicators'
  },
  he: {
    history: '\u05D4\u05D9\u05E1\u05D8\u05D5\u05E8\u05D9\u05D4', clear_history: '\u05E0\u05E7\u05D4 \u05D4\u05D9\u05E1\u05D8\u05D5\u05E8\u05D9\u05D4', back_to_scan: '\u05D7\u05D6\u05E8\u05D4',
    never_warn: '\u05D0\u05DC \u05EA\u05D6\u05D4\u05D9\u05E8 \u05DB\u05D0\u05DF', always_check: '\u05D1\u05D3\u05D5\u05E7 \u05EA\u05DE\u05D9\u05D3',
    cached_title: '\u05DB\u05D1\u05E8 \u05D1\u05D3\u05E7\u05EA \u05D0\u05EA \u05D4\u05D3\u05E3 \u05D4\u05D6\u05D4', cached_recheck: '\u05D1\u05D3\u05D5\u05E7 \u05E9\u05D5\u05D1',
    looks_safe: '\u05E0\u05E8\u05D0\u05D4 \u05D1\u05D8\u05D5\u05D7', looks_risky: '\u05E0\u05E8\u05D0\u05D4 \u05DE\u05E1\u05D5\u05DB\u05DF', looks_dangerous: '\u05D3\u05E3 \u05DE\u05E1\u05D5\u05DB\u05DF', risk_score_label: '\u05E6\u05D9\u05D5\u05DF \u05E1\u05D9\u05DB\u05D5\u05DF',
    bg_title: '\u05EA\u05D5\u05E6\u05D0\u05D4 \u05DE\u05E1\u05E8\u05D9\u05E7\u05D4 \u05DE\u05D4\u05D9\u05E8\u05D4', bg_show: '\u05D4\u05E6\u05D2 \u05D3\u05D5\u05D7', bg_dismiss: '\u05E1\u05D2\u05D5\u05E8',
    phone_found: '\u05DE\u05E1\u05E4\u05E8\u05D9 \u05D8\u05DC\u05E4\u05D5\u05DF \u05D1\u05D3\u05E3 \u05D4\u05D6\u05D4',
    ask_family: '\u05D1\u05E7\u05E9 \u05DE\u05D4\u05DE\u05E9\u05E4\u05D7\u05D4', report_community: '\u05D3\u05D5\u05D5\u05D7',
    family_sent: '\u05E0\u05E9\u05DC\u05D7 \u05DC\u05D0\u05E4\u05D5\u05D8\u05E8\u05D5\u05E4\u05D5\u05E1 \u05E9\u05DC\u05DA. \u05D4\u05EA\u05E9\u05D5\u05D1\u05D4 \u05E9\u05DC\u05D4\u05DD \u05EA\u05D5\u05E4\u05D9\u05E2 \u05DB\u05D0\u05DF.',
    family_note_label: '\u05D4\u05D5\u05E1\u05E3 \u05D4\u05E2\u05E8\u05D4 \u05DC\u05D0\u05E4\u05D5\u05D8\u05E8\u05D5\u05E4\u05D5\u05E1 (\u05D0\u05D5\u05E4\u05E6\u05D9\u05D5\u05E0\u05DC\u05D9)',
    family_none: '\u05D1\u05E7\u05E9 \u05DE\u05D4\u05DE\u05E9\u05E4\u05D7\u05D4 \u05DC\u05D0 \u05DE\u05D5\u05D2\u05D3\u05E8 \u05D1\u05D7\u05E9\u05D1\u05D5\u05DF \u05E9\u05DC\u05DA.',
    report_sent: '\u05E9\u05D5\u05EA\u05E3 \u05E2\u05DD \u05E7\u05D4\u05D9\u05DC\u05EA Vardin. \u05EA\u05D5\u05D3\u05D4.',
    report_failed: '\u05DC\u05D0 \u05E0\u05D9\u05EA\u05DF \u05DC\u05E9\u05EA\u05E3 \u05DB\u05E2\u05EA.',
    no_history: '\u05D0\u05D9\u05DF \u05E1\u05E8\u05D9\u05E7\u05D5\u05EA \u05E2\u05D3\u05D9\u05D9\u05DF.',
    blocked_note: '\u05D3\u05E3 \u05DE\u05E1\u05D5\u05DB\u05DF', warn_note: '\u05E1\u05D9\u05DE\u05E0\u05D9 \u05D4\u05D5\u05E0\u05D0\u05D4 \u05D7\u05D6\u05E7\u05D9\u05DD'
  },
  es: {
    history: 'Historial', clear_history: 'Borrar historial', back_to_scan: 'Volver',
    never_warn: 'No avisar aqui', always_check: 'Comprobar siempre',
    cached_title: 'Ya revisaste esta pagina', cached_recheck: 'Comprobar de nuevo',
    looks_safe: 'Parece seguro', looks_risky: 'Parece arriesgado', looks_dangerous: 'Pagina peligrosa', risk_score_label: 'Puntuacion de riesgo',
    bg_title: 'Resultado de un escaneo rapido', bg_show: 'Ver informe', bg_dismiss: 'Descartar',
    phone_found: 'Numeros de telefono en esta pagina',
    ask_family: 'Pedir ayuda', report_community: 'Reportar',
    family_sent: 'Enviado a tu tutor. Su respuesta aparecera aqui.',
    family_note_label: 'Anade una nota para tu tutor (opcional)',
    family_none: 'Pedir ayuda no esta configurado en tu cuenta.',
    report_sent: 'Compartido con la comunidad de Vardin. Gracias.',
    report_failed: 'No se pudo compartir ahora mismo.',
    no_history: 'Aun no hay escaneos.',
    blocked_note: 'Pagina peligrosa', warn_note: 'Indicadores de estafa fuertes'
  }
};

(function mergeExtraStrings() {
  for (var lang in I18N_EXTRA) {
    if (!I18N[lang]) continue;
    for (var key in I18N_EXTRA[lang]) I18N[lang][key] = I18N_EXTRA[lang][key];
  }
})();

var G = self.VardinGuard;
var familyContext = null;
var guidanceSeen = {};
var guidanceTimer = null;

function sendMessage(message) {
  return new Promise(function(resolve) {
    try {
      chrome.runtime.sendMessage(message, function(response) {
        if (chrome.runtime.lastError) { resolve(null); return; }
        resolve(response || null);
      });
    } catch (e) { resolve(null); }
  });
}

function activeTab() {
  return new Promise(function(resolve) {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      resolve(tabs && tabs[0] ? tabs[0] : null);
    });
  });
}

function tabHost(tab) {
  try { return new URL(tab.url).hostname; } catch (e) { return ''; }
}

function isWebTab(tab) {
  return !!(tab && tab.url && tab.url.indexOf('http') === 0);
}

// Plain-language verdict, never a technical term.
function verdictWord(entry) {
  if (!entry) return '';
  if (entry.tier === 'block') return t('looks_dangerous');
  if (entry.tier === 'warn') return t('looks_risky');
  if (entry.score >= 36) return t('risk_score_label') + ' ' + entry.score + '/100';
  return t('looks_safe');
}

// Colour of the verdict: red = dangerous, amber = be careful, green = safe.
function verdictClass(entry) {
  if (!entry) return 'unknown';
  if (entry.tier === 'block') return 'danger';
  if (entry.tier === 'warn') return 'caution';
  if (entry.score >= 36) return 'caution';
  return 'safe';
}

// ---------- Site trust: "never warn here" / "always check" ----------
async function loadSiteBar() {
  var bar = document.getElementById('site-bar');
  if (!bar) return;
  var tab = await activeTab();
  if (!isWebTab(tab)) { bar.classList.add('hidden'); return; }
  var host = tabHost(tab);
  if (!host) { bar.classList.add('hidden'); return; }
  document.getElementById('site-host').textContent = host;
  bar.dataset.host = host;
  bar.classList.remove('hidden');
  var res = await sendMessage({ type: 'GET_SITES', host: host });
  if (res) {
    setChipState('trust-btn', !!res.allowed);
    setChipState('watch-btn', !!res.always);
  }
}

function setChipState(id, on) {
  var el = document.getElementById(id);
  if (el) el.classList.toggle('active', !!on);
}

async function toggleSite(kind, chipId) {
  var bar = document.getElementById('site-bar');
  var host = bar ? bar.dataset.host : '';
  if (!host) return;
  var el = document.getElementById(chipId);
  var next = !(el && el.classList.contains('active'));
  await sendMessage({ type: 'SET_SITE', host: host, kind: kind, on: next });
  setChipState(chipId, next);
  // Trusted and watch-list are opposites, so one turns the other off.
  if (next && kind === 'allow') {
    await sendMessage({ type: 'SET_SITE', host: host, kind: 'always', on: false });
    setChipState('watch-btn', false);
  }
  if (next && kind === 'always') {
    await sendMessage({ type: 'SET_SITE', host: host, kind: 'allow', on: false });
    setChipState('trust-btn', false);
  }
}

// ---------- Instant verdict for a page you checked before ----------
async function loadCachedCard() {
  var card = document.getElementById('cached-card');
  if (!card) return;
  var tab = await activeTab();
  if (!isWebTab(tab)) return;
  var res = await sendMessage({ type: 'GET_CACHE', url: tab.url });
  var entry = res && res.entry;
  if (!entry) { card.classList.add('hidden'); return; }
  var when = new Date(entry.ts || Date.now()).toLocaleString();
  card.className = 'cached-card verdict-' + verdictClass(entry);
  card.innerHTML = '<div class="verdict-row"><span class="verdict-dot"></span><span class="verdict-label">' + escapeHtml(verdictWord(entry)) + '</span></div>' +
    '<p class="cached-head">' + t('cached_title') + '</p>' +
    '<p class="cached-when">' + escapeHtml(when) + (entry.summary ? ' \u00B7 ' + escapeHtml(entry.summary) : '') + '</p>' +
    '<div class="cached-actions"><button class="btn-action primary" id="cached-recheck">' + t('cached_recheck') + '</button></div>';
  var btn = document.getElementById('cached-recheck');
  if (btn) btn.addEventListener('click', scanPage);
}

// ---------- Result waiting from a right-click / shortcut scan ----------
async function loadPendingCard() {
  var card = document.getElementById('bg-card');
  if (!card) return;
  var res = await sendMessage({ type: 'GET_PENDING' });
  var pending = res && res.pending;
  if (!pending || !pending.data) return;
  var entry = pending.entry || {};
  card.className = 'cached-card verdict-' + verdictClass(entry);
  card.innerHTML = '<div class="verdict-row"><span class="verdict-dot"></span><span class="verdict-label">' + escapeHtml(verdictWord(entry)) + '</span></div>' +
    '<p class="cached-head">' + t('bg_title') + '</p>' +
    '<p class="cached-when">' + escapeHtml(entry.url || '') + '</p>' +
    '<div class="cached-actions">' +
    '<button class="btn-action primary" id="bg-show">' + t('bg_show') + '</button>' +
    '<button class="btn-action" id="bg-dismiss">' + t('bg_dismiss') + '</button>' +
    '</div>';
  var show = document.getElementById('bg-show');
  if (show) show.addEventListener('click', function() {
    displayResults(pending.data, pending.data.answer_type || 'detailed');
    card.classList.add('hidden');
  });
  var dismiss = document.getElementById('bg-dismiss');
  if (dismiss) dismiss.addEventListener('click', function() {
    sendMessage({ type: 'CLEAR_PENDING' });
    card.classList.add('hidden');
  });
}

// ---------- Phone numbers found on the page ----------
async function loadPhoneChips() {
  var wrap = document.getElementById('phone-chips');
  if (!wrap) return;
  var tab = await activeTab();
  if (!isWebTab(tab) || typeof tab.id !== 'number') return;
  try {
    chrome.tabs.sendMessage(tab.id, { type: 'VARDIN_GET_PHONES' }, function(response) {
      if (chrome.runtime.lastError) return;
      var phones = response && response.phones;
      if (!phones || !phones.length) return;
      var html = '<p class="phone-chips-label">' + t('phone_found') + '</p><div class="phone-chip-row">';
      for (var i = 0; i < phones.length; i++) {
        html += '<button class="phone-chip" data-number="' + escapeHtml(phones[i].digits) + '">' + escapeHtml(phones[i].display) + '</button>';
      }
      html += '</div>';
      wrap.innerHTML = html;
      wrap.classList.remove('hidden');
    });
  } catch (e) {}
}

// ---------- Ask family + guardian guidance ----------
async function vardinFetch(fn, payload) {
  var response = await fetch(APP_BASE + '/api/apps/' + appId + '/functions/' + fn, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken, 'X-App-Id': appId || '' },
    body: JSON.stringify(payload || {})
  });
  var data = await response.json().catch(function() { return {}; });
  return { ok: response.ok, status: response.status, data: data };
}

async function loadFamilyContext() {
  if (!authToken || !appId) return;
  try {
    var res = await vardinFetch('getFamilyView', {});
    if (!res.ok) return;
    var memberships = (res.data && res.data.memberships) || [];
    if (!memberships.length) return;
    var primary = memberships[0];
    familyContext = { member_id: primary.senior_record_id, guardian_name: primary.guardian_name || 'Your guardian' };
    applyGuidance((res.data && res.data.alerts) || []);
    if (guidanceTimer) clearInterval(guidanceTimer);
    var polls = 0;
    // Short-lived popup: poll while open so a guardian reply shows up here.
    guidanceTimer = setInterval(function() {
      polls += 1;
      if (polls > 6) { clearInterval(guidanceTimer); guidanceTimer = null; return; }
      refreshGuidance();
    }, 20000);
  } catch (e) {}
}

async function refreshGuidance() {
  try {
    var res = await vardinFetch('getFamilyView', {});
    if (res.ok && res.data) applyGuidance(res.data.alerts || []);
  } catch (e) {}
}

function applyGuidance(alerts) {
  for (var i = 0; i < alerts.length; i++) {
    var a = alerts[i];
    if (!a || !a.id || a.status !== 'resolved') continue;
    if (guidanceSeen[a.id]) continue;
    guidanceSeen[a.id] = true;
    if (a.guardian_note || a.guardian_action) showGuidance(a);
  }
}

function showGuidance(alert) {
  var resultsDiv = document.getElementById('results');
  if (!resultsDiv) return;
  var action = alert.guardian_action ? String(alert.guardian_action).replace(/_/g, ' ') : '';
  var el = document.createElement('div');
  el.className = 'family-note';
  el.innerHTML = '<strong>' + escapeHtml(familyContext ? familyContext.guardian_name : 'Your guardian') + '</strong>' +
    escapeHtml(alert.guardian_note || ('Guidance: ' + action));
  resultsDiv.classList.remove('hidden');
  resultsDiv.insertBefore(el, resultsDiv.firstChild);
}

function scanExcerpt() {
  var a = lastAnalysis || {};
  var parts = [];
  if (lastScanInfo && lastScanInfo.scanned_url) parts.push(lastScanInfo.scanned_url);
  if (a.explanation) parts.push(a.explanation);
  if (a.summary) parts.push(a.summary);
  if (a.verdict) parts.push(a.verdict);
  return (parts.join(' - ') || 'Scan result from the Vardin extension').slice(0, 500);
}

async function askFamily() {
  if (!familyContext) {
    window.alert(t('family_none'));
    return;
  }
  var note = window.prompt(t('family_note_label'), '');
  if (note === null) return;
  var a = lastAnalysis || {};
  var res = await vardinFetch('createFamilyAlert', {
    analysis_type: 'scam_analysis',
    member_id: familyContext.member_id,
    threat_excerpt: scanExcerpt(),
    risk_level: a.risk_level || 'medium',
    scam_type: a.scam_category || 'other',
    member_note: note.trim() || undefined
  });
  var resultsDiv = document.getElementById('results');
  if (!resultsDiv) return;
  var el = document.createElement('div');
  el.className = 'family-note';
  el.innerHTML = '<strong>' + escapeHtml(familyContext.guardian_name) + '</strong>' +
    escapeHtml(res.ok ? t('family_sent') : ((res.data && res.data.error) || t('report_failed')));
  resultsDiv.insertBefore(el, resultsDiv.firstChild);
}

// ---------- Report to the community feed ----------
function communityScamType(category) {
  var c = String(category || '').toLowerCase();
  if (c.indexOf('phish') !== -1 || c.indexOf('email') !== -1) return 'phishing_email';
  if (c.indexOf('sms') !== -1 || c.indexOf('text') !== -1) return 'smishing';
  if (c.indexOf('romance') !== -1) return 'romance';
  if (c.indexOf('crypto') !== -1 || c.indexOf('invest') !== -1 || c.indexOf('wallet') !== -1) return 'crypto_investment';
  if (c.indexOf('market') !== -1 || c.indexOf('shop') !== -1 || c.indexOf('retail') !== -1) return 'marketplace';
  if (c.indexOf('tech') !== -1 || c.indexOf('support') !== -1) return 'tech_support';
  if (c.indexOf('job') !== -1 || c.indexOf('employ') !== -1) return 'fake_job';
  if (c.indexOf('deliver') !== -1 || c.indexOf('parcel') !== -1) return 'delivery';
  if (c.indexOf('lottery') !== -1 || c.indexOf('prize') !== -1) return 'lottery_prize';
  if (c.indexOf('bank') !== -1) return 'bank_impersonation';
  if (c.indexOf('government') !== -1 || c.indexOf('tax') !== -1 || c.indexOf('police') !== -1) return 'government_impersonation';
  return 'other';
}

async function reportCommunity() {
  var a = lastAnalysis || {};
  if (!a.explanation && !a.summary && !a.verdict) return;
  var scannedUrl = (lastScanInfo && lastScanInfo.scanned_url) || '';
  var host = '';
  try { host = new URL(scannedUrl).hostname; } catch (e) { host = ''; }
  var story = scanExcerpt();
  if (scannedUrl) story += '\n\nLink: ' + scannedUrl;
  var res = await vardinFetch('reportScamToCommunity', {
    title: (host ? 'Scam reported on ' + host : 'Scam reported from the browser').slice(0, 120),
    story: story.slice(0, 4000),
    scam_type: communityScamType(a.scam_category),
    anonymous: false
  });
  var resultsDiv = document.getElementById('results');
  if (!resultsDiv) return;
  var el = document.createElement('div');
  el.className = 'family-note';
  el.textContent = res.ok ? t('report_sent') : t('report_failed');
  resultsDiv.insertBefore(el, resultsDiv.firstChild);
}

// ---------- Scan history ----------
function showHistory() {
  showView('history');
  renderHistory();
}

async function renderHistory() {
  var list = document.getElementById('history-list');
  if (!list) return;
  var res = await sendMessage({ type: 'GET_HISTORY' });
  var history = (res && res.history) || [];
  if (!history.length) {
    list.innerHTML = '<p class="history-empty">' + t('no_history') + '</p>';
    return;
  }
  var html = '';
  for (var i = 0; i < history.length; i++) {
    var h = history[i];
    html += '<div class="history-item verdict-' + verdictClass(h) + '">' +
      '<span class="history-url">' + escapeHtml(h.url || '') + '</span>' +
      '<span class="history-verdict">' + escapeHtml(verdictWord(h)) + '</span>' +
      '<span class="history-meta">' + escapeHtml(new Date(h.ts || Date.now()).toLocaleString()) + '</span></div>';
  }
  list.innerHTML = html;
}

// ---------- After a manual scan: cache, history, badge, page reaction ----------
async function afterScan(data, url, tab) {
  var tier = 'none';
  try { if (G) tier = G.tierFromResponse(data); } catch (e) {}
  var analysis = (data && data.analysis) || {};
  var summary = analysis.summary || analysis.explanation || analysis.verdict || '';
  if (tab && typeof tab.id === 'number') {
    try {
      chrome.tabs.sendMessage(tab.id, {
        type: 'VARDIN_APPLY_TIER',
        tier: tier,
        score: Number(analysis.risk_score) || 0,
        summary: String(summary).slice(0, 300)
      }, function() { if (chrome.runtime.lastError) {} });
    } catch (e) {}
  }
  await sendMessage({ type: 'RECORD_SCAN', url: url, data: data, tabId: tab ? tab.id : null });
  loadCachedCard();
}
`;