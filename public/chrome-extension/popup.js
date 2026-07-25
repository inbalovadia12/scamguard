const kidModeCheckbox = document.getElementById('kidMode');
const kidModeCard = document.getElementById('kidModeCard');
const scanBtn = document.getElementById('scanBtn');
const resultDiv = document.getElementById('result');

// Load kid mode preference
chrome.storage.sync.get('kid_mode', (data) => {
  const enabled = !!data.kid_mode;
  kidModeCheckbox.checked = enabled;
  kidModeCard.classList.toggle('active', enabled);
});

// Save kid mode preference
kidModeCheckbox.addEventListener('change', (e) => {
  const enabled = e.target.checked;
  chrome.storage.sync.set({ kid_mode: enabled });
  kidModeCard.classList.toggle('active', enabled);

  // Notify content script about kid mode change
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'KID_MODE_CHANGED', kid_mode: enabled }).catch(() => {});
    }
  });
});

// Scan current page
scanBtn.addEventListener('click', async () => {
  scanBtn.disabled = true;
  resultDiv.innerHTML = '<span class="loading">Scanning page...</span>';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab found');

    const { kid_mode } = await chrome.storage.sync.get('kid_mode');

    // Inject content script to extract page text
    const [{ result: pageText }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body.innerText.substring(0, 5000),
    });

    // Send to Vardin backend for analysis
    const response = await fetch('https://vardin.app/api/functions/scanWebpage/prod/entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: pageText,
        url: tab.url,
        kid_mode: !!kid_mode,
      }),
    });

    if (!response.ok) throw new Error('Scan failed');

    const data = await response.json();
    renderResult(data, !!kid_mode);
  } catch (err) {
    resultDiv.innerHTML = `<span class="result-warning">⚠️ ${err.message || 'Could not scan page'}</span>`;
  } finally {
    scanBtn.disabled = false;
  }
});

function renderResult(data, kidMode) {
  const risk = data.risk_level || 'low';
  const explanation = kidMode
    ? simplifyText(data.explanation)
    : data.explanation;

  if (risk === 'high') {
    resultDiv.innerHTML = `
      <div class="result-danger">🚨 ${kidMode ? 'This page is NOT safe!' : 'High Risk — Likely Scam'}</div>
      <p style="margin-top:8px;color:#475569;">${explanation || ''}</p>
    `;
  } else if (risk === 'medium') {
    resultDiv.innerHTML = `
      <div class="result-warning">⚠️ ${kidMode ? 'Be careful! This page looks fishy.' : 'Caution — Suspicious Activity'}</div>
      <p style="margin-top:8px;color:#475569;">${explanation || ''}</p>
    `;
  } else {
    resultDiv.innerHTML = `
      <div class="result-safe">✅ ${kidMode ? 'This page looks okay!' : 'No Scam Detected'}</div>
    `;
  }
}

function simplifyText(text) {
  if (!text) return '';
  return text
    .replace(/phishing/gi, 'tricky message')
    .replace(/scammer/gi, 'bad person')
    .replace(/fraudulent/gi, 'fake')
    .replace(/malicious/gi, 'dangerous')
    .replace(/credential/gi, 'password')
    .replace(/financial/gi, 'money')
    .replace(/unauthorized/gi, 'without permission');
}
