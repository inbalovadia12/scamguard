// Extension packaging: assembles the downloadable ZIP contents.
// Sources live in focused sibling modules so each generated file stays
// reviewable: extensionSharedSource (shared.js), extensionWorkerSource
// (background.js), extensionContentSource (content.js, protection.js),
// extensionPopupSource (popup.html, popup.js).

import { SHARED_JS } from '@/lib/extensionSharedSource';
import { BACKGROUND_JS } from '@/lib/extensionWorkerSource';
import { CONTENT_JS, PROTECTION_JS } from '@/lib/extensionContentSource';
import { POPUP_HTML, POPUP_JS } from '@/lib/extensionPopupSource';

const MANIFEST_JSON = String.raw`{
  "manifest_version": 3,
  "name": "Vardin Scam Scanner",
  "version": "3.0.0",
  "description": "AI-powered scam detection and real-time protection for any webpage.",
  "permissions": ["activeTab", "scripting", "storage", "tabs", "notifications", "contextMenus"],
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
      "js": ["shared.js", "protection.js"],
      "run_at": "document_idle"
    }
  ],
  "commands": {
    "scan-current-page": {
      "suggested_key": {
        "default": "Ctrl+Shift+Y",
        "mac": "Command+Shift+Y"
      },
      "description": "Scan the current page with Vardin"
    }
  },
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
`;

const STYLES_CSS = String.raw`* { margin: 0; padding: 0; box-sizing: border-box; }

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
  .icon-btn { background: #1e293b !important; border-color: #334155 !important; color: #94a3b8 !important; }
  .page-prompt { background: #0f172a !important; border-color: #1e293b !important; color: #94a3b8 !important; }
  .summary-card { background: #1e293b !important; border-color: #334155 !important; }
  .section-divider-title { color: #cbd5e1 !important; }
  .qr-dest-card { background: #052e16 !important; border-color: #14532d !important; }
  .qr-value { background: #1e293b !important; border-color: #334155 !important; color: #cbd5e1 !important; }
  .qr-value a { color: #2dd4bf !important; }
  .section-text, .verdict-text, .flag-list li, .action-list li { color: #cbd5e1 !important; }
  .section-label { color: #94a3b8 !important; }
  .site-bar { background: #1e293b !important; border-color: #334155 !important; }
  .site-host { color: #cbd5e1 !important; }
  .chip-btn { background: #0f172a !important; border-color: #334155 !important; color: #94a3b8 !important; }
  .chip-btn.active { background: #134e4a !important; border-color: #0f766e !important; color: #5eead4 !important; }
  .cached-card { background: #1e293b !important; border-color: #334155 !important; }
  .cached-head { color: #cbd5e1 !important; }
  .cached-body, .history-url { color: #94a3b8 !important; }
  .phone-chip { background: #0f172a !important; border-color: #334155 !important; color: #5eead4 !important; }
  .history-item { background: #1e293b !important; border-color: #334155 !important; }
  .family-note { background: #052e16 !important; border-color: #14532d !important; color: #cbd5e1 !important; }
}

.container { padding: 16px; max-height: 600px; overflow-y: auto; }
.hidden { display: none !important; }

header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.header-right { display: flex; align-items: center; gap: 6px; }

.lang-select { font-size: 11px; padding: 3px 6px; border: 1px solid #e2e8f0; border-radius: 6px; background: white; color: #475569; outline: none; cursor: pointer; font-family: inherit; }
.lang-select:focus { border-color: #0f766e; }

.icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; padding: 0; border: 1px solid #e2e8f0; border-radius: 6px; background: white; color: #64748b; cursor: pointer; transition: background 0.2s, color 0.2s; }
.icon-btn:hover { background: #f1f5f9; color: #0f766e; }

.page-prompt { font-size: 12px; color: #64748b; line-height: 1.5; margin: 0; padding: 10px 12px; background: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 8px; }
.summary-card { background: #f8fafc; border-color: #e2e8f0; }
.summary-card .card-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin: 0 0 6px; font-weight: 600; }
.section-divider-title { font-size: 12px; font-weight: 600; color: #475569; margin: 14px 0 6px; text-transform: uppercase; letter-spacing: 0.05em; }

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
.icon-wrap.locked { color: #d97706; }
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
.verdict-badge.warning { background: #fef3c7; color: #92400e; }
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

.ai-disclaimer { font-size: 10px; line-height: 1.45; color: #64748b; background: #fffbeb; border: 1px solid #fde68a; border-radius: 9px; padding: 9px 10px; margin-top: 8px; }
.actions-bar { display: flex; gap: 4px; margin-top: 8px; flex-wrap: wrap; }
.btn-action { flex: 1; min-width: 60px; padding: 6px 8px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 11px; font-weight: 600; color: #475569; cursor: pointer; transition: background 0.2s; }
.btn-action:hover { background: #e2e8f0; }
.btn-action.primary { background: #f0fdfa; border-color: #99f6e4; color: #0f766e; }

.timestamp { font-size: 10px; color: #94a3b8; text-align: center; margin-top: 4px; }

/* === v3: site trust bar === */
.site-bar { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; }
.site-host { flex: 1; font-size: 11px; font-weight: 600; color: #475569; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.site-actions { display: flex; gap: 4px; }
.chip-btn { font-size: 10px; font-weight: 600; padding: 4px 8px; border: 1px solid #e2e8f0; background: white; color: #64748b; border-radius: 999px; cursor: pointer; font-family: inherit; }
.chip-btn.active { background: #ccfbf1; border-color: #0f766e; color: #0f766e; }

/* === v3: cached verdict + background scan + phone chips === */
.cached-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
.cached-head { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: #64748b; }
.cached-body { font-size: 12px; color: #475569; line-height: 1.4; }
.cached-actions { display: flex; gap: 6px; }

.phone-chips { display: flex; flex-direction: column; gap: 6px; }
.phone-chips-label { font-size: 11px; font-weight: 600; color: #64748b; }
.phone-chip-row { display: flex; flex-wrap: wrap; gap: 4px; }
.phone-chip { font-size: 11px; font-weight: 600; padding: 4px 8px; border: 1px solid #e2e8f0; background: white; color: #0f766e; border-radius: 999px; cursor: pointer; font-family: inherit; }
.phone-chip:hover { background: #f0fdfa; }

/* === v3: history === */
.history-list { display: flex; flex-direction: column; gap: 6px; }
.history-item { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; }
.history-url { font-size: 11px; font-weight: 600; color: #475569; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.history-meta { font-size: 10px; color: #94a3b8; }
.history-empty { font-size: 12px; color: #94a3b8; text-align: center; padding: 16px 0; }

.family-note { background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 10px; padding: 10px 12px; font-size: 12px; color: #0f766e; line-height: 1.45; }
.family-note strong { display: block; margin-bottom: 2px; }
`;

export const EXTENSION_FILES = {
  'manifest.json': MANIFEST_JSON,
  'shared.js': SHARED_JS,
  'background.js': BACKGROUND_JS,
  'content.js': CONTENT_JS,
  'protection.js': PROTECTION_JS,
  'popup.html': POPUP_HTML,
  'popup.js': POPUP_JS,
  'styles.css': STYLES_CSS,
};

export const README_CONTENT = `Vardin Scam Scanner - Chrome Extension v3.0
==============================================

WHAT'S NEW IN v3.0
- Danger Page Block: a page confirmed as a scam or malware site is replaced with a
  warning before you can interact with it, with "Leave" and "Continue anyway".
- Lookalike Domain Check: instantly spots addresses imitating PayPal, your bank or
  another brand (paypa1.com, arnazon.com) - offline, no scan needed.
- Submit Guard: before sending a password or card form on a risky page, Vardin asks
  for confirmation first.
- Right-Click Scanning: scan a page, a link, selected text, an image, or check a
  phone number, straight from the right-click menu.
- Keyboard Shortcut: Ctrl+Shift+Y (Cmd+Shift+Y on Mac) scans the current page.
- Desktop Alerts: a native notification when a page you visited turns out dangerous.
- Ask Family: send a worrying result straight to your guardian, and see their
  guidance back in the popup.
- Report to Community: share a confirmed scam with the Vardin community feed.
- Phone Check: phone numbers found on a page open in Vardin's phone lookup.
- Instant Cached Verdicts: a site you already checked shows its verdict immediately
  and does not spend credits again.
- Site Trust Lists: "Never warn here" and "Always check this site" per site.
- Scan History: your last 20 scans with risk scores.

FALSE POSITIVES
Vardin is deliberately hard to trigger. A page is only ever blocked on hard
threat-intelligence evidence (VirusTotal / URLhaus) or on a top-tier, explicit,
high-confidence AI verdict. A medium score never interrupts you, an inconclusive
analysis never blocks anything, and a lookalike warning only fires when a domain is
a one-character edit of a real brand. Every warning is dismissible, and
"Never warn here" is one click away.

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
- Full i18n: English, Hebrew (RTL), Spanish

INSTALLATION
1. Extract all files from this ZIP into a folder (e.g., "vardin-extension")
2. Open Google Chrome and go to: chrome://extensions
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked" and select your extracted folder
5. The Vardin icon will appear in your toolbar - pin it for easy access
6. Upgrading from an older version? Remove the old extension first, then load this
   folder, so Chrome does not keep the previous files.

USAGE
1. Navigate to any webpage you want to check
2. Click the Vardin extension icon
3. If not logged in, click "Open Vardin Login" and log in at vardin.base44.app
4. The extension auto-detects your login - no copy-paste needed
5. Choose your scan type and result type, then click "Scan"
6. Turn on Auto-Scan to check pages as you browse, and use the right-click menu or
   Ctrl+Shift+Y for a one-click check of the page you are on

SCAN TYPES
- Page Analysis: Extracts screenshot content from the current page and summarizes it
- URL Reputation: Checks the URL with VirusTotal + AI analysis
- Screenshot: Capture or upload a screenshot for visual analysis
- QR Code: Upload a QR image for decoding and URL risk assessment
- Email: Paste email content for phishing/invoice/spoofing detection
- Chat/SMS: Paste messages for romance/investment/crypto scam detection
- Marketplace: Paste listings for fake seller/price/payment scam detection
- File: Upload documents for phishing language and embedded URL analysis

PROTECTION FEATURES (automatic)
- Danger Page Block: confirmed dangerous pages are replaced with a warning screen
- Lookalike Banner: a brand-imitation warning bar on imitating domains
- Submit Guard: confirmation before sending passwords or card details on risky pages
- Clipboard: a warning when you paste a crypto address or a lookalike/IP link
- Desktop Alert: a notification when a background scan turns up a threat
- Auto-Scan Badge: the toolbar badge shows the risk level (red/yellow/none)

REQUIREMENTS
- A Vardin Premium subscription
- Google Chrome (or any Chromium-based browser)

SECURITY
- Auth token stored in chrome.storage.local (never shared)
- Premium status verified server-side on every scan
- All communication uses HTTPS
- No API keys or secrets in extension files
- Strict Content Security Policy (CSP)
- All displayed content is XSS-escaped
- VirusTotal API key kept on backend only
- Scans a page only when you ask, when Auto-Scan is on, or from the context menu

SUPPORT
Visit https://vardin.base44.app for help and resources.
`;