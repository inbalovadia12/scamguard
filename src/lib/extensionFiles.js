// Extension file contents for the Vardin Chrome Extension v2.0
// Packaged by the downloadExtension backend function into a ZIP.
// Popup source imported from extensionPopupSource.js

import { POPUP_HTML, POPUP_JS } from '@/lib/extensionPopupSource';

export const EXTENSION_FILES = {
  'manifest.json': String.raw`{
  "manifest_version": 3,
  "name": "Vardin Scam Scanner",
  "version": "2.0.0",
  "description": "AI-powered scam detection and real-time protection for any webpage.",
  "permissions": ["activeTab", "scripting", "storage", "tabs"],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://vardin.base44.app/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    },
    {
      "matches": ["<all_urls>"],
      "js": ["protection.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "Vardin Scam Scanner",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://vardin.base44.app;"
  }
}
`,
  'background.js': String.raw`// Vardin Extension - Background Service Worker v2.0
// Handles: auth token storage, language sync, auto-scan, badge, message routing

var APP_BASE = 'https://vardin.base44.app';
var currentLang = 'en';

function isValidSender(sender) {
  return sender.id === chrome.runtime.id;
}

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (!isValidSender(sender)) {
    sendResponse({ error: 'Unauthorized sender' });
    return false;
  }

  if (message.type === 'AUTH_TOKEN') {
    chrome.storage.local.set({
      authToken: message.token || null,
      appId: message.appId || null,
      authTimestamp: Date.now()
    }, function() {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'AUTH_LOGOUT') {
    chrome.storage.local.remove(['authToken', 'appId', 'authTimestamp'], function() {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'LANGUAGE_SYNC') {
    chrome.storage.local.set({ lang: message.lang });
    currentLang = message.lang;
    sendResponse({ success: true });
    return false;
  }

  if (message.type === 'GET_AUTH') {
    chrome.storage.local.get(['authToken', 'appId'], function(result) {
      sendResponse(result);
    });
    return true;
  }

  if (message.type === 'CHECK_PAGE_RISK') {
    var key = 'risk_' + sender.tab.id;
    chrome.storage.local.get([key], function(result) {
      sendResponse(result[key] || { risky: false });
    });
    return true;
  }

  return false;
});

// === Auto-scan on page navigation ===
var scanTimeout = null;

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url || tab.url.indexOf('chrome://') === 0 || tab.url.indexOf('chrome-extension://') === 0) return;

  chrome.storage.local.get(['autoScan', 'authToken', 'appId', 'lang'], function(result) {
    if (!result.autoScan || !result.authToken || !result.appId) return;
    if (result.lang) currentLang = result.lang;

    // Clear previous badge
    chrome.action.setBadgeText({ text: '', tabId: tabId });

    if (scanTimeout) clearTimeout(scanTimeout);
    scanTimeout = setTimeout(function() {
      autoScanUrl(tabId, tab.url, result.authToken, result.appId);
    }, 3000);
  });
});

async function autoScanUrl(tabId, url, token, appId) {
  try {
    var response = await fetch(APP_BASE + '/api/apps/' + appId + '/functions/scanWebpage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        'X-App-Id': appId
      },
      body: JSON.stringify({
        page_text: '',
        screenshot_data_url: '',
        page_url: url,
        options: {
          scan_type: 'url',
          answer_type: 'risk_score',
          language: currentLang
        }
      })
    });

    if (!response.ok) return;
    var data = await response.json();
    var analysis = data.analysis || {};
    var score = analysis.risk_score || 0;
    var level = analysis.risk_level || 'low';

    // Set badge
    if (score >= 70) {
      chrome.action.setBadgeText({ text: '!', tabId: tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444', tabId: tabId });
    } else if (score >= 40) {
      chrome.action.setBadgeText({ text: '?', tabId: tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#f59e0b', tabId: tabId });
    } else {
      chrome.action.setBadgeText({ text: '', tabId: tabId });
    }

    // Store risk status for content script
    var riskKey = 'risk_' + tabId;
    chrome.storage.local.set({
      [riskKey]: { score: score, level: level, url: url, risky: score >= 40 }
    });
  } catch (_e) {
    // Silent fail for auto-scan
  }
}

// Clean up risk data when tab is closed
chrome.tabs.onRemoved.addListener(function(tabId) {
  var key = 'risk_' + tabId;
  chrome.storage.local.remove(key);
});

chrome.runtime.onInstalled.addListener(function() {
  console.log('Vardin Scam Scanner v2.0 installed.');
});
`,
  'content.js': String.raw`// Vardin Extension - Content Script (runs on vardin.base44.app only)
// Extracts auth token and language preference, relays to background

var TOKEN_KEY = 'base44_access_token';
var APP_ID_KEY = 'base44_app_id';
var LANG_KEY = 'vardin_language';

function extractAuth() {
  try {
    return {
      token: localStorage.getItem(TOKEN_KEY),
      appId: localStorage.getItem(APP_ID_KEY)
    };
  } catch (e) {
    return { token: null, appId: null };
  }
}

function sendAuthToBackground() {
  var auth = extractAuth();
  if (auth.token) {
    chrome.runtime.sendMessage({ type: 'AUTH_TOKEN', token: auth.token, appId: auth.appId });
  } else {
    chrome.runtime.sendMessage({ type: 'AUTH_LOGOUT' });
  }
}

function syncLanguage() {
  try {
    var lang = localStorage.getItem(LANG_KEY);
    if (lang) {
      chrome.runtime.sendMessage({ type: 'LANGUAGE_SYNC', lang: lang });
    }
  } catch (e) {}
}

// Send initial state
sendAuthToBackground();
syncLanguage();

// Poll for token changes (detect login/logout)
var lastToken = localStorage.getItem(TOKEN_KEY);
var lastLang = localStorage.getItem(LANG_KEY);
setInterval(function() {
  var currentToken = localStorage.getItem(TOKEN_KEY);
  var currentLangVal = localStorage.getItem(LANG_KEY);
  if (currentToken !== lastToken) {
    lastToken = currentToken;
    sendAuthToBackground();
  }
  if (currentLangVal !== lastLang) {
    lastLang = currentLangVal;
    syncLanguage();
  }
}, 3000);
`,
  'protection.js': String.raw`// Vardin Extension - Protection Content Script (runs on all URLs)
// Features: form detection warnings, clipboard monitoring

(function() {
  // Don't run on Vardin's own domain or Chrome internal pages
  if (window.location.hostname.indexOf('vardin') !== -1) return;
  if (window.location.protocol === 'chrome:' || window.location.protocol === 'chrome-extension:') return;

  // === Inject styles ===
  var style = document.createElement('style');
  style.textContent = [
    '.vardin-banner { position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647; padding: 10px 16px; background: linear-gradient(135deg, #dc2626, #b91c1c); color: white; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; gap: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }',
    '.vardin-banner .vardin-close { margin-left: auto; cursor: pointer; opacity: 0.8; background: none; border: none; color: white; font-size: 18px; }',
    '.vardin-banner .vardin-close:hover { opacity: 1; }',
    '.vardin-paste-warning { position: fixed; bottom: 16px; right: 16px; z-index: 2147483647; padding: 12px 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; color: #991b1b; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; box-shadow: 0 4px 12px rgba(0,0,0,0.15); max-width: 300px; }'
  ].join('\n');
  document.head.appendChild(style);

  // === Suspicious URL patterns ===
  function isSuspiciousUrl(url) {
    if (!url) return false;
    var lower = url.toLowerCase();
    // IP address instead of domain
    if (/https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(lower)) return 'suspicious';
    // Known phishing keywords in domain
    var phishingWords = ['login', 'signin', 'verify', 'account', 'secure', 'update', 'confirm', 'wallet', 'banking', 'password'];
    var hasPhishWord = phishingWords.some(function(w) { return lower.indexOf(w) !== -1; });
    // Suspicious TLDs
    var suspiciousTlds = ['.tk', '.ml', '.ga', '.cf', '.gq', '.top', '.xyz', '.click', '.country', '.stream'];
    var hasSuspiciousTld = suspiciousTlds.some(function(t) { return lower.indexOf(t) !== -1; });
    // Excessive subdomains
    var subdomainCount = (lower.match(/\./g) || []).length;
    if (subdomainCount > 4) return 'suspicious';
    if (hasPhishWord && hasSuspiciousTld) return 'danger';
    if (hasSuspiciousTld) return 'suspicious';
    return null;
  }

  // === Form detection: warn on risky pages with password/card inputs ===
  function checkForms() {
    var passwordInputs = document.querySelectorAll('input[type="password"]');
    var cardInputs = document.querySelectorAll('input[autocomplete*="cc"], input[name*="card"], input[name*="credit"], input[id*="card"], input[id*="credit"], input[inputmode="numeric"][name*="number"]');
    if (passwordInputs.length === 0 && cardInputs.length === 0) return;

    chrome.runtime.sendMessage({ type: 'CHECK_PAGE_RISK' }, function(response) {
      if (chrome.runtime.lastError) return;
      if (response && response.risky) {
        showWarningBanner(response.score || 0, response.level || 'high');
      }
    });
  }

  function showWarningBanner(score, level) {
    if (document.getElementById('vardin-warning-banner')) return;
    var banner = document.createElement('div');
    banner.id = 'vardin-warning-banner';
    banner.className = 'vardin-banner';
    banner.innerHTML = '<span>\u26A0\uFE0F <strong>Vardin Warning:</strong> This website has multiple scam indicators (risk score: ' + score + '/100). Are you sure you want to enter personal information?</span><button class="vardin-close">&times;</button>';
    document.body.insertBefore(banner, document.body.firstChild);
    banner.querySelector('.vardin-close').addEventListener('click', function() { banner.remove(); });
    // Adjust body padding
    document.body.style.paddingTop = (document.body.style.paddingTop ? parseInt(document.body.style.paddingTop) : 0) + 50 + 'px';
  }

  // Check forms after a short delay (let page settle)
  setTimeout(checkForms, 2000);

  // Also check on DOM mutations (dynamic forms)
  var formObserver = new MutationObserver(function() {
    checkForms();
  });
  formObserver.observe(document.body, { childList: true, subtree: true });

  // === Clipboard / paste monitoring ===
  function isCryptoAddress(text) {
    if (!text) return false;
    // Bitcoin
    if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(text.trim())) return true;
    // Bitcoin Bech32
    if (/^bc1[a-z0-9]{20,40}$/i.test(text.trim())) return true;
    // Ethereum
    if (/^0x[a-fA-F0-9]{40}$/.test(text.trim())) return true;
    return false;
  }

  document.addEventListener('paste', function(e) {
    var text = '';
    if (e.clipboardData) {
      text = e.clipboardData.getData('text') || '';
    }
    if (!text) return;

    var warning = null;
    if (isCryptoAddress(text)) {
      warning = '\u26A0\uFE0F Vardin: You pasted a crypto wallet address. Verify you trust the source \u2014 crypto transactions cannot be reversed.';
    } else if (isSuspiciousUrl(text)) {
      warning = '\u26A0\uFE0F Vardin: You pasted a suspicious URL. Do not enter personal information on that site.';
    }

    if (warning) {
      showPasteWarning(warning);
    }
  });

  function showPasteWarning(text) {
    var existing = document.getElementById('vardin-paste-warning');
    if (existing) existing.remove();
    var el = document.createElement('div');
    el.id = 'vardin-paste-warning';
    el.className = 'vardin-paste-warning';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(function() { if (el.parentNode) el.remove(); }, 6000);
  }
})();
`,
  'popup.html': POPUP_HTML,
  'popup.js': POPUP_JS,
  'styles.css': String.raw`* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  width: 380px;
  max-height: 600px;
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
  background: #f8fafc;
  color: #1e293b;
}

@media (prefers-color-scheme: dark) {
  body { background: #0f172a; color: #e2e8f0; }
  .result-card { background: #1e293b !important; border-color: #334155 !important; color: #e2e8f0; }
  .result-card.danger { background: #450a0a !important; border-color: #7f1d1d !important; }
  .result-card.warning { background: #422006 !important; border-color: #78350f !important; }
  .result-card.safe { background: #052e16 !important; border-color: #14532d !important; }
  .field select, .field input, .field textarea { background: #1e293b !important; color: #e2e8f0 !important; border-color: #334155 !important; }
  .drop-zone { background: #1e293b !important; border-color: #334155 !important; color: #94a3b8 !important; }
  .vt-badge { background: #1e293b !important; }
  .qr-dest-card { background: #052e16 !important; border-color: #14532d !important; }
  .qr-value { background: #1e293b !important; border-color: #334155 !important; color: #cbd5e1 !important; }
  .qr-value a { color: #2dd4bf !important; }
  .section-text, .verdict-text, .flag-list li, .action-list li { color: #cbd5e1 !important; }
  .section-label { color: #94a3b8 !important; }
}

.container { padding: 16px; max-height: 600px; overflow-y: auto; }
.hidden { display: none !important; }

header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.header-right { display: flex; align-items: center; gap: 6px; }

.lang-select { font-size: 11px; padding: 3px 6px; border: 1px solid #e2e8f0; border-radius: 6px; background: white; color: #475569; outline: none; cursor: pointer; font-family: inherit; }
.lang-select:focus { border-color: #0f766e; }

.auto-scan-toggle { position: relative; width: 28px; height: 16px; display: inline-block; }
.auto-scan-toggle input { opacity: 0; width: 0; height: 0; }
.toggle-slider { position: absolute; inset: 0; background: #cbd5e1; border-radius: 10px; transition: 0.2s; cursor: pointer; }
.toggle-slider::before { content: ''; position: absolute; width: 12px; height: 12px; left: 2px; top: 2px; background: white; border-radius: 50%; transition: 0.2s; }
.auto-scan-toggle input:checked + .toggle-slider { background: #0f766e; }
.auto-scan-toggle input:checked + .toggle-slider::before { transform: translateX(12px); }

html[dir="rtl"] body { direction: rtl; text-align: right; }
html[dir="rtl"] .view h2 { text-align: center; }
html[dir="rtl"] .flag-list li, html[dir="rtl"] .action-list li { padding-left: 0; padding-right: 18px; }
html[dir="rtl"] .flag-list li::before, html[dir="rtl"] .action-list li::before { left: auto; right: 0; }

.logo { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 18px; color: #0f766e; }
.badge { font-size: 10px; font-weight: 700; letter-spacing: 0.5px; padding: 3px 8px; border-radius: 6px; background: #ccfbf1; color: #0f766e; }

.view { display: flex; flex-direction: column; gap: 12px; }
.icon-wrap { display: flex; justify-content: center; margin: 8px 0 4px; }
.icon-wrap.lock { color: #64748b; }
.icon-wrap.crown { color: #d97706; }
.view h2 { font-size: 16px; font-weight: 700; text-align: center; }
.view p { font-size: 13px; color: #64748b; text-align: center; line-height: 1.5; }
.center-text { text-align: center; }

.btn-primary { width: 100%; padding: 12px; background: #0f766e; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.2s, transform 0.1s; }
.btn-primary:hover:not(:disabled) { background: #0d6963; }
.btn-primary:active:not(:disabled) { transform: scale(0.98); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-secondary { width: 100%; padding: 10px; background: #f1f5f9; color: #0f766e; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; }
.btn-secondary:hover { background: #e2e8f0; }

.field { display: flex; flex-direction: column; gap: 4px; }
.field label { font-size: 12px; font-weight: 600; color: #475569; }
.optional { font-weight: 400; color: #94a3b8; }
.field select, .field input, .field textarea { width: 100%; padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; background: white; color: #1e293b; outline: none; transition: border-color 0.2s; font-family: inherit; }
.field select:focus, .field input:focus, .field textarea:focus { border-color: #0f766e; box-shadow: 0 0 0 2px rgba(15, 118, 110, 0.1); }
.field textarea { resize: vertical; min-height: 60px; }

.drop-zone { border: 2px dashed #cbd5e1; border-radius: 10px; padding: 16px; text-align: center; cursor: pointer; transition: border-color 0.2s, background 0.2s; }
.drop-zone:hover { border-color: #0f766e; background: #f0fdfa; }
.drop-zone.drag-over { border-color: #0f766e; background: #ccfbf1; }
.drop-zone p { font-size: 12px; color: #64748b; }

.results { margin-top: 4px; }
.loading { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 24px; text-align: center; color: #64748b; font-size: 13px; }
.spinner { width: 32px; height: 32px; border: 3px solid #e2e8f0; border-top-color: #0f766e; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.vt-badge { padding: 8px 10px; border-radius: 8px; font-size: 11px; background: #f0f9ff; border: 1px solid #bae6fd; color: #075985; margin-bottom: 8px; }
.vt-badge.danger { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
.vt-badge.safe { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }

.qr-dest-card { background: #f0fdfa; border: 2px solid #99f6e4; border-radius: 12px; padding: 12px; margin-bottom: 8px; display: flex; flex-direction: column; gap: 6px; }
.qr-dest-title { font-size: 14px; font-weight: 700; color: #0f766e; }
.qr-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-top: 4px; }
.qr-value { font-size: 12px; color: #1e293b; word-break: break-all; line-height: 1.4; background: white; padding: 6px 8px; border-radius: 6px; border: 1px solid #e2e8f0; }
.qr-value a { color: #0f766e; text-decoration: none; }
.qr-value a:hover { text-decoration: underline; }

.result-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.result-card.danger { border-color: #fecaca; background: #fef2f2; }
.result-card.warning { border-color: #fde68a; background: #fffbeb; }
.result-card.safe { border-color: #bbf7d0; background: #f0fdf4; }

.result-header { display: flex; align-items: center; justify-content: space-between; }
.verdict-badge { text-align: center; padding: 8px; border-radius: 8px; font-weight: 700; font-size: 14px; }
.verdict-badge.danger { background: #fee2e2; color: #991b1b; }
.verdict-badge.safe { background: #dcfce7; color: #166534; }
.verdict-text { font-size: 13px; color: #334155; line-height: 1.5; }
.confidence { font-size: 11px; color: #64748b; text-align: center; }

.score-display { text-align: center; padding: 8px; }
.score-display.small { padding: 0; }
.score-number { font-size: 32px; font-weight: 800; color: #0f766e; }
.score-display.small .score-number { font-size: 24px; }
.score-max { font-size: 14px; color: #94a3b8; font-weight: 600; }

.risk-bar { width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }
.risk-fill { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
.risk-fill.danger { background: #ef4444; }
.risk-fill.warning { background: #f59e0b; }
.risk-fill.safe { background: #22c55e; }

.risk-level { text-align: center; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; }
.risk-level.danger { color: #dc2626; }
.risk-level.warning { color: #d97706; }
.risk-level.safe { color: #16a34a; }

.summary { font-size: 12px; color: #475569; text-align: center; line-height: 1.4; }
.card-title { font-weight: 700; font-size: 14px; text-align: center; }

.flag-list, .action-list { list-style: none; display: flex; flex-direction: column; gap: 6px; }
.flag-list li { font-size: 12px; color: #334155; padding-left: 18px; position: relative; line-height: 1.4; }
.flag-list li::before { content: '\1F6A9'; position: absolute; left: 0; top: 0; }
.action-list li { font-size: 12px; color: #334155; padding-left: 18px; position: relative; line-height: 1.4; }
.action-list li::before { content: '\2713'; position: absolute; left: 0; top: 0; color: #0f766e; font-weight: 700; }

.section { display: flex; flex-direction: column; gap: 4px; }
.section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; }
.section-text { font-size: 12px; color: #334155; line-height: 1.5; }

.source-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.source-tag { font-size: 10px; padding: 2px 6px; background: #f1f5f9; border-radius: 4px; color: #475569; }

.empty { font-size: 13px; color: #16a34a; text-align: center; }
.error-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 12px; text-align: center; font-size: 13px; color: #991b1b; }
.error-sub { font-size: 12px; color: #64748b; margin-top: 4px; font-weight: 400; }

.credits-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 8px; font-size: 12px; }
.credits-remaining { font-weight: 600; color: #0f766e; }
.credits-cost { color: #64748b; font-size: 11px; }

.actions-bar { display: flex; gap: 4px; margin-top: 8px; flex-wrap: wrap; }
.btn-action { flex: 1; min-width: 60px; padding: 6px 8px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 11px; font-weight: 600; color: #475569; cursor: pointer; transition: background 0.2s; }
.btn-action:hover { background: #e2e8f0; }

.timestamp { font-size: 10px; color: #94a3b8; text-align: center; margin-top: 4px; }
`,
};

export const README_CONTENT = `Vardin Scam Scanner - Chrome Extension v2.0
==============================================

FEATURES
- Page Analysis: Scan page text, screenshot, or both
- URL Reputation: VirusTotal + AI analysis of any URL
- Screenshot Scan: Capture or upload screenshots for analysis
- QR Code Analysis: Upload QR images for decoding and risk assessment
- Email Analysis: Detect phishing, fake invoices, spoofed senders
- Chat/SMS Analysis: Detect romance, investment, crypto, tech support scams
- Marketplace Analysis: Detect fake sellers, unrealistic prices, payment scams
- File Analysis: Analyze PDF, DOC, XLS, PPT, TXT, CSV, ZIP, images
- Auto-Scan: Automatically scan pages on navigation (opt-in)
- Before-Action Warnings: Alerts on risky pages with password/card inputs
- Clipboard Protection: Warns when pasting crypto addresses or suspicious URLs
- Full i18n: English, Hebrew (RTL), Spanish

INSTALLATION
1. Extract all files from this ZIP into a folder (e.g., "vardin-extension")
2. Open Google Chrome and go to: chrome://extensions
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked" and select your extracted folder
5. The Vardin icon will appear in your toolbar — pin it for easy access

USAGE
1. Navigate to any webpage you want to check
2. Click the Vardin extension icon
3. If not logged in, click "Open Vardin Login" and log in at vardin.base44.app
4. The extension auto-detects your login — no copy-paste needed
5. Choose your scan type and result type
6. Click "Scan" to get an instant AI-powered scam analysis
7. Enable Auto-Scan to automatically check pages you visit

SCAN TYPES
- Page Analysis: Extracts text and/or screenshot from the current page
- URL Reputation: Checks the URL with VirusTotal + AI analysis
- Screenshot: Capture or upload a screenshot for visual analysis
- QR Code: Upload a QR image for decoding and URL risk assessment
- Email: Paste email content for phishing/invoice/spoofing detection
- Chat/SMS: Paste messages for romance/investment/crypto scam detection
- Marketplace: Paste listings for fake seller/price/payment scam detection
- File: Upload documents for phishing language and embedded URL analysis

PROTECTION FEATURES (automatic)
- Form Warning: If you're on a risky page with password/card inputs, a warning banner appears
- Clipboard: If you paste a crypto wallet address or suspicious URL, you get a warning
- Auto-Scan Badge: When enabled, the extension badge shows risk level (green/yellow/red)

REQUIREMENTS
- A Vardin Premium or Plus subscription
- Google Chrome (or any Chromium-based browser)

SECURITY
- Auth token stored in chrome.storage.local (never shared)
- Premium status verified server-side on every scan
- All communication uses HTTPS
- No API keys or secrets in extension files
- Strict Content Security Policy (CSP)
- All displayed content is XSS-escaped
- VirusTotal API key kept on backend only

SUPPORT
Visit https://vardin.base44.app for help and resources.
`;