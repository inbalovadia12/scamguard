// Extension popup source files (HTML + JS) exported as strings.
// Imported by extensionFiles.js and packaged into the downloadable ZIP.

export const POPUP_HTML = String.raw`<!DOCTYPE html>
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
          <option value="en">EN</option>
          <option value="he">עב</option>
          <option value="es">ES</option>
        </select>
        <label class="auto-scan-toggle" title="Auto-scan">
          <input type="checkbox" id="auto-scan-toggle">
          <span class="toggle-slider"></span>
        </label>
        <span id="plan-badge" class="badge hidden"></span>
      </div>
    </header>

    <div id="loading-view" class="view">
      <div class="spinner"></div>
      <p class="center-text" data-i18n="checking_access">Checking access...</p>
    </div>

    <div id="login-view" class="view hidden">
      <div class="icon-wrap lock">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
      <h2 data-i18n="connect_title">Connect Your Account</h2>
      <p data-i18n="connect_desc">Log in to Vardin on your browser to start scanning.</p>
      <button id="login-btn" class="btn-primary" data-i18n="open_login">Open Vardin Login</button>
    </div>

    <div id="upgrade-view" class="view hidden">
      <div class="icon-wrap crown">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/>
          <path d="M5 21h14"/>
        </svg>
      </div>
      <h2 data-i18n="premium_title">Premium Required</h2>
      <p data-i18n="premium_desc">The Vardin Chrome extension requires a Premium subscription.</p>
      <button id="upgrade-btn" class="btn-primary" data-i18n="upgrade_premium">Upgrade to Premium</button>
    </div>

    <div id="scan-view" class="view hidden">
      <div class="field">
        <label data-i18n="scan_type">Scan Type</label>
        <select id="scan-type">
          <option value="page" data-i18n="type_page">Page Analysis</option>
          <option value="url" data-i18n="type_url">URL Reputation</option>
          <option value="screenshot" data-i18n="type_screenshot">Screenshot</option>
          <option value="qr" data-i18n="type_qr">QR Code</option>
          <option value="email" data-i18n="type_email">Email</option>
          <option value="chat" data-i18n="type_chat">Chat / SMS</option>
          <option value="marketplace" data-i18n="type_marketplace">Marketplace</option>
          <option value="file" data-i18n="type_file">File</option>
        </select>
      </div>

      <div id="page-mode-field" class="field">
        <label data-i18n="scan_mode">Scan Mode</label>
        <select id="scan-mode">
          <option value="text" data-i18n="mode_text">Page Text</option>
          <option value="screenshot" data-i18n="mode_screenshot">Screenshot</option>
          <option value="both" data-i18n="mode_both">Text + Screenshot</option>
        </select>
      </div>

      <div id="text-input-field" class="field hidden">
        <label data-i18n="content_label">Content</label>
        <textarea id="content-input" rows="4" data-i18n-placeholder="content_placeholder"></textarea>
      </div>

      <div id="upload-field" class="field hidden">
        <label data-i18n="upload_label">Upload</label>
        <div id="drop-zone" class="drop-zone">
          <p id="drop-zone-text" data-i18n="upload_desc">Drag &amp; drop, paste, or click to upload</p>
          <input type="file" id="file-input" hidden>
        </div>
      </div>

      <div id="capture-field" class="field hidden">
        <button id="capture-btn" class="btn-secondary" data-i18n="capture_screenshot">Capture Screenshot</button>
      </div>

      <div class="field">
        <label data-i18n="result_type">Result Type</label>
        <select id="answer-type">
          <option value="quick" data-i18n="result_quick">Quick Verdict</option>
          <option value="detailed" selected data-i18n="result_detailed">Detailed Report</option>
          <option value="risk_score" data-i18n="result_risk">Risk Score Only</option>
          <option value="red_flags" data-i18n="result_flags">Red Flags</option>
        </select>
      </div>

      <div class="field">
        <label><span data-i18n="custom_focus">Custom Focus</span> <span class="optional" data-i18n="optional">(optional)</span></label>
        <input type="text" id="custom-focus" data-i18n-placeholder="focus_placeholder" maxlength="500">
      </div>

      <div id="credits-display" class="credits-bar"></div>

      <button id="scan-btn" class="btn-primary">
        <span id="scan-btn-text" data-i18n="scan_btn">Scan</span>
      </button>

      <div id="results" class="results hidden"></div>
    </div>
  </div>
  <script src="popup.js"></script>
</body>
</html>
`;

export const POPUP_JS = String.raw`// Vardin Extension - Popup Script v2.0
// Handles: auth, premium gating, all scan types, file upload, i18n, results

var APP_BASE = 'https://vardin.base44.app';
var LOGIN_URL = APP_BASE + '/login';
var PRICING_URL = APP_BASE + '/pricing';

var ANSWER_TYPE_COSTS = { quick: 3, risk_score: 4, red_flags: 5, detailed: 8 };
var SCAN_TYPE_MODIFIERS = { text: 0, screenshot: 2, both: 2, url: 2, qr: 2, email: 0, chat: 0, marketplace: 0, file: 4 };

var MAX_FILE_SIZE = 10 * 1024 * 1024;

var authToken = null;
var appId = null;
var creditsRemaining = null;
var creditsLimit = null;
var currentLang = 'en';
var uploadedFileData = null;
var uploadedFileName = '';
var decodedQR = '';
var lastAnalysis = null;
var lastScanInfo = null;

// === i18n ===
var I18N = {
  en: {
    lang_name: 'English',
    checking_access: 'Checking access...',
    connect_title: 'Connect Your Account',
    connect_desc: 'Log in to Vardin on your browser to start scanning.',
    open_login: 'Open Vardin Login',
    premium_title: 'Premium Required',
    premium_desc: 'The Vardin Chrome extension requires a Premium subscription.',
    upgrade_premium: 'Upgrade to Premium',
    scan_type: 'Scan Type',
    type_page: 'Page Analysis', type_url: 'URL Reputation', type_screenshot: 'Screenshot',
    type_qr: 'QR Code', type_email: 'Email', type_chat: 'Chat / SMS',
    type_marketplace: 'Marketplace', type_file: 'File',
    scan_mode: 'Scan Mode', mode_text: 'Page Text', mode_screenshot: 'Screenshot', mode_both: 'Text + Screenshot',
    content_label: 'Content',
    content_placeholder_email: 'Paste the email content here...',
    content_placeholder_chat: 'Paste the chat / SMS messages here...',
    content_placeholder_marketplace: 'Paste the marketplace listing here...',
    upload_label: 'Upload', upload_desc: 'Drag & drop, paste, or click to upload',
    capture_screenshot: 'Capture Screenshot', screenshot_captured: 'Screenshot captured!',
    result_type: 'Result Type', result_quick: 'Quick Verdict', result_detailed: 'Detailed Report',
    result_risk: 'Risk Score Only', result_flags: 'Red Flags',
    custom_focus: 'Custom Focus', optional: '(optional)', focus_placeholder: 'e.g., Is this a phishing site?',
    credits_remaining: 'credits', this_scan: 'This scan:',
    scan_btn: 'Scan', scanning: 'Scanning...', analyzing: 'Analyzing...',
    scam: 'SCAM', safe: 'SAFE', confidence: 'Confidence', risk_level: 'RISK',
    red_flags_found: 'Red Flags Found:', no_flags: 'No red flags detected',
    explanation: 'Explanation', what_they_want: 'What They Want',
    tactics_detected: 'Tactics Detected', recommended_actions: 'Recommended Actions',
    scam_category: 'Scam Category', evidence_found: 'Evidence Found', sources_checked: 'Sources Checked',
    not_enough_credits: 'Not enough credits',
    credits_cost_msg: 'This scan costs {cost} credits but you have {remaining} remaining.',
    upgrade_plan: 'Upgrade Plan',
    err_no_text: 'Could not extract text from this page. Try Screenshot mode.',
    err_no_screenshot: 'Could not capture a screenshot of this page.',
    err_no_content: 'Please paste some content to analyze.',
    err_no_file: 'Please upload a file to analyze.',
    err_internal: 'Cannot scan Chrome internal pages.',
    err_no_page: 'Cannot access this page. Try a regular webpage.',
    err_file_large: 'File too large (max 10MB).',
    err_unsupported: 'Unsupported file format.',
    copy_report: 'Copy', share_report: 'Share', download_report: 'Download', scan_again: 'Scan Again',
    report_copied: 'Report copied!', auto_scan: 'Auto-Scan',
    virustotal: 'VirusTotal', vt_detected: 'malicious detections', vt_reputation: 'reputation',
    qr_destination: 'QR Code Destination', decoded_content: 'Decoded Content',
    final_destination: 'Final Destination (After Redirects)', page_title: 'Page Title',
    scanned_on: 'Scanned', language: 'Language'
  },
  he: {
    lang_name: 'עברית',
    checking_access: 'בודק גישה...',
    connect_title: 'חבר את החשבון שלך',
    connect_desc: 'התחבר ל-Vardin בדפדפן שלך כדי להתחיל לסרוק.',
    open_login: 'פתח התחברות Vardin',
    premium_title: 'נדרש Premium',
    premium_desc: 'תוסף Chrome של Vardin דורש מנוי Premium.',
    upgrade_premium: 'שדרג ל-Premium',
    scan_type: 'סוג סריקה',
    type_page: 'ניתוח דף', type_url: 'מוניטין כתובת', type_screenshot: 'צילום מסך',
    type_qr: 'קוד QR', type_email: 'אימייל', type_chat: 'צ\'אט / SMS',
    type_marketplace: 'שוק', type_file: 'קובץ',
    scan_mode: 'מצב סריקה', mode_text: 'טקסט הדף', mode_screenshot: 'צילום מסך', mode_both: 'טקסט + צילום',
    content_label: 'תוכן',
    content_placeholder_email: 'הדבק את תוכן האימייל כאן...',
    content_placeholder_chat: 'הדבק את הודעות הצ\'אט / SMS כאן...',
    content_placeholder_marketplace: 'הדבק את רישום השוק כאן...',
    upload_label: 'העלאה', upload_desc: 'גרור ושחרר, הדבק, או לחץ להעלאה',
    capture_screenshot: 'צלם צילום מסך', screenshot_captured: 'צילום מסך נלכד!',
    result_type: 'סוג תוצאה', result_quick: 'פסק דין מהיר', result_detailed: 'דוח מפורט',
    result_risk: 'ציון סיכון בלבד', result_flags: 'דגלים אדומים',
    custom_focus: 'מיקוד מותאם', optional: '(אופציונלי)', focus_placeholder: 'לדוגמה, האם זה אתר פישינג?',
    credits_remaining: 'קרדיטים', this_scan: 'סריקה זו:',
    scan_btn: 'סרוק', scanning: 'סורק...', analyzing: 'מנתח...',
    scam: 'הונאה', safe: 'בטוח', confidence: 'ביטחון', risk_level: 'סיכון',
    red_flags_found: 'דגלים אדומים שנמצאו:', no_flags: 'לא נמצאו דגלים אדומים',
    explanation: 'הסבר', what_they_want: 'מה הם רוצים',
    tactics_detected: 'טקטיקות שזוהו', recommended_actions: 'פעולות מומלצות',
    scam_category: 'קטגוריית הונאה', evidence_found: 'ראיות שנמצאו', sources_checked: 'מקורות שנבדקו',
    not_enough_credits: 'אין מספיק קרדיטים',
    credits_cost_msg: 'סריקה זו עולה {cost} קרדיטים אך נשארו לך {remaining}.',
    upgrade_plan: 'שדרג תוכנית',
    err_no_text: 'לא ניתן לחלץ טקסט מדף זה. נסה מצב צילום מסך.',
    err_no_screenshot: 'לא ניתן לצלם צילום מסך של דף זה.',
    err_no_content: 'אנא הדבק תוכן לניתוח.',
    err_no_file: 'אנא העלה קובץ לניתוח.',
    err_internal: 'לא ניתן לסרוק דפים פנימיים של Chrome.',
    err_no_page: 'לא ניתן לגשת לדף זה. נסה דף אינטרנט רגיל.',
    err_file_large: 'הקובץ גדול מדי (מקסימום 10MB).',
    err_unsupported: 'פורמט קובץ לא נתמך.',
    copy_report: 'העתק', share_report: 'שתף', download_report: 'הורד', scan_again: 'סרוק שוב',
    report_copied: 'הדוח הועתק!', auto_scan: 'סריקה אוטומטית',
    virustotal: 'VirusTotal', vt_detected: 'זיהויים זדוניים', vt_reputation: 'מוניטין',
    qr_destination: 'יעד קוד QR', decoded_content: 'תוכן מפוענח',
    final_destination: 'יעד סופי (לאחר הפניות)', page_title: 'כותרת דף',
    scanned_on: 'נסרק', language: 'שפה'
  },
  es: {
    lang_name: 'Español',
    checking_access: 'Verificando acceso...',
    connect_title: 'Conecta tu cuenta',
    connect_desc: 'Inicia sesión en Vardin en tu navegador para empezar a escanear.',
    open_login: 'Abrir inicio de sesión Vardin',
    premium_title: 'Se requiere Premium',
    premium_desc: 'La extensión de Chrome de Vardin requiere una suscripción Premium.',
    upgrade_premium: 'Actualizar a Premium',
    scan_type: 'Tipo de escaneo',
    type_page: 'Análisis de página', type_url: 'Reputación de URL', type_screenshot: 'Captura de pantalla',
    type_qr: 'Código QR', type_email: 'Correo', type_chat: 'Chat / SMS',
    type_marketplace: 'Marketplace', type_file: 'Archivo',
    scan_mode: 'Modo de escaneo', mode_text: 'Texto de la página', mode_screenshot: 'Captura de pantalla', mode_both: 'Texto + Captura',
    content_label: 'Contenido',
    content_placeholder_email: 'Pega el contenido del correo aquí...',
    content_placeholder_chat: 'Pega los mensajes de chat / SMS aquí...',
    content_placeholder_marketplace: 'Pega el listado del marketplace aquí...',
    upload_label: 'Subir', upload_desc: 'Arrastra, pega, o haz clic para subir',
    capture_screenshot: 'Capturar pantalla', screenshot_captured: '¡Captura realizada!',
    result_type: 'Tipo de resultado', result_quick: 'Veredicto rápido', result_detailed: 'Informe detallado',
    result_risk: 'Solo puntuación de riesgo', result_flags: 'Banderas rojas',
    custom_focus: 'Enfoque personalizado', optional: '(opcional)', focus_placeholder: 'ej., ¿Es este un sitio de phishing?',
    credits_remaining: 'créditos', this_scan: 'Este escaneo:',
    scan_btn: 'Escanear', scanning: 'Escaneando...', analyzing: 'Analizando...',
    scam: 'ESTAFA', safe: 'SEGURO', confidence: 'Confianza', risk_level: 'RIESGO',
    red_flags_found: 'Banderas rojas encontradas:', no_flags: 'No se detectaron banderas rojas',
    explanation: 'Explicación', what_they_want: 'Lo que quieren',
    tactics_detected: 'Tácticas detectadas', recommended_actions: 'Acciones recomendadas',
    scam_category: 'Categoría de estafa', evidence_found: 'Evidencia encontrada', sources_checked: 'Fuentes verificadas',
    not_enough_credits: 'Créditos insuficientes',
    credits_cost_msg: 'Este escaneo cuesta {cost} créditos pero te quedan {remaining}.',
    upgrade_plan: 'Mejorar plan',
    err_no_text: 'No se pudo extraer texto de esta página. Prueba el modo Captura.',
    err_no_screenshot: 'No se pudo capturar la pantalla de esta página.',
    err_no_content: 'Por favor pega algún contenido para analizar.',
    err_no_file: 'Por favor sube un archivo para analizar.',
    err_internal: 'No se pueden escanear páginas internas de Chrome.',
    err_no_page: 'No se puede acceder a esta página. Prueba una página web normal.',
    err_file_large: 'Archivo demasiado grande (máx 10MB).',
    err_unsupported: 'Formato de archivo no compatible.',
    copy_report: 'Copiar', share_report: 'Compartir', download_report: 'Descargar', scan_again: 'Escanear de nuevo',
    report_copied: '¡Informe copiado!', auto_scan: 'Auto-escaneo',
    virustotal: 'VirusTotal', vt_detected: 'detecciones maliciosas', vt_reputation: 'reputación',
    qr_destination: 'Destino del código QR', decoded_content: 'Contenido decodificado',
    final_destination: 'Destino final (después de redirecciones)', page_title: 'Título de la página',
    scanned_on: 'Escaneado', language: 'Idioma'
  }
};

var LANGS = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'he', label: '\u05E2\u05D1\u05E8\u05D9\u05EA', dir: 'rtl' },
  { code: 'es', label: 'Espa\u00F1ol', dir: 'ltr' }
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
  onScanTypeChange();
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
  var btnText = document.getElementById('scan-btn-text');
  if (btnText && !btnText.dataset.scanning) {
    btnText.textContent = t('scan_btn');
  }
  var scanTypeSel = document.getElementById('scan-type');
  if (scanTypeSel) {
    var types = ['page','url','screenshot','qr','email','chat','marketplace','file'];
    var typeKeys = ['type_page','type_url','type_screenshot','type_qr','type_email','type_chat','type_marketplace','type_file'];
    for (var i = 0; i < types.length; i++) {
      scanTypeSel.options[i].text = t(typeKeys[i]);
    }
  }
  var modeSel = document.getElementById('scan-mode');
  if (modeSel) {
    modeSel.options[0].text = t('mode_text');
    modeSel.options[1].text = t('mode_screenshot');
    modeSel.options[2].text = t('mode_both');
  }
  var ansSel = document.getElementById('answer-type');
  if (ansSel) {
    ansSel.options[0].text = t('result_quick');
    ansSel.options[1].text = t('result_detailed');
    ansSel.options[2].text = t('result_risk');
    ansSel.options[3].text = t('result_flags');
  }
  updateCreditDisplay();
}

function escapeHtml(text) {
  if (text == null) return '';
  var div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function showView(name) {
  var views = ['loading', 'login', 'upgrade', 'scan'];
  for (var i = 0; i < views.length; i++) {
    var el = document.getElementById(views[i] + '-view');
    if (el) el.classList.toggle('hidden', views[i] !== name);
  }
}

function getStoredAuth() {
  return new Promise(function(resolve) {
    chrome.storage.local.get(['authToken', 'appId'], resolve);
  });
}

async function checkAuth() {
  try {
    var response = await fetch(APP_BASE + '/api/apps/' + appId + '/functions/checkExtensionAuth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken, 'X-App-Id': appId || '' },
      body: JSON.stringify({})
    });
    if (response.status === 401) return { authenticated: false, premium: false };
    if (response.status === 403) return { authenticated: true, premium: false };
    if (!response.ok) throw new Error('Auth check failed (' + response.status + ')');
    var data = await response.json();
    return { authenticated: true, premium: data.premium, plan: data.plan, userName: data.user_name, creditsRemaining: data.credits_remaining, creditsLimit: data.credits_limit };
  } catch (error) {
    return { authenticated: false, premium: false, error: error.message };
  }
}

function getCreditCost() {
  var scanType = document.getElementById('scan-type').value;
  var answerType = document.getElementById('answer-type').value;
  var base = ANSWER_TYPE_COSTS[answerType] || 8;
  var modifier = 0;
  if (scanType === 'page') {
    var scanMode = document.getElementById('scan-mode').value;
    modifier = SCAN_TYPE_MODIFIERS[scanMode] || 0;
  } else {
    modifier = SCAN_TYPE_MODIFIERS[scanType] || 0;
  }
  return base + modifier;
}

function updateCreditDisplay() {
  var el = document.getElementById('credits-display');
  if (!el) return;
  var cost = getCreditCost();
  if (creditsRemaining != null && creditsLimit != null) {
    el.innerHTML = '<span class="credits-remaining">' + creditsRemaining + ' / ' + creditsLimit + ' ' + t('credits_remaining') + '</span>' +
      '<span class="credits-cost">' + t('this_scan') + ' ' + cost + '</span>';
  }
}

function onScanTypeChange() {
  var scanType = document.getElementById('scan-type').value;
  document.getElementById('page-mode-field').classList.toggle('hidden', scanType !== 'page');
  var showText = scanType === 'email' || scanType === 'chat' || scanType === 'marketplace';
  document.getElementById('text-input-field').classList.toggle('hidden', !showText);
  if (showText) {
    document.getElementById('content-input').placeholder = t('content_placeholder_' + scanType);
  }
  var showUpload = scanType === 'qr' || scanType === 'file' || scanType === 'screenshot';
  document.getElementById('upload-field').classList.toggle('hidden', !showUpload);
  document.getElementById('capture-field').classList.toggle('hidden', scanType !== 'screenshot' && scanType !== 'qr');
  var fileInput = document.getElementById('file-input');
  if (scanType === 'file') {
    fileInput.accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.jpg,.jpeg,.png,.webp,.heic';
  } else {
    fileInput.accept = 'image/*';
  }
  uploadedFileData = null;
  uploadedFileName = '';
  decodedQR = '';
  var dzt = document.getElementById('drop-zone-text');
  if (dzt) dzt.textContent = t('upload_desc');
  updateCreditDisplay();
}

function handleFile(file) {
  if (!file) return;
  if (file.size > MAX_FILE_SIZE) {
    showError(t('err_file_large'));
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    uploadedFileData = e.target.result;
    uploadedFileName = file.name;
    document.getElementById('drop-zone-text').textContent = file.name;
    var scanType = document.getElementById('scan-type').value;
    if (scanType === 'qr') {
      decodedQR = '';
      decodeQRCode(uploadedFileData).then(function(decoded) {
        if (decoded) {
          decodedQR = decoded;
          document.getElementById('drop-zone-text').textContent = 'QR: ' + decoded.substring(0, 60);
        }
      });
    }
  };
  reader.onerror = function() {
    showError(t('err_unsupported'));
  };
  reader.readAsDataURL(file);
}

async function decodeQRCode(dataUrl) {
  if (typeof BarcodeDetector === 'undefined') return '';
  try {
    var blob = await (await fetch(dataUrl)).blob();
    var bitmap = await createImageBitmap(blob);
    var detector = new BarcodeDetector({ formats: ['qr_code'] });
    var codes = await detector.detect(bitmap);
    if (codes.length > 0) return codes[0].rawValue;
    return '';
  } catch (e) {
    return '';
  }
}

function showError(msg) {
  var resultsDiv = document.getElementById('results');
  resultsDiv.classList.remove('hidden');
  resultsDiv.innerHTML = '<div class="error-box"><p>' + escapeHtml('\u26A0\uFE0F ' + msg) + '</p></div>';
}

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
    var scanType = document.getElementById('scan-type').value;
    var answerType = document.getElementById('answer-type').value;
    var customFocus = document.getElementById('custom-focus').value.trim().slice(0, 500);

    chrome.storage.local.set({ scanType: scanType, answerType: answerType });

    var pageText = '';
    var screenshotDataUrl = '';
    var fileData = null;
    var fileName = '';

    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    var tab = tabs[0];
    var pageUrl = tab ? tab.url : '';

    if (pageUrl && (pageUrl.indexOf('chrome://') === 0 || pageUrl.indexOf('chrome-extension://') === 0)) {
      if (scanType === 'page' || scanType === 'url' || scanType === 'screenshot') {
        throw new Error(t('err_internal'));
      }
    }

    if (scanType === 'page') {
      var scanMode = document.getElementById('scan-mode').value;
      if (scanMode === 'text' || scanMode === 'both') {
        try {
          var results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: function() { return document.body ? document.body.innerText.slice(0, 10000) : ''; }
          });
          pageText = (results && results[0] && results[0].result) || '';
        } catch (textErr) {
          if (scanMode === 'text') throw new Error(t('err_no_text'));
        }
      }
      if (scanMode === 'screenshot' || scanMode === 'both') {
        try {
          screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 60 });
        } catch (shotErr) {
          if (scanMode === 'screenshot') throw new Error(t('err_no_screenshot'));
        }
      }
    } else if (scanType === 'email' || scanType === 'chat' || scanType === 'marketplace') {
      pageText = document.getElementById('content-input').value.trim();
      if (!pageText) throw new Error(t('err_no_content'));
    } else if (scanType === 'screenshot') {
      if (uploadedFileData) {
        screenshotDataUrl = uploadedFileData;
      } else {
        try {
          screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 60 });
        } catch (shotErr) {
          throw new Error(t('err_no_screenshot'));
        }
      }
    } else if (scanType === 'qr') {
      if (uploadedFileData) {
        screenshotDataUrl = uploadedFileData;
      } else {
        try {
          screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 60 });
        } catch (shotErr) {
          throw new Error(t('err_no_screenshot'));
        }
      }
    } else if (scanType === 'file') {
      if (!uploadedFileData) throw new Error(t('err_no_file'));
      fileData = uploadedFileData;
      fileName = uploadedFileName;
    }

    var response = await fetch(APP_BASE + '/api/apps/' + appId + '/functions/scanWebpage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken, 'X-App-Id': appId || '' },
      body: JSON.stringify({
        page_text: pageText,
        screenshot_data_url: screenshotDataUrl,
        file_data: fileData,
        file_name: fileName,
        page_url: pageUrl,
        options: {
          scan_type: scanType,
          scan_mode: scanType === 'page' ? document.getElementById('scan-mode').value : scanType,
          answer_type: answerType,
          custom_focus: customFocus,
          language: currentLang,
          decoded_content: scanType === 'qr' ? decodedQR : ''
        }
      })
    });

    if (response.status === 401) { showView('login'); return; }
    if (response.status === 403) { showView('upgrade'); return; }
    if (response.status === 402) {
      var data402 = await response.json();
      creditsRemaining = data402.credits_remaining || 0;
      creditsLimit = data402.credits_limit || 0;
      updateCreditDisplay();
      resultsDiv.innerHTML = '<div class="error-box"><p>\u26A0\uFE0F ' + t('not_enough_credits') + '</p><p class="error-sub">' + t('credits_cost_msg', { cost: data402.credit_cost || getCreditCost(), remaining: creditsRemaining }) + '</p><button id="upgrade-inline-btn" class="btn-primary" style="margin-top:8px">' + t('upgrade_plan') + '</button></div>';
      document.getElementById('upgrade-inline-btn').addEventListener('click', function() { chrome.tabs.create({ url: PRICING_URL }); });
      return;
    }
    if (!response.ok) {
      var errData = await response.json().catch(function() { return {}; });
      throw new Error(errData.error || 'Server error (' + response.status + ')');
    }

    var data = await response.json();
    if (data.credits_remaining != null) {
      creditsRemaining = data.credits_remaining;
      creditsLimit = data.credits_limit || creditsLimit;
      updateCreditDisplay();
    }
    lastAnalysis = data.analysis || {};
    lastScanInfo = { scan_type: data.scan_type, answer_type: data.answer_type, virustotal: data.virustotal, timestamp: data.timestamp, credits_used: data.credits_used };
    displayResults(data, data.answer_type || answerType);
  } catch (error) {
    resultsDiv.innerHTML = '<div class="error-box"><p>' + escapeHtml('\u26A0\uFE0F ' + error.message) + '</p></div>';
  } finally {
    btn.disabled = false;
    delete btnText.dataset.scanning;
    btnText.textContent = t('scan_btn');
  }
}

function displayResults(data, answerType) {
  var resultsDiv = document.getElementById('results');
  var a = data.analysis || {};
  var mode = data.answer_type || answerType;
  var html = '';

  // VirusTotal badge
  if (data.virustotal) {
    var vt = data.virustotal;
    var vtCls = vt.malicious > 0 ? 'danger' : 'safe';
    html += '<div class="vt-badge ' + vtCls + '"><strong>' + t('virustotal') + ':</strong> ' + vt.malicious + '/' + vt.total_engines + ' ' + t('vt_detected') + ' \u00B7 ' + t('vt_reputation') + ': ' + vt.reputation + '</div>';
  }

  // QR destination card (shown BEFORE risk assessment)
  if (data.scan_type === 'qr') {
    var qrDecoded = data.decoded_content || a.decoded_content;
    var qrFinalUrl = data.final_destination_url || a.final_destination_url;
    var qrPageTitle = data.destination_title;
    var qrDestDesc = a.destination_description;
    if (qrDecoded || qrFinalUrl) {
      html += '<div class="qr-dest-card">';
      html += '<p class="qr-dest-title">\uD83D\uDCBC ' + t('qr_destination') + '</p>';
      if (qrDecoded) {
        html += '<p class="qr-label">' + t('decoded_content') + '</p>';
        html += '<p class="qr-value">' + escapeHtml(qrDecoded) + '</p>';
      }
      if (qrFinalUrl && qrFinalUrl !== qrDecoded) {
        html += '<p class="qr-label">' + t('final_destination') + '</p>';
        html += '<p class="qr-value"><a href="' + escapeHtml(qrFinalUrl) + '" target="_blank" rel="noopener">' + escapeHtml(qrFinalUrl) + '</a></p>';
      }
      if (qrPageTitle) {
        html += '<p class="qr-label">' + t('page_title') + '</p>';
        html += '<p class="qr-value">' + escapeHtml(qrPageTitle) + '</p>';
      }
      if (qrDestDesc) {
        html += '<p class="qr-value">' + escapeHtml(qrDestDesc) + '</p>';
      }
      html += '</div>';
    }
  }

  if (mode === 'quick') {
    var isScam = a.is_scam;
    var cls = isScam ? 'danger' : 'safe';
    html += '<div class="result-card ' + cls + '"><div class="verdict-badge ' + cls + '">' + (isScam ? '\u26A0\uFE0F ' + t('scam') : '\u2705 ' + t('safe')) + '</div><p class="verdict-text">' + escapeHtml(a.verdict) + '</p>' + (a.confidence != null ? '<p class="confidence">' + t('confidence') + ': ' + escapeHtml(a.confidence) + '%</p>' : '') + '</div>';
  } else if (mode === 'risk_score') {
    var score = a.risk_score || 0;
    var level = a.risk_level || 'low';
    var cls2 = score >= 70 ? 'danger' : score >= 40 ? 'warning' : 'safe';
    html += '<div class="result-card ' + cls2 + '"><div class="score-display"><span class="score-number">' + escapeHtml(score) + '</span><span class="score-max">/100</span></div><div class="risk-bar"><div class="risk-fill ' + cls2 + '" style="width:' + score + '%"></div></div><p class="risk-level ' + cls2 + '">' + escapeHtml(level.toUpperCase()) + ' ' + t('risk_level') + '</p>' + (a.summary ? '<p class="summary">' + escapeHtml(a.summary) + '</p>' : '') + '</div>';
  } else if (mode === 'red_flags') {
    var flags = a.red_flags || [];
    var risk = a.overall_risk || 'low';
    var cls3 = risk === 'high' ? 'danger' : risk === 'medium' ? 'warning' : 'safe';
    html += '<div class="result-card ' + cls3 + '"><p class="card-title">' + t('red_flags_found') + ' ' + flags.length + '</p><p class="risk-level ' + cls3 + '">' + escapeHtml(risk.toUpperCase()) + ' ' + t('risk_level') + '</p>';
    if (flags.length > 0) {
      html += '<ul class="flag-list">';
      for (var i = 0; i < flags.length; i++) html += '<li>' + escapeHtml(flags[i]) + '</li>';
      html += '</ul>';
    } else {
      html += '<p class="empty">' + t('no_flags') + ' \u2705</p>';
    }
    html += '</div>';
  } else {
    var dScore = a.risk_score || 0;
    var dLevel = a.risk_level || 'low';
    var dCls = dLevel === 'high' ? 'danger' : dLevel === 'medium' ? 'warning' : 'safe';
    html += '<div class="result-card ' + dCls + '">';
    html += '<div class="result-header"><div class="score-display small"><span class="score-number">' + escapeHtml(dScore) + '</span><span class="score-max">/100</span></div><span class="risk-level ' + dCls + '">' + escapeHtml(dLevel.toUpperCase()) + ' ' + t('risk_level') + '</span></div>';
    if (a.confidence != null) html += '<p class="confidence">' + t('confidence') + ': ' + escapeHtml(a.confidence) + '%</p>';
    if (a.is_scam != null) html += '<div class="verdict-badge ' + (a.is_scam ? 'danger' : 'safe') + '">' + (a.is_scam ? ('\u26A0\uFE0F ' + t('scam')) : ('\u2705 ' + t('safe'))) + '</div>';
    if (a.scam_category) html += '<div class="section"><p class="section-label">' + t('scam_category') + '</p><p class="section-text">' + escapeHtml(a.scam_category) + '</p></div>';
    if (a.explanation) html += '<div class="section"><p class="section-label">' + t('explanation') + '</p><p class="section-text">' + escapeHtml(a.explanation) + '</p></div>';
    if (a.what_they_want) html += '<div class="section"><p class="section-label">' + t('what_they_want') + '</p><p class="section-text">' + escapeHtml(a.what_they_want) + '</p></div>';
    if (a.tactics_detected && a.tactics_detected.length) {
      html += '<div class="section"><p class="section-label">' + t('tactics_detected') + '</p><ul class="flag-list">';
      for (var tt = 0; tt < a.tactics_detected.length; tt++) html += '<li>' + escapeHtml(a.tactics_detected[tt]) + '</li>';
      html += '</ul></div>';
    }
    if (a.red_flags && a.red_flags.length) {
      html += '<div class="section"><p class="section-label">' + t('red_flags_found') + '</p><ul class="flag-list">';
      for (var r = 0; r < a.red_flags.length; r++) html += '<li>' + escapeHtml(a.red_flags[r]) + '</li>';
      html += '</ul></div>';
    }
    if (a.evidence_found && a.evidence_found.length) {
      html += '<div class="section"><p class="section-label">' + t('evidence_found') + '</p><ul class="flag-list">';
      for (var e = 0; e < a.evidence_found.length; e++) html += '<li>' + escapeHtml(a.evidence_found[e]) + '</li>';
      html += '</ul></div>';
    }
    if (a.sources_checked && a.sources_checked.length) {
      html += '<div class="section"><p class="section-label">' + t('sources_checked') + '</p><div class="source-tags">';
      for (var s2 = 0; s2 < a.sources_checked.length; s2++) html += '<span class="source-tag">' + escapeHtml(a.sources_checked[s2]) + '</span>';
      html += '</div></div>';
    }
    if (a.next_steps && a.next_steps.length) {
      html += '<div class="section"><p class="section-label">' + t('recommended_actions') + '</p><ul class="action-list">';
      for (var s = 0; s < a.next_steps.length; s++) html += '<li>' + escapeHtml(a.next_steps[s]) + '</li>';
      html += '</ul></div>';
    }
    html += '</div>';
  }

  // Action buttons
  html += '<div class="actions-bar">';
  html += '<button class="btn-action" id="act-copy">' + t('copy_report') + '</button>';
  html += '<button class="btn-action" id="act-share">' + t('share_report') + '</button>';
  html += '<button class="btn-action" id="act-download">' + t('download_report') + '</button>';
  html += '<button class="btn-action" id="act-rescan">' + t('scan_again') + '</button>';
  html += '</div>';

  if (data.timestamp) {
    html += '<p class="timestamp">' + t('scanned_on') + ': ' + escapeHtml(new Date(data.timestamp).toLocaleString()) + '</p>';
  }

  resultsDiv.innerHTML = html;

  // Wire action buttons
  var copyBtn = document.getElementById('act-copy');
  if (copyBtn) copyBtn.addEventListener('click', function() {
    var text = JSON.stringify(lastAnalysis, null, 2);
    navigator.clipboard.writeText(text).then(function() {
      copyBtn.textContent = '\u2713 ' + t('report_copied');
      setTimeout(function() { copyBtn.textContent = t('copy_report'); }, 2000);
    });
  });
  var shareBtn = document.getElementById('act-share');
  if (shareBtn) shareBtn.addEventListener('click', function() {
    var shareText = JSON.stringify(lastAnalysis, null, 2);
    if (navigator.share) {
      navigator.share({ title: 'Vardin Scan Report', text: shareText }).catch(function() {});
    } else {
      navigator.clipboard.writeText(shareText).then(function() {
        shareBtn.textContent = '\u2713 ' + t('report_copied');
        setTimeout(function() { shareBtn.textContent = t('share_report'); }, 2000);
      });
    }
  });
  var dlBtn = document.getElementById('act-download');
  if (dlBtn) dlBtn.addEventListener('click', function() {
    var blob = new Blob([JSON.stringify(lastAnalysis, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a2 = document.createElement('a');
    a2.href = url;
    a2.download = 'vardin-report-' + Date.now() + '.json';
    document.body.appendChild(a2);
    a2.click();
    document.body.removeChild(a2);
    URL.revokeObjectURL(url);
  });
  var rescanBtn = document.getElementById('act-rescan');
  if (rescanBtn) rescanBtn.addEventListener('click', function() {
    var resultsDiv2 = document.getElementById('results');
    resultsDiv2.classList.add('hidden');
    resultsDiv2.innerHTML = '';
  });
}

async function init() {
  showView('loading');
  var savedLang = await chrome.storage.local.get(['lang']);
  if (savedLang.lang && I18N[savedLang.lang]) currentLang = savedLang.lang;
  var langInfo = LANGS.find(function(l) { return l.code === currentLang; });
  document.documentElement.lang = currentLang;
  document.documentElement.dir = langInfo ? langInfo.dir : 'ltr';
  var langSelect = document.getElementById('lang-select');
  if (langSelect) langSelect.value = currentLang;
  applyTranslations();

  var saved = await chrome.storage.local.get(['scanType', 'answerType', 'autoScan']);
  var scanTypeSel = document.getElementById('scan-type');
  if (saved.scanType) scanTypeSel.value = saved.scanType;
  if (saved.answerType) document.getElementById('answer-type').value = saved.answerType;
  var autoToggle = document.getElementById('auto-scan-toggle');
  if (autoToggle) autoToggle.checked = !!saved.autoScan;
  onScanTypeChange();

  var stored = await getStoredAuth();
  if (!stored.authToken) { showView('login'); return; }
  authToken = stored.authToken;
  appId = stored.appId;

  var authResult = await checkAuth();
  if (!authResult.authenticated) { showView('login'); return; }
  if (!authResult.premium) { showView('upgrade'); return; }
  creditsRemaining = authResult.creditsRemaining;
  creditsLimit = authResult.creditsLimit;
  var badge = document.getElementById('plan-badge');
  if (badge) { badge.textContent = authResult.plan ? authResult.plan.toUpperCase() : 'PREMIUM'; badge.classList.remove('hidden'); }
  showView('scan');
  updateCreditDisplay();
}

document.addEventListener('DOMContentLoaded', function() {
  init();
  document.getElementById('login-btn').addEventListener('click', function() { chrome.tabs.create({ url: LOGIN_URL }); });
  document.getElementById('upgrade-btn').addEventListener('click', function() { chrome.tabs.create({ url: PRICING_URL }); });
  document.getElementById('scan-btn').addEventListener('click', scanPage);
  document.getElementById('scan-type').addEventListener('change', onScanTypeChange);
  document.getElementById('scan-mode').addEventListener('change', updateCreditDisplay);
  document.getElementById('lang-select').addEventListener('change', function(e) { setLang(e.target.value); });

  // Auto-scan toggle
  var autoToggle = document.getElementById('auto-scan-toggle');
  if (autoToggle) {
    autoToggle.addEventListener('change', function(e) {
      chrome.storage.local.set({ autoScan: e.target.checked });
    });
  }

  // Capture screenshot button
  var captureBtn = document.getElementById('capture-btn');
  if (captureBtn) {
    captureBtn.addEventListener('click', async function() {
      var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      var tab = tabs[0];
      if (!tab) return;
      try {
        var dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 60 });
        uploadedFileData = dataUrl;
        uploadedFileName = 'screenshot.jpg';
        document.getElementById('drop-zone-text').textContent = t('screenshot_captured');
      } catch (e) {
        showError(t('err_no_screenshot'));
      }
    });
  }

  // Drop zone
  var dropZone = document.getElementById('drop-zone');
  if (dropZone) {
    dropZone.addEventListener('click', function() { document.getElementById('file-input').click(); });
    dropZone.addEventListener('dragover', function(e) { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', function() { dropZone.classList.remove('drag-over'); });
    dropZone.addEventListener('drop', function(e) {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
  }

  // File input
  var fileInput = document.getElementById('file-input');
  if (fileInput) {
    fileInput.addEventListener('change', function(e) { if (e.target.files[0]) handleFile(e.target.files[0]); });
  }

  // Paste handler for images
  document.addEventListener('paste', function(e) {
    var uploadVisible = !document.getElementById('upload-field').classList.contains('hidden');
    if (!uploadVisible) return;
    var items = e.clipboardData.items;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        handleFile(items[i].getAsFile());
        e.preventDefault();
        return;
      }
    }
  });
});

chrome.storage.onChanged.addListener(function(changes, area) {
  if (area !== 'local') return;
  if (changes.authToken) {
    if (changes.authToken.newValue) init();
    else showView('login');
  }
  if (changes.lang && changes.lang.newValue) {
    if (I18N[changes.lang.newValue]) {
      currentLang = changes.lang.newValue;
      var langInfo = LANGS.find(function(l) { return l.code === currentLang; });
      document.documentElement.lang = currentLang;
      document.documentElement.dir = langInfo ? langInfo.dir : 'ltr';
      var langSelect = document.getElementById('lang-select');
      if (langSelect) langSelect.value = currentLang;
      applyTranslations();
    }
  }
});
`;