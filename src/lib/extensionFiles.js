// Extension file contents embedded as String.raw to preserve all escape sequences exactly.
// These are sent to the downloadExtension backend function which packages them into a ZIP.

export const EXTENSION_FILES = {
  'manifest.json': String.raw`{
  "manifest_version": 3,
  "name": "Vardin Scam Scanner",
  "version": "1.1.0",
  "description": "AI-powered scam detection for any webpage. Premium feature.",
  "permissions": ["activeTab", "scripting", "storage"],
  "host_permissions": ["<all_urls>"],
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
      <div class="header-right">
        <select id="lang-select" class="lang-select" aria-label="Language">
          <option value="en">English</option>
          <option value="he">עברית</option>
          <option value="es">Español</option>
        </select>
        <span id="plan-badge" class="badge hidden"></span>
      </div>
    </header>

    <!-- Loading View -->
    <div id="loading-view" class="view">
      <div class="spinner"></div>
      <p class="center-text" data-i18n="checking_access">Checking access...</p>
    </div>

    <!-- Login View -->
    <div id="login-view" class="view hidden">
      <div class="icon-wrap lock">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
      <h2 data-i18n="connect_title">Connect Your Account</h2>
      <p data-i18n="connect_desc">Log in to Vardin on your browser to start scanning webpages for scams.</p>
      <button id="login-btn" class="btn-primary" data-i18n="open_login">Open Vardin Login</button>
    </div>

    <!-- Upgrade View -->
    <div id="upgrade-view" class="view hidden">
      <div class="icon-wrap crown">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/>
          <path d="M5 21h14"/>
        </svg>
      </div>
      <h2 data-i18n="premium_title">Premium Required</h2>
      <p data-i18n="premium_desc">The Vardin Chrome extension requires a Premium subscription. Upgrade to unlock AI-powered scam scanning on any webpage.</p>
      <button id="upgrade-btn" class="btn-primary" data-i18n="upgrade_premium">Upgrade to Premium</button>
    </div>

    <!-- Scan View -->
    <div id="scan-view" class="view hidden">
      <div class="field">
        <label for="scan-mode" data-i18n="scan_mode">Scan Mode</label>
        <select id="scan-mode">
          <option value="text" data-i18n="mode_text">Page Text</option>
          <option value="screenshot" data-i18n="mode_screenshot">Screenshot</option>
          <option value="both" data-i18n="mode_both">Text + Screenshot</option>
          <option value="url" data-i18n="mode_url">URL Only</option>
        </select>
      </div>

      <div class="field">
        <label for="answer-type" data-i18n="result_type">Result Type</label>
        <select id="answer-type">
          <option value="quick" data-i18n="result_quick">Quick Verdict</option>
          <option value="detailed" selected data-i18n="result_detailed">Detailed Report</option>
          <option value="risk_score" data-i18n="result_risk">Risk Score Only</option>
          <option value="red_flags" data-i18n="result_flags">Red Flags</option>
        </select>
      </div>

      <div class="field">
        <label for="custom-focus"><span data-i18n="custom_focus">Custom Focus</span> <span class="optional" data-i18n="optional">(optional)</span></label>
        <input type="text" id="custom-focus" data-i18n-placeholder="focus_placeholder" maxlength="500">
      </div>

      <div class="field">
        <label for="custom-instructions"><span data-i18n="instructions_label">Instructions</span> <span class="optional" data-i18n="optional">(optional)</span></label>
        <textarea id="custom-instructions" data-i18n-placeholder="instructions_placeholder" rows="2" maxlength="1000"></textarea>
      </div>

      <div id="credits-display" class="credits-bar"></div>

      <button id="scan-btn" class="btn-primary">
        <span id="scan-btn-text" data-i18n="scan_btn">Scan This Page</span>
      </button>

      <div id="results" class="results hidden"></div>
    </div>
  </div>
  <script src="popup.js"></script>
</body>
</html>
`,
  'popup.js': String.raw`// Vardin Extension - Popup Script
// Handles auth verification, premium gating, credit tracking, and page scanning

var APP_BASE = 'https://vardin.base44.app';
var LOGIN_URL = APP_BASE + '/login';
var PRICING_URL = APP_BASE + '/pricing';

// Credit costs per scan mode (must match backend CREDIT_COSTS)
var CREDIT_COSTS = { url: 12, text: 8, screenshot: 8, both: 12 };

var authToken = null;
var appId = null;
var creditsRemaining = null;
var creditsLimit = null;
var currentLang = 'en';

// === i18n translations ===
var I18N = {
  en: {
    lang_name: 'English',
    checking_access: 'Checking access...',
    connect_title: 'Connect Your Account',
    connect_desc: 'Log in to Vardin on your browser to start scanning webpages for scams.',
    open_login: 'Open Vardin Login',
    premium_title: 'Premium Required',
    premium_desc: 'The Vardin Chrome extension requires a Premium subscription. Upgrade to unlock AI-powered scam scanning on any webpage.',
    upgrade_premium: 'Upgrade to Premium',
    scan_mode: 'Scan Mode',
    mode_text: 'Page Text',
    mode_screenshot: 'Screenshot',
    mode_both: 'Text + Screenshot',
    mode_url: 'URL Only',
    result_type: 'Result Type',
    result_quick: 'Quick Verdict',
    result_detailed: 'Detailed Report',
    result_risk: 'Risk Score Only',
    result_flags: 'Red Flags',
    custom_focus: 'Custom Focus',
    optional: '(optional)',
    focus_placeholder: 'e.g., Is this a phishing site?',
    instructions_label: 'Instructions',
    instructions_placeholder: 'Additional instructions for the AI...',
    credits_remaining: 'credits',
    this_scan: 'This scan:',
    scan_btn: 'Scan This Page',
    scanning: 'Scanning...',
    analyzing: 'Analyzing page for scams...',
    scam: 'SCAM',
    safe: 'SAFE',
    confidence: 'Confidence',
    risk_level: 'RISK',
    red_flags_found: 'Red Flags Found:',
    no_flags: 'No red flags detected',
    explanation: 'Explanation',
    what_they_want: 'What They Want',
    tactics_detected: 'Tactics Detected',
    recommended_actions: 'Recommended Actions',
    not_enough_credits: 'Not enough credits',
    credits_cost_msg: 'This scan costs {cost} credits but you have {remaining} remaining.',
    upgrade_plan: 'Upgrade Plan',
    err_no_text: 'Could not extract text from this page. Try Screenshot mode instead.',
    err_no_screenshot: 'Could not capture a screenshot of this page.',
    err_internal: 'Cannot scan Chrome internal pages.',
    err_no_page: 'Cannot access this page. Try a regular webpage.',
    language: 'Language'
  },
  he: {
    lang_name: 'עברית',
    checking_access: 'בודק גישה...',
    connect_title: 'חבר את החשבון שלך',
    connect_desc: 'התחבר ל-Vardin בדפדפן שלך כדי להתחיל לסרוק דפי אינטרנט להונאות.',
    open_login: 'פתח התחברות Vardin',
    premium_title: 'נדרש Premium',
    premium_desc: 'תוסף Chrome של Vardin דורש מנוי Premium. שדרג כדי לפתוח סריקת הונאות מופעלת AI בכל דף אינטרנט.',
    upgrade_premium: 'שדרג ל-Premium',
    scan_mode: 'מצב סריקה',
    mode_text: 'טקסט הדף',
    mode_screenshot: 'צילום מסך',
    mode_both: 'טקסט + צילום מסך',
    mode_url: 'כתובת בלבד',
    result_type: 'סוג תוצאה',
    result_quick: 'פסק דין מהיר',
    result_detailed: 'דוח מפורט',
    result_risk: 'ציון סיכון בלבד',
    result_flags: 'דגלים אדומים',
    custom_focus: 'מיקוד מותאם',
    optional: '(אופציונלי)',
    focus_placeholder: 'לדוגמה, האם זה אתר פישינג?',
    instructions_label: 'הוראות',
    instructions_placeholder: 'הוראות נוספות ל-AI...',
    credits_remaining: 'קרדיטים',
    this_scan: 'סריקה זו:',
    scan_btn: 'סרוק דף זה',
    scanning: 'סורק...',
    analyzing: 'מנתח את הדף להונאות...',
    scam: 'הונאה',
    safe: 'בטוח',
    confidence: 'ביטחון',
    risk_level: 'סיכון',
    red_flags_found: 'דגלים אדומים שנמצאו:',
    no_flags: 'לא נמצאו דגלים אדומים',
    explanation: 'הסבר',
    what_they_want: 'מה הם רוצים',
    tactics_detected: 'טקטיקות שזוהו',
    recommended_actions: 'פעולות מומלצות',
    not_enough_credits: 'אין מספיק קרדיטים',
    credits_cost_msg: 'סריקה זו עולה {cost} קרדיטים אך נשארו לך {remaining}.',
    upgrade_plan: 'שדרג תוכנית',
    err_no_text: 'לא ניתן לחלץ טקסט מדף זה. נסה מצב צילום מסך במקום.',
    err_no_screenshot: 'לא ניתן לצלם צילום מסך של דף זה.',
    err_internal: 'לא ניתן לסרוק דפים פנימיים של Chrome.',
    err_no_page: 'לא ניתן לגשת לדף זה. נסה דף אינטרנט רגיל.',
    language: 'שפה'
  },
  es: {
    lang_name: 'Español',
    checking_access: 'Verificando acceso...',
    connect_title: 'Conecta tu cuenta',
    connect_desc: 'Inicia sesión en Vardin en tu navegador para empezar a escanear páginas web en busca de estafas.',
    open_login: 'Abrir inicio de sesión Vardin',
    premium_title: 'Se requiere Premium',
    premium_desc: 'La extensión de Chrome de Vardin requiere una suscripción Premium. Actualiza para desbloquear el escaneo de estafas con IA en cualquier página web.',
    upgrade_premium: 'Actualizar a Premium',
    scan_mode: 'Modo de escaneo',
    mode_text: 'Texto de la página',
    mode_screenshot: 'Captura de pantalla',
    mode_both: 'Texto + Captura',
    mode_url: 'Solo URL',
    result_type: 'Tipo de resultado',
    result_quick: 'Veredicto rápido',
    result_detailed: 'Informe detallado',
    result_risk: 'Solo puntuación de riesgo',
    result_flags: 'Banderas rojas',
    custom_focus: 'Enfoque personalizado',
    optional: '(opcional)',
    focus_placeholder: 'ej., ¿Es este un sitio de phishing?',
    instructions_label: 'Instrucciones',
    instructions_placeholder: 'Instrucciones adicionales para la IA...',
    credits_remaining: 'créditos',
    this_scan: 'Este escaneo:',
    scan_btn: 'Escanear esta página',
    scanning: 'Escaneando...',
    analyzing: 'Analizando la página en busca de estafas...',
    scam: 'ESTAFA',
    safe: 'SEGURO',
    confidence: 'Confianza',
    risk_level: 'RIESGO',
    red_flags_found: 'Banderas rojas encontradas:',
    no_flags: 'No se detectaron banderas rojas',
    explanation: 'Explicación',
    what_they_want: 'Lo que quieren',
    tactics_detected: 'Tácticas detectadas',
    recommended_actions: 'Acciones recomendadas',
    not_enough_credits: 'Créditos insuficientes',
    credits_cost_msg: 'Este escaneo cuesta {cost} créditos pero te quedan {remaining}.',
    upgrade_plan: 'Mejorar plan',
    err_no_text: 'No se pudo extraer texto de esta página. Prueba el modo Captura de pantalla.',
    err_no_screenshot: 'No se pudo capturar una captura de pantalla de esta página.',
    err_internal: 'No se pueden escanear páginas internas de Chrome.',
    err_no_page: 'No se puede acceder a esta página. Prueba una página web normal.',
    language: 'Idioma'
  }
};

var LANGS = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'he', label: 'עברית', dir: 'rtl' },
  { code: 'es', label: 'Español', dir: 'ltr' }
];

function t(key, params) {
  var str = (I18N[currentLang] && I18N[currentLang][key]) || I18N.en[key] || key;
  if (params) {
    for (var k in params) {
      str = str.replace('{' + k + '}', params[k]);
    }
  }
  return str;
}

function setLang(lang) {
  if (!I18N[lang]) return;
  currentLang = lang;
  chrome.storage.local.set({ lang: lang });
  var langInfo = LANGS.find(function(l) { return l.code === lang; });
  document.documentElement.lang = lang;
  document.documentElement.dir = langInfo ? langInfo.dir : 'ltr';
  applyTranslations();
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(function(el) {
    var key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
    var key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = t(key);
  });
  // Update scan button text (may be in "scanning" state)
  var btnText = document.getElementById('scan-btn-text');
  if (btnText && !btnText.dataset.scanning) {
    btnText.textContent = t('scan_btn');
  }
  // Update select options
  var scanModeSelect = document.getElementById('scan-mode');
  if (scanModeSelect) {
    scanModeSelect.options[0].text = t('mode_text');
    scanModeSelect.options[1].text = t('mode_screenshot');
    scanModeSelect.options[2].text = t('mode_both');
    scanModeSelect.options[3].text = t('mode_url');
  }
  var answerTypeSelect = document.getElementById('answer-type');
  if (answerTypeSelect) {
    answerTypeSelect.options[0].text = t('result_quick');
    answerTypeSelect.options[1].text = t('result_detailed');
    answerTypeSelect.options[2].text = t('result_risk');
    answerTypeSelect.options[3].text = t('result_flags');
  }
  updateCreditDisplay();
}

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
    return {
      authenticated: true,
      premium: data.premium,
      plan: data.plan,
      userName: data.user_name,
      creditsRemaining: data.credits_remaining,
      creditsLimit: data.credits_limit
    };
  } catch (error) {
    return { authenticated: false, premium: false, error: error.message };
  }
}

// === Update credit display ===
function updateCreditDisplay() {
  var el = document.getElementById('credits-display');
  if (!el) return;

  var scanMode = document.getElementById('scan-mode').value;
  var cost = CREDIT_COSTS[scanMode] || CREDIT_COSTS.text;

  if (creditsRemaining != null && creditsLimit != null) {
    el.innerHTML = '<span class="credits-remaining">' + creditsRemaining + ' / ' + creditsLimit + ' ' + t('credits_remaining') + '</span>' +
      '<span class="credits-cost">' + t('this_scan') + ' ' + cost + ' ' + t('credits_remaining') + '</span>';
  }
}

// === Main scan function ===
async function scanPage() {
  var btn = document.getElementById('scan-btn');
  var btnText = document.getElementById('scan-btn-text');
  var resultsDiv = document.getElementById('results');

  btn.disabled = true;
  btnText.dataset.scanning = '1';
  btnText.textContent = t('scanning');
  resultsDiv.classList.remove('hidden');
  resultsDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>' + t('analyzing') + '</p></div>';

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
      throw new Error(t('err_no_page'));
    }

    if (tab.url.indexOf('chrome://') === 0 || tab.url.indexOf('chrome-extension://') === 0 || tab.url.indexOf('https://chrome.google.com/webstore') === 0) {
      throw new Error(t('err_internal'));
    }

    var pageText = '';
    var screenshotDataUrl = '';

    // Extract page text
    if (scanMode === 'text' || scanMode === 'both') {
      try {
        var results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: function() { return document.body ? document.body.innerText.slice(0, 10000) : ''; }
        });
        pageText = (results && results[0] && results[0].result) || '';
      } catch (textErr) {
        throw new Error(t('err_no_text') + ' (' + (textErr.message || textErr) + ')');
      }
    }

    // Capture screenshot
    if (scanMode === 'screenshot' || scanMode === 'both') {
      try {
        screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 80 });
      } catch (shotErr) {
        throw new Error(t('err_no_screenshot') + ' (' + (shotErr.message || shotErr) + ')');
      }
    }

    // Validate we got at least some content for the requested mode
    if (scanMode === 'text' && !pageText) {
      throw new Error(t('err_no_text'));
    }
    if ((scanMode === 'screenshot' || scanMode === 'both') && !screenshotDataUrl) {
      throw new Error(t('err_no_screenshot'));
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
          custom_instructions: customInstructions,
          language: currentLang
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

    if (response.status === 402) {
      var data402 = await response.json();
      creditsRemaining = data402.credits_remaining || 0;
      creditsLimit = data402.credits_limit || 0;
      updateCreditDisplay();
      resultsDiv.innerHTML = '<div class="error-box"><p>\u26A0\uFE0F ' + t('not_enough_credits') + '</p><p class="error-sub">' + t('credits_cost_msg', { cost: (data402.credit_cost || CREDIT_COSTS[scanMode]), remaining: creditsRemaining }) + '</p><button id="upgrade-inline-btn" class="btn-primary" style="margin-top:8px">' + t('upgrade_plan') + '</button></div>';
      document.getElementById('upgrade-inline-btn').addEventListener('click', function() { chrome.tabs.create({ url: PRICING_URL }); });
      return;
    }

    if (!response.ok) {
      var errData = await response.json().catch(function() { return {}; });
      throw new Error(errData.error || 'Server error (' + response.status + ')');
    }

    var data = await response.json();

    // Update credits from response
    if (data.credits_remaining != null) {
      creditsRemaining = data.credits_remaining;
      creditsLimit = data.credits_limit || creditsLimit;
      updateCreditDisplay();
    }

    displayResults(data, data.answer_type || answerType);
  } catch (error) {
    resultsDiv.innerHTML = '<div class="error-box"><p>' + escapeHtml('\u26A0\uFE0F ' + error.message) + '</p></div>';
  } finally {
    btn.disabled = false;
    delete btnText.dataset.scanning;
    btnText.textContent = t('scan_btn');
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
      '<div class="verdict-badge ' + cls + '">' + (isScam ? '\u26A0\uFE0F ' + t('scam') : '\u2705 ' + t('safe')) + '</div>' +
      '<p class="verdict-text">' + escapeHtml(a.verdict) + '</p>' +
      (a.confidence != null ? '<p class="confidence">' + t('confidence') + ': ' + escapeHtml(a.confidence) + '%</p>' : '') +
      '</div>';
  } else if (mode === 'risk_score') {
    var score = a.risk_score || 0;
    var level = a.risk_level || 'low';
    var cls2 = score >= 70 ? 'danger' : score >= 40 ? 'warning' : 'safe';
    html = '<div class="result-card ' + cls2 + '">' +
      '<div class="score-display"><span class="score-number">' + escapeHtml(score) + '</span><span class="score-max">/100</span></div>' +
      '<div class="risk-bar"><div class="risk-fill ' + cls2 + '" style="width:' + score + '%"></div></div>' +
      '<p class="risk-level ' + cls2 + '">' + escapeHtml(level.toUpperCase()) + ' ' + t('risk_level') + '</p>' +
      (a.summary ? '<p class="summary">' + escapeHtml(a.summary) + '</p>' : '') +
      '</div>';
  } else if (mode === 'red_flags') {
    var flags = a.red_flags || [];
    var risk = a.overall_risk || 'low';
    var cls3 = risk === 'high' ? 'danger' : risk === 'medium' ? 'warning' : 'safe';
    html = '<div class="result-card ' + cls3 + '">' +
      '<p class="card-title">' + t('red_flags_found') + ' ' + flags.length + '</p>' +
      '<p class="risk-level ' + cls3 + '">' + escapeHtml(risk.toUpperCase()) + ' ' + t('risk_level') + '</p>';
    if (flags.length > 0) {
      html += '<ul class="flag-list">';
      for (var i = 0; i < flags.length; i++) {
        html += '<li>' + escapeHtml(flags[i]) + '</li>';
      }
      html += '</ul>';
    } else {
      html += '<p class="empty">' + t('no_flags') + ' \u2705</p>';
    }
    html += '</div>';
  } else {
    var dScore = a.risk_score || 0;
    var dLevel = a.risk_level || 'low';
    var dCls = dLevel === 'high' ? 'danger' : dLevel === 'medium' ? 'warning' : 'safe';
    html = '<div class="result-card ' + dCls + '">';
    html += '<div class="result-header">';
    html += '<div class="score-display small"><span class="score-number">' + escapeHtml(dScore) + '</span><span class="score-max">/100</span></div>';
    html += '<span class="risk-level ' + dCls + '">' + escapeHtml(dLevel.toUpperCase()) + ' ' + t('risk_level') + '</span>';
    html += '</div>';
    if (a.is_scam != null) {
      html += '<div class="verdict-badge ' + (a.is_scam ? 'danger' : 'safe') + '">' + (a.is_scam ? ('\u26A0\uFE0F ' + t('scam')) : ('\u2705 ' + t('safe'))) + '</div>';
    }
    if (a.explanation) {
      html += '<div class="section"><p class="section-label">' + t('explanation') + '</p><p class="section-text">' + escapeHtml(a.explanation) + '</p></div>';
    }
    if (a.what_they_want) {
      html += '<div class="section"><p class="section-label">' + t('what_they_want') + '</p><p class="section-text">' + escapeHtml(a.what_they_want) + '</p></div>';
    }
    if (a.tactics_detected && a.tactics_detected.length) {
      html += '<div class="section"><p class="section-label">' + t('tactics_detected') + '</p><ul class="flag-list">';
      for (var tt = 0; tt < a.tactics_detected.length; tt++) {
        html += '<li>' + escapeHtml(a.tactics_detected[tt]) + '</li>';
      }
      html += '</ul></div>';
    }
    if (a.red_flags && a.red_flags.length) {
      html += '<div class="section"><p class="section-label">' + t('red_flags_found') + '</p><ul class="flag-list">';
      for (var r = 0; r < a.red_flags.length; r++) {
        html += '<li>' + escapeHtml(a.red_flags[r]) + '</li>';
      }
      html += '</ul></div>';
    }
    if (a.next_steps && a.next_steps.length) {
      html += '<div class="section"><p class="section-label">' + t('recommended_actions') + '</p><ul class="action-list">';
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

  // Load saved language
  var savedLang = await chrome.storage.local.get(['lang']);
  if (savedLang.lang && I18N[savedLang.lang]) {
    currentLang = savedLang.lang;
  }
  var langInfo = LANGS.find(function(l) { return l.code === currentLang; });
  document.documentElement.lang = currentLang;
  document.documentElement.dir = langInfo ? langInfo.dir : 'ltr';
  var langSelect = document.getElementById('lang-select');
  if (langSelect) langSelect.value = currentLang;
  applyTranslations();

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

  // Store credits
  creditsRemaining = authResult.creditsRemaining;
  creditsLimit = authResult.creditsLimit;

  // Show plan badge
  var badge = document.getElementById('plan-badge');
  if (badge) {
    badge.textContent = authResult.plan ? authResult.plan.toUpperCase() : 'PREMIUM';
    badge.classList.remove('hidden');
  }

  showView('scan');
  updateCreditDisplay();
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

  // Update credit cost display when scan mode changes
  document.getElementById('scan-mode').addEventListener('change', updateCreditDisplay);

  // Language selector
  document.getElementById('lang-select').addEventListener('change', function(e) {
    setLang(e.target.value);
  });
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

.header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.lang-select {
  font-size: 11px;
  padding: 3px 6px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
  color: #475569;
  outline: none;
  cursor: pointer;
  font-family: inherit;
}

.lang-select:focus {
  border-color: #0f766e;
}

/* RTL support */
html[dir="rtl"] body {
  direction: rtl;
  text-align: right;
}

html[dir="rtl"] .field label,
html[dir="rtl"] .view p,
html[dir="rtl"] .center-text {
  text-align: right;
}

html[dir="rtl"] .view h2 {
  text-align: center;
}

html[dir="rtl"] .flag-list li,
html[dir="rtl"] .action-list li {
  padding-left: 0;
  padding-right: 18px;
}

html[dir="rtl"] .flag-list li::before,
html[dir="rtl"] .action-list li::before {
  left: auto;
  right: 0;
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

.error-sub {
  font-size: 12px;
  color: #64748b;
  margin-top: 4px;
  font-weight: 400;
}

.credits-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: #f0fdfa;
  border: 1px solid #ccfbf1;
  border-radius: 8px;
  font-size: 12px;
}

.credits-remaining {
  font-weight: 600;
  color: #0f766e;
}

.credits-cost {
  color: #64748b;
  font-size: 11px;
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