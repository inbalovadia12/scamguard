// Extension file contents embedded as String.raw to preserve all escape sequences exactly.
// These are sent to the downloadExtension backend function which packages them into a ZIP.

export const EXTENSION_FILES = {
  'manifest.json': String.raw`{
  "manifest_version": 3,
  "name": "Vardin Scam Scanner",
  "version": "1.0.0",
  "description": "AI-powered scam detection for any webpage. Premium feature.",
  "permissions": ["activeTab", "scripting", "storage"],
  "host_permissions": ["https://vardin.base44.app/*"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://vardin.base44.app/*"],
      "js": ["content.js"],
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
  'background.js': String.raw`// Vardin Extension - Background Service Worker (Manifest V3)
// Handles auth token storage and message routing between content script and popup

// Validate that messages come from our own extension
function isValidSender(sender) {
  return sender.id === chrome.runtime.id;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Reject messages from unknown senders (message spoofing protection)
  if (!isValidSender(sender)) {
    sendResponse({ error: 'Unauthorized sender' });
    return false;
  }

  // Content script sends auth token after detecting login on vardin.base44.app
  if (message.type === 'AUTH_TOKEN') {
    chrome.storage.local.set({
      authToken: message.token || null,
      appId: message.appId || null,
      functionsVersion: message.functionsVersion || null,
      authTimestamp: Date.now()
    }, () => {
      sendResponse({ success: true });
    });
    return true; // Keep channel open for async response
  }

  // Content script signals logout (token removed from localStorage)
  if (message.type === 'AUTH_LOGOUT') {
    chrome.storage.local.remove(['authToken', 'appId', 'functionsVersion', 'authTimestamp'], () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // Popup requests stored auth data
  if (message.type === 'GET_AUTH') {
    chrome.storage.local.get(['authToken', 'appId', 'functionsVersion'], (result) => {
      sendResponse(result);
    });
    return true;
  }

  return false;
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('Vardin Scam Scanner installed.');
});
`,
  'content.js': String.raw`// Vardin Extension - Content Script
// Runs on https://vardin.base44.app/* to extract the user's auth token from localStorage
// and relay it to the background service worker for storage in chrome.storage.local

var TOKEN_KEY = 'base44_access_token';
var APP_ID_KEY = 'base44_app_id';
var FUNCTIONS_VERSION_KEY = 'base44_functions_version';

function extractAuth() {
  try {
    return {
      token: localStorage.getItem(TOKEN_KEY),
      appId: localStorage.getItem(APP_ID_KEY),
      functionsVersion: localStorage.getItem(FUNCTIONS_VERSION_KEY)
    };
  } catch (e) {
    return { token: null, appId: null, functionsVersion: null };
  }
}

function sendAuthToBackground() {
  var auth = extractAuth();
  if (auth.token) {
    chrome.runtime.sendMessage({ type: 'AUTH_TOKEN', token: auth.token, appId: auth.appId, functionsVersion: auth.functionsVersion });
  } else {
    // Token not present — user is logged out
    chrome.runtime.sendMessage({ type: 'AUTH_LOGOUT' });
  }
}

// Send initial auth state on script load
sendAuthToBackground();

// Poll for token changes every 3 seconds (detect login/logout while popup is closed or tab is open)
var lastToken = localStorage.getItem(TOKEN_KEY);
setInterval(function() {
  var currentToken = localStorage.getItem(TOKEN_KEY);
  if (currentToken !== lastToken) {
    lastToken = currentToken;
    sendAuthToBackground();
  }
}, 3000);
`,
  'popup.html': String.raw`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="container">
    <header>
      <div class="logo">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="m9 12 2 2 4-4"/>
        </svg>
        <span>Vardin</span>
      </div>
      <span id="plan-badge" class="badge hidden"></span>
    </header>

    <!-- Loading View -->
    <div id="loading-view" class="view">
      <div class="spinner"></div>
      <p class="center-text">Checking access...</p>
    </div>

    <!-- Login View -->
    <div id="login-view" class="view hidden">
      <div class="icon-wrap lock">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
      <h2>Connect Your Account</h2>
      <p>Log in to Vardin on your browser to start scanning webpages for scams.</p>
      <button id="login-btn" class="btn-primary">Open Vardin Login</button>
    </div>

    <!-- Upgrade View -->
    <div id="upgrade-view" class="view hidden">
      <div class="icon-wrap crown">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/>
          <path d="M5 21h14"/>
        </svg>
      </div>
      <h2>Premium Required</h2>
      <p>The Vardin Chrome extension requires a Premium subscription. Upgrade to unlock AI-powered scam scanning on any webpage.</p>
      <button id="upgrade-btn" class="btn-primary">Upgrade to Premium</button>
    </div>

    <!-- Scan View -->
    <div id="scan-view" class="view hidden">
      <div class="field">
        <label for="scan-mode">Scan Mode</label>
        <select id="scan-mode">
          <option value="text">Page Text</option>
          <option value="screenshot">Screenshot</option>
          <option value="both">Text + Screenshot</option>
          <option value="url">URL Only</option>
        </select>
      </div>

      <div class="field">
        <label for="answer-type">Result Type</label>
        <select id="answer-type">
          <option value="quick">Quick Verdict</option>
          <option value="detailed" selected>Detailed Report</option>
          <option value="risk_score">Risk Score Only</option>
          <option value="red_flags">Red Flags</option>
        </select>
      </div>

      <div class="field">
        <label for="custom-focus">Custom Focus <span class="optional">(optional)</span></label>
        <input type="text" id="custom-focus" placeholder="e.g., Is this a phishing site?" maxlength="500">
      </div>

      <div class="field">
        <label for="custom-instructions">Instructions <span class="optional">(optional)</span></label>
        <textarea id="custom-instructions" placeholder="Additional instructions for the AI..." rows="2" maxlength="1000"></textarea>
      </div>

      <button id="scan-btn" class="btn-primary">
        <span id="scan-btn-text">Scan This Page</span>
      </button>

      <div id="results" class="results hidden"></div>
    </div>
  </div>
  <script src="popup.js"></script>
</body>
</html>
`,
  'popup.js': String.raw`// Vardin Extension - Popup Script
// Handles auth verification, premium gating, and page scanning

var APP_BASE = 'https://vardin.base44.app';
var LOGIN_URL = APP_BASE + '/login';
var PRICING_URL = APP_BASE + '/pricing';

var authToken = null;
var appId = null;

// === Utility: XSS-safe HTML escaping ===
function escapeHtml(text) {
  if (text == null) return '';
  var div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

// === View switching ===
function showView(name) {
  var views = ['loading', 'login', 'upgrade', 'scan'];
  for (var i = 0; i < views.length; i++) {
    var el = document.getElementById(views[i] + '-view');
    if (el) el.classList.toggle('hidden', views[i] !== name);
  }
}

// === Auth: read stored token from chrome.storage ===
function getStoredAuth() {
  return new Promise(function(resolve) {
    chrome.storage.local.get(['authToken', 'appId', 'functionsVersion'], resolve);
  });
}

// === Auth: verify token + premium status with backend ===
async function checkAuth() {
  try {
    var response = await fetch(APP_BASE + '/api/apps/' + appId + '/functions/checkExtensionAuth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + authToken,
        'X-App-Id': appId || ''
      },
      body: JSON.stringify({})
    });

    if (response.status === 401) {
      return { authenticated: false, premium: false };
    }

    if (response.status === 403) {
      return { authenticated: true, premium: false };
    }

    if (!response.ok) {
      throw new Error('Auth check failed (' + response.status + ')');
    }

    var data = await response.json();
    return { authenticated: true, premium: data.premium, plan: data.plan, userName: data.user_name };
  } catch (error) {
    return { authenticated: false, premium: false, error: error.message };
  }
}

// === Main scan function ===
async function scanPage() {
  var btn = document.getElementById('scan-btn');
  var btnText = document.getElementById('scan-btn-text');
  var resultsDiv = document.getElementById('results');

  btn.disabled = true;
  btnText.textContent = 'Scanning...';
  resultsDiv.classList.remove('hidden');
  resultsDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>Analyzing page for scams...</p></div>';

  try {
    var scanMode = document.getElementById('scan-mode').value;
    var answerType = document.getElementById('answer-type').value;
    var customFocus = document.getElementById('custom-focus').value.trim().slice(0, 500);
    var customInstructions = document.getElementById('custom-instructions').value.trim().slice(0, 1000);

    // Persist settings
    chrome.storage.local.set({ scanMode: scanMode, answerType: answerType });

    // Get active tab
    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    var tab = tabs[0];

    if (!tab || !tab.url) {
      throw new Error('Cannot access this page. Try a regular webpage.');
    }

    if (tab.url.indexOf('chrome://') === 0 || tab.url.indexOf('chrome-extension://') === 0 || tab.url.indexOf('https://chrome.google.com/webstore') === 0) {
      throw new Error('Cannot scan Chrome internal pages.');
    }

    var pageText = '';
    var screenshotDataUrl = '';

    // Extract page text
    if (scanMode === 'text' || scanMode === 'both') {
      var results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: function() { return document.body ? document.body.innerText.slice(0, 10000) : ''; }
      });
      pageText = (results && results[0] && results[0].result) || '';
    }

    // Capture screenshot
    if (scanMode === 'screenshot' || scanMode === 'both') {
      screenshotDataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 80 });
    }

    // Call backend scan function with auth headers
    var response = await fetch(APP_BASE + '/api/apps/' + appId + '/functions/scanWebpage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + authToken,
        'X-App-Id': appId || ''
      },
      body: JSON.stringify({
        page_text: pageText,
        screenshot_data_url: screenshotDataUrl,
        page_url: tab.url,
        options: {
          scan_mode: scanMode,
          answer_type: answerType,
          custom_focus: customFocus,
          custom_instructions: customInstructions
        }
      })
    });

    if (response.status === 401) {
      showView('login');
      return;
    }

    if (response.status === 403) {
      showView('upgrade');
      return;
    }

    if (!response.ok) {
      var errData = await response.json().catch(function() { return {}; });
      throw new Error(errData.error || 'Server error (' + response.status + ')');
    }

    var data = await response.json();
    displayResults(data, data.answer_type || answerType);
  } catch (error) {
    resultsDiv.innerHTML = '<div class="error-box"><p>' + escapeHtml('\u26A0\uFE0F ' + error.message) + '</p></div>';
  } finally {
    btn.disabled = false;
    btnText.textContent = 'Scan This Page';
  }
}

// === Results display (XSS-safe: all dynamic text is escaped) ===
function displayResults(data, answerType) {
  var resultsDiv = document.getElementById('results');
  var a = data.analysis || {};
  var mode = data.answer_type || answerType;
  var html = '';

  if (mode === 'quick') {
    var isScam = a.is_scam;
    var cls = isScam ? 'danger' : 'safe';
    html = '<div class="result-card ' + cls + '">' +
      '<div class="verdict-badge ' + cls + '">' + (isScam ? '\u26A0\uFE0F SCAM' : '\u2705 SAFE') + '</div>' +
      '<p class="verdict-text">' + escapeHtml(a.verdict) + '</p>' +
      (a.confidence != null ? '<p class="confidence">Confidence: ' + escapeHtml(a.confidence) + '%</p>' : '') +
      '</div>';
  } else if (mode === 'risk_score') {
    var score = a.risk_score || 0;
    var level = a.risk_level || 'low';
    var cls2 = score >= 70 ? 'danger' : score >= 40 ? 'warning' : 'safe';
    html = '<div class="result-card ' + cls2 + '">' +
      '<div class="score-display"><span class="score-number">' + escapeHtml(score) + '</span><span class="score-max">/100</span></div>' +
      '<div class="risk-bar"><div class="risk-fill ' + cls2 + '" style="width:' + score + '%"></div></div>' +
      '<p class="risk-level ' + cls2 + '">' + escapeHtml(level.toUpperCase()) + ' RISK</p>' +
      (a.summary ? '<p class="summary">' + escapeHtml(a.summary) + '</p>' : '') +
      '</div>';
  } else if (mode === 'red_flags') {
    var flags = a.red_flags || [];
    var risk = a.overall_risk || 'low';
    var cls3 = risk === 'high' ? 'danger' : risk === 'medium' ? 'warning' : 'safe';
    html = '<div class="result-card ' + cls3 + '">' +
      '<p class="card-title">Red Flags Found: ' + flags.length + '</p>' +
      '<p class="risk-level ' + cls3 + '">' + escapeHtml(risk.toUpperCase()) + ' RISK</p>';
    if (flags.length > 0) {
      html += '<ul class="flag-list">';
      for (var i = 0; i < flags.length; i++) {
        html += '<li>' + escapeHtml(flags[i]) + '</li>';
      }
      html += '</ul>';
    } else {
      html += '<p class="empty">No red flags detected \u2705</p>';
    }
    html += '</div>';
  } else {
    var dScore = a.risk_score || 0;
    var dLevel = a.risk_level || 'low';
    var dCls = dLevel === 'high' ? 'danger' : dLevel === 'medium' ? 'warning' : 'safe';
    html = '<div class="result-card ' + dCls + '">';
    html += '<div class="result-header">';
    html += '<div class="score-display small"><span class="score-number">' + escapeHtml(dScore) + '</span><span class="score-max">/100</span></div>';
    html += '<span class="risk-level ' + dCls + '">' + escapeHtml(dLevel.toUpperCase()) + ' RISK</span>';
    html += '</div>';
    if (a.is_scam != null) {
      html += '<div class="verdict-badge ' + (a.is_scam ? 'danger' : 'safe') + '">' + (a.is_scam ? '\u26A0\uFE0F SCAM DETECTED' : '\u2705 LIKELY SAFE') + '</div>';
    }
    if (a.explanation) {
      html += '<div class="section"><p class="section-label">Explanation</p><p class="section-text">' + escapeHtml(a.explanation) + '</p></div>';
    }
    if (a.what_they_want) {
      html += '<div class="section"><p class="section-label">What They Want</p><p class="section-text">' + escapeHtml(a.what_they_want) + '</p></div>';
    }
    if (a.tactics_detected && a.tactics_detected.length) {
      html += '<div class="section"><p class="section-label">Tactics Detected</p><ul class="flag-list">';
      for (var t = 0; t < a.tactics_detected.length; t++) {
        html += '<li>' + escapeHtml(a.tactics_detected[t]) + '</li>';
      }
      html += '</ul></div>';
    }
    if (a.red_flags && a.red_flags.length) {
      html += '<div class="section"><p class="section-label">Red Flags</p><ul class="flag-list">';
      for (var r = 0; r < a.red_flags.length; r++) {
        html += '<li>' + escapeHtml(a.red_flags[r]) + '</li>';
      }
      html += '</ul></div>';
    }
    if (a.next_steps && a.next_steps.length) {
      html += '<div class="section"><p class="section-label">Recommended Actions</p><ul class="action-list">';
      for (var s = 0; s < a.next_steps.length; s++) {
        html += '<li>' + escapeHtml(a.next_steps[s]) + '</li>';
      }
      html += '</ul></div>';
    }
    html += '</div>';
  }

  resultsDiv.innerHTML = html;
}

// === Initialization ===
async function init() {
  showView('loading');

  // Load saved scan settings
  var saved = await chrome.storage.local.get(['scanMode', 'answerType']);
  if (saved.scanMode) document.getElementById('scan-mode').value = saved.scanMode;
  if (saved.answerType) document.getElementById('answer-type').value = saved.answerType;

  // Check stored auth token
  var stored = await getStoredAuth();
  if (!stored.authToken) {
    showView('login');
    return;
  }

  authToken = stored.authToken;
  appId = stored.appId;

  // Verify auth + premium with backend
  var authResult = await checkAuth();
  if (!authResult.authenticated) {
    showView('login');
    return;
  }

  if (!authResult.premium) {
    showView('upgrade');
    return;
  }

  // Show plan badge
  var badge = document.getElementById('plan-badge');
  if (badge) {
    badge.textContent = authResult.plan ? authResult.plan.toUpperCase() : 'PREMIUM';
    badge.classList.remove('hidden');
  }

  showView('scan');
}

// === Event listeners ===
document.addEventListener('DOMContentLoaded', function() {
  init();

  document.getElementById('login-btn').addEventListener('click', function() {
    chrome.tabs.create({ url: LOGIN_URL });
  });

  document.getElementById('upgrade-btn').addEventListener('click', function() {
    chrome.tabs.create({ url: PRICING_URL });
  });

  document.getElementById('scan-btn').addEventListener('click', scanPage);
});

// Auto-detect login/logout via storage changes
chrome.storage.onChanged.addListener(function(changes, area) {
  if (area !== 'local') return;
  if (changes.authToken) {
    if (changes.authToken.newValue) {
      init();
    } else {
      showView('login');
    }
  }
});
`,
  'styles.css': String.raw`* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  width: 380px;
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
  background: #f8fafc;
  color: #1e293b;
}

.container { padding: 16px; }

.hidden { display: none !important; }

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 18px;
  color: #0f766e;
}

.badge {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 3px 8px;
  border-radius: 6px;
  background: #ccfbf1;
  color: #0f766e;
}

.view { display: flex; flex-direction: column; gap: 12px; }

.icon-wrap {
  display: flex;
  justify-content: center;
  margin: 8px 0 4px;
}

.icon-wrap.lock { color: #64748b; }
.icon-wrap.crown { color: #d97706; }

.view h2 {
  font-size: 16px;
  font-weight: 700;
  text-align: center;
}

.view p {
  font-size: 13px;
  color: #64748b;
  text-align: center;
  line-height: 1.5;
}

.center-text { text-align: center; }

.btn-primary {
  width: 100%;
  padding: 12px;
  background: #0f766e;
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
}

.btn-primary:hover:not(:disabled) { background: #0d6963; }
.btn-primary:active:not(:disabled) { transform: scale(0.98); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.field { display: flex; flex-direction: column; gap: 4px; }

.field label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.optional { font-weight: 400; color: #94a3b8; }

.field select, .field input, .field textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 13px;
  background: white;
  color: #1e293b;
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
}

.field select:focus, .field input:focus, .field textarea:focus {
  border-color: #0f766e;
  box-shadow: 0 0 0 2px rgba(15, 118, 110, 0.1);
}

.field textarea { resize: vertical; min-height: 40px; }

.results { margin-top: 4px; }

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
  color: #64748b;
  font-size: 13px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e2e8f0;
  border-top-color: #0f766e;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.result-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.result-card.danger { border-color: #fecaca; background: #fef2f2; }
.result-card.warning { border-color: #fde68a; background: #fffbeb; }
.result-card.safe { border-color: #bbf7d0; background: #f0fdf4; }

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.verdict-badge {
  text-align: center;
  padding: 8px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 14px;
}

.verdict-badge.danger { background: #fee2e2; color: #991b1b; }
.verdict-badge.safe { background: #dcfce7; color: #166534; }

.verdict-text { font-size: 13px; color: #334155; line-height: 1.5; }
.confidence { font-size: 11px; color: #64748b; text-align: center; }

.score-display { text-align: center; padding: 8px; }
.score-display.small { padding: 0; }

.score-number { font-size: 32px; font-weight: 800; color: #0f766e; }
.score-display.small .score-number { font-size: 24px; }
.score-max { font-size: 14px; color: #94a3b8; font-weight: 600; }

.risk-bar {
  width: 100%;
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

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

.flag-list li {
  font-size: 12px;
  color: #334155;
  padding-left: 18px;
  position: relative;
  line-height: 1.4;
}

.flag-list li::before { content: '\1F6A9'; position: absolute; left: 0; top: 0; }

.action-list li {
  font-size: 12px;
  color: #334155;
  padding-left: 18px;
  position: relative;
  line-height: 1.4;
}

.action-list li::before { content: '\2713'; position: absolute; left: 0; top: 0; color: #0f766e; font-weight: 700; }

.section { display: flex; flex-direction: column; gap: 4px; }

.section-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #64748b;
}

.section-text { font-size: 12px; color: #334155; line-height: 1.5; }

.empty { font-size: 13px; color: #16a34a; text-align: center; }

.error-box {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
  padding: 12px;
  text-align: center;
  font-size: 13px;
  color: #991b1b;
}
`,
};

export const README_CONTENT = `Vardin Scam Scanner - Chrome Extension
======================================

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
5. Choose your scan mode and result type, add custom focus if desired
6. Click "Scan This Page" to get an instant AI-powered scam analysis

REQUIREMENTS
- A Vardin Premium or Plus subscription
- Google Chrome (or any Chromium-based browser)

SECURITY
- Your auth token is stored in chrome.storage.local (never shared)
- Premium status is verified server-side on every scan request
- All communication uses HTTPS
- No API keys or secrets in extension files
- Strict Content Security Policy (CSP) prevents code injection
- All displayed content is XSS-escaped

SUPPORT
Visit https://vardin.base44.app for help and resources.
`;