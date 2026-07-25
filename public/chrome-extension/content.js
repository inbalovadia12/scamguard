// Vardin content script - detects scam indicators on the current page

let kidMode = false;

// Load kid mode preference
chrome.storage.sync.get('kid_mode', (data) => {
  kidMode = !!data.kid_mode;
});

// Listen for kid mode changes
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'KID_MODE_CHANGED') {
    kidMode = !!msg.kid_mode;
  }
});

// Common scam indicators on pages
const SCAM_PATTERNS = [
  /urgent.{0,20}(action|verify|confirm|update)/gi,
  /(congratulations|you've?\s+won|winner|prize|lottery)/gi,
  /(bitcoin|crypto|investment|double your)/gi,
  /(enter your (ssn|social security|credit card|password|bank))/gi,
  /wire\s+transfer|gift\s+card|western\s+union/gi,
  /(your account.{0,20}(been|is)\s+(compromised|suspended|locked))/gi,
];

function detectScams() {
  const bodyText = document.body?.innerText || '';
  const found = [];

  for (const pattern of SCAM_PATTERNS) {
    const match = bodyText.match(pattern);
    if (match) {
      found.push(match[0]);
    }
  }

  if (found.length > 0) {
    showWarningBanner(found.length);
  }
}

function showWarningBanner(count) {
  // Remove existing banner
  const existing = document.getElementById('vardin-warning-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'vardin-warning-banner';
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 2147483647;
    padding: 12px 16px;
    background: ${kidMode ? 'linear-gradient(135deg, #f59e0b, #dc2626)' : 'linear-gradient(135deg, #dc2626, #991b1b)'};
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: ${kidMode ? '16px' : '14px'};
    font-weight: 600;
    text-align: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  `;

  const text = kidMode
    ? `🚨 STOP! This page might be trying to trick you (${count} warning${count > 1 ? 's' : ''}). Don't give out your info!`
    : `⚠️ Vardin detected ${count} potential scam indicator${count > 1 ? 's' : ''} on this page. Be cautious.`;

  banner.textContent = text;

  const closeBtn = document.createElement('span');
  closeBtn.textContent = ' ✕';
  closeBtn.style.cssText = 'cursor:pointer;margin-left:12px;opacity:0.8;';
  closeBtn.onclick = () => banner.remove();
  banner.appendChild(closeBtn);

  document.body?.prepend(banner);
}

// Run after page loads
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(detectScams, 1000);
} else {
  window.addEventListener('DOMContentLoaded', () => setTimeout(detectScams, 1000));
}
