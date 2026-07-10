// Vardin Extension - Popup Script
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
