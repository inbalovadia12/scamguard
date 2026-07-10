const DEFAULT_API_URL = 'https://vardin.base44.app/api/functions/scanWebpage';

// Load saved settings
chrome.storage.sync.get(['apiUrl', 'scanMode', 'answerType'], (result) => {
  document.getElementById('api-url').value = result.apiUrl || DEFAULT_API_URL;
  if (result.scanMode) document.getElementById('scan-mode').value = result.scanMode;
  if (result.answerType) document.getElementById('answer-type').value = result.answerType;
});

// Settings toggle
document.getElementById('settings-toggle').addEventListener('click', () => {
  document.getElementById('main-view').classList.toggle('hidden');
  document.getElementById('settings-view').classList.toggle('hidden');
});

document.getElementById('back-btn').addEventListener('click', () => {
  document.getElementById('main-view').classList.remove('hidden');
  document.getElementById('settings-view').classList.add('hidden');
});

document.getElementById('save-settings').addEventListener('click', () => {
  const apiUrl = document.getElementById('api-url').value || DEFAULT_API_URL;
  chrome.storage.sync.set({ apiUrl }, () => {
    document.getElementById('main-view').classList.remove('hidden');
    document.getElementById('settings-view').classList.add('hidden');
  });
});

// Persist scan mode and answer type
document.getElementById('scan-mode').addEventListener('change', (e) => {
  chrome.storage.sync.set({ scanMode: e.target.value });
});
document.getElementById('answer-type').addEventListener('change', (e) => {
  chrome.storage.sync.set({ answerType: e.target.value });
});

// Scan button
document.getElementById('scan-btn').addEventListener('click', scanPage);

async function scanPage() {
  const btn = document.getElementById('scan-btn');
  const resultsDiv = document.getElementById('results');

  btn.disabled = true;
  btn.innerHTML = '<span class="btn-text">Scanning...</span>';
  resultsDiv.classList.remove('hidden');
  resultsDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>Analyzing page for scams...</p></div>';

  try {
    const scanMode = document.getElementById('scan-mode').value;
    const answerType = document.getElementById('answer-type').value;
    const customFocus = document.getElementById('custom-focus').value;
    const customInstructions = document.getElementById('custom-instructions').value;

    const apiUrl = await new Promise(resolve => {
      chrome.storage.sync.get(['apiUrl'], (r) => resolve(r.apiUrl || DEFAULT_API_URL));
    });

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url) {
      throw new Error('Cannot access this page. Try a regular webpage.');
    }

    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('https://chrome.google.com/webstore')) {
      throw new Error('Cannot scan Chrome internal pages. Try a regular webpage.');
    }

    let pageText = '';
    let screenshotDataUrl = '';

    // Extract page text if needed
    if (scanMode === 'text' || scanMode === 'both') {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body ? document.body.innerText.slice(0, 10000) : ''
      });
      pageText = result?.result || '';
    }

    // Capture screenshot if needed
    if (scanMode === 'screenshot' || scanMode === 'both') {
      screenshotDataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 80 });
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Server error (' + response.status + ')');
    }

    const data = await response.json();
    displayResults(data, answerType);
  } catch (error) {
    resultsDiv.innerHTML = '<div class="error-box"><p>\u26A0\uFE0F ' + error.message + '</p></div>';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-text">Scan This Page</span>';
  }
}

function displayResults(data, answerType) {
  const resultsDiv = document.getElementById('results');
  const analysis = data.analysis;
  const mode = data.answer_type || answerType;

  let html = '';

  if (mode === 'quick') {
    const isScam = analysis.is_scam;
    html =
      '<div class="result-card ' + (isScam ? 'danger' : 'safe') + '">' +
        '<div class="verdict-badge ' + (isScam ? 'danger' : 'safe') + '">' +
          (isScam ? '\u26A0\uFE0F SCAM' : '\u2705 SAFE') +
        '</div>' +
        '<p class="verdict-text">' + (analysis.verdict || '') + '</p>' +
        (analysis.confidence != null ? '<p class="confidence">Confidence: ' + analysis.confidence + '%</p>' : '') +
      '</div>';
  } else if (mode === 'risk_score') {
    const score = analysis.risk_score || 0;
    const level = analysis.risk_level || 'low';
    const colorClass = score >= 70 ? 'danger' : score >= 40 ? 'warning' : 'safe';
    html =
      '<div class="result-card ' + colorClass + '">' +
        '<div class="score-display">' +
          '<span class="score-number">' + score + '</span><span class="score-max">/100</span>' +
        '</div>' +
        '<div class="risk-bar"><div class="risk-fill ' + colorClass + '" style="width:' + score + '%"></div></div>' +
        '<p class="risk-level ' + colorClass + '">' + level.toUpperCase() + ' RISK</p>' +
        (analysis.summary ? '<p class="summary">' + analysis.summary + '</p>' : '') +
      '</div>';
  } else if (mode === 'red_flags') {
    const flags = analysis.red_flags || [];
    const risk = analysis.overall_risk || 'low';
    const colorClass = risk === 'high' ? 'danger' : risk === 'medium' ? 'warning' : 'safe';
    html =
      '<div class="result-card ' + colorClass + '">' +
        '<p class="card-title">Red Flags Found: ' + flags.length + '</p>' +
        '<p class="risk-level ' + colorClass + '">' + risk.toUpperCase() + ' RISK</p>' +
        (flags.length > 0
          ? '<ul class="flag-list">' + flags.map(function(f) { return '<li>' + f + '</li>'; }).join('') + '</ul>'
          : '<p class="empty">No red flags detected \u2705</p>') +
      '</div>';
  } else {
    // detailed
    var score = analysis.risk_score || 0;
    var level = analysis.risk_level || 'low';
    var colorClass = level === 'high' ? 'danger' : level === 'medium' ? 'warning' : 'safe';
    html = '<div class="result-card ' + colorClass + '">';
    html += '<div class="result-header">';
    html += '<div class="score-display small"><span class="score-number">' + score + '</span><span class="score-max">/100</span></div>';
    html += '<span class="risk-level ' + colorClass + '">' + level.toUpperCase() + ' RISK</span>';
    html += '</div>';
    if (analysis.is_scam != null) {
      html += '<div class="verdict-badge ' + (analysis.is_scam ? 'danger' : 'safe') + '">' + (analysis.is_scam ? '\u26A0\uFE0F SCAM DETECTED' : '\u2705 LIKELY SAFE') + '</div>';
    }
    if (analysis.explanation) {
      html += '<div class="section"><p class="section-label">Explanation</p><p class="section-text">' + analysis.explanation + '</p></div>';
    }
    if (analysis.what_they_want) {
      html += '<div class="section"><p class="section-label">What They Want</p><p class="section-text">' + analysis.what_they_want + '</p></div>';
    }
    if (analysis.tactics_detected && analysis.tactics_detected.length) {
      html += '<div class="section"><p class="section-label">Tactics Detected</p><ul class="flag-list">' + analysis.tactics_detected.map(function(t) { return '<li>' + t + '</li>'; }).join('') + '</ul></div>';
    }
    if (analysis.red_flags && analysis.red_flags.length) {
      html += '<div class="section"><p class="section-label">Red Flags</p><ul class="flag-list">' + analysis.red_flags.map(function(f) { return '<li>' + f + '</li>'; }).join('') + '</ul></div>';
    }
    if (analysis.next_steps && analysis.next_steps.length) {
      html += '<div class="section"><p class="section-label">Recommended Actions</p><ul class="action-list">' + analysis.next_steps.map(function(s) { return '<li>' + s + '</li>'; }).join('') + '</ul></div>';
    }
    html += '</div>';
  }

  resultsDiv.innerHTML = html;
}
