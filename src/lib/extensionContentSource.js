// Extension source: content.js (auth bridge on the Vardin site) and
// protection.js (the page-side protection layer).

export const CONTENT_JS = String.raw`// Vardin Extension - Content Script (runs on vardin.base44.app only)
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

sendAuthToBackground();
syncLanguage();

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
`;

export const PROTECTION_JS = String.raw`// Vardin Extension - Protection Content Script v3.0 (runs on all URLs)
// Lookalike-domain detection, full-page block for confirmed threats, submit
// guard, phone-number collection and clipboard checks.
//
// FALSE-POSITIVE RULES (see shared.js): a page is only ever replaced when the
// verdict carries hard evidence or a high-confidence explicit scam call; a
// medium score never interrupts anything; a domain is only called a lookalike
// when it is a near-miss of a distinctive brand. Every warning is dismissible
// and "never warn here" is one click away.

(function() {
  'use strict';

  var G = self.VardinGuard;
  if (!G) return;
  if (G.isInternalUrl(window.location.href)) return;

  var HOST = (window.location.hostname || '').toLowerCase();
  if (G.isOwnHost(HOST)) return;

  var state = {
    tier: 'none',
    score: 0,
    summary: '',
    allowed: false,
    overridden: false,
    alertPreference: 'all'
  };

  // === Styles ===
  var style = document.createElement('style');
  style.textContent = [
    '.vardin-banner { position: fixed; top: 0; left: 0; right: 0; z-index: 2147483646; padding: 10px 16px; background: #fef3c7; color: #78350f; border-bottom: 1px solid #fde68a; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; gap: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }',
    '.vardin-banner strong { font-weight: 700; }',
    '.vardin-banner .vardin-close { margin-left: auto; cursor: pointer; opacity: 0.7; background: none; border: none; color: inherit; font-size: 18px; line-height: 1; }',
    '.vardin-banner .vardin-close:hover { opacity: 1; }',
    '.vardin-banner .vardin-mini { cursor: pointer; background: #ffffff; border: 1px solid #fde68a; border-radius: 6px; color: #78350f; font-size: 11px; font-weight: 600; padding: 3px 8px; white-space: nowrap; }',
    '.vardin-block { position: fixed; inset: 0; z-index: 2147483647; background: #f8fafc; color: #172126; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; justify-content: center; padding: 24px; }',
    '.vardin-block-card { max-width: 560px; width: 100%; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 32px; box-shadow: 0 18px 48px rgba(15,23,42,0.12); }',
    '.vardin-block-icon { width: 48px; height: 48px; border-radius: 12px; background: #fef2f2; color: #b91c1c; display: flex; align-items: center; justify-content: center; font-size: 26px; margin-bottom: 16px; }',
    '.vardin-block h1 { font-size: 22px; line-height: 1.25; margin: 0 0 8px; font-weight: 700; }',
    '.vardin-block p { font-size: 14px; line-height: 1.6; color: #606f76; margin: 0 0 12px; }',
    '.vardin-block ul { margin: 0 0 16px; padding-left: 18px; font-size: 13px; line-height: 1.6; color: #172126; }',
    '.vardin-block .vardin-score { display: inline-block; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; background: #fef2f2; color: #b91c1c; margin-bottom: 14px; }',
    '.vardin-block-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; }',
    '.vardin-btn-leave { background: #18776a; color: #ffffff; border: none; border-radius: 10px; padding: 12px 20px; font-size: 14px; font-weight: 700; cursor: pointer; }',
    '.vardin-btn-leave:hover { background: #145f55; }',
    '.vardin-btn-continue { background: transparent; color: #606f76; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 20px; font-size: 14px; font-weight: 600; cursor: pointer; }',
    '.vardin-btn-continue:hover { background: #f9fbfb; }',
    '.vardin-block-note { font-size: 11px; color: #8a979d; margin-top: 14px; line-height: 1.5; }',
    '.vardin-paste-warning { position: fixed; bottom: 16px; right: 16px; z-index: 2147483646; padding: 12px 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; color: #991b1b; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; box-shadow: 0 4px 12px rgba(0,0,0,0.15); max-width: 320px; }'
  ].join('\n');
  document.head.appendChild(style);

  // === Helpers ===
  function readSession(key) {
    try { return sessionStorage.getItem(key); } catch (e) { return null; }
  }

  function writeSession(key, value) {
    try { sessionStorage.setItem(key, value); } catch (e) {}
  }

  function safeSummary(text) {
    return String(text || '').replace(/[<>]/g, '').slice(0, 300);
  }

  // === Lookalike domain banner (deterministic, offline, no scan) ===
  function showLookalikeBanner(info) {
    if (state.allowed) return;
    if (readSession('vardin_lk_dismissed_' + HOST)) return;
    if (document.getElementById('vardin-lookalike-banner')) return;

    var real = info.brand + '.com';
    var banner = document.createElement('div');
    banner.id = 'vardin-lookalike-banner';
    banner.className = 'vardin-banner';
    banner.innerHTML = '<span>\uD83D\uDD0E <strong>Vardin:</strong> this address looks like it is imitating ' +
      info.brand.charAt(0).toUpperCase() + info.brand.slice(1) + '. The real site is ' + real + '. Double-check before you sign in or pay.</span>' +
      '<button class="vardin-mini" id="vardin-lk-allow">Never warn here</button>' +
      '<button class="vardin-close" id="vardin-lk-close">&times;</button>';
    document.body.insertBefore(banner, document.body.firstChild);

    var close = document.getElementById('vardin-lk-close');
    if (close) close.addEventListener('click', function () {
      writeSession('vardin_lk_dismissed_' + HOST, '1');
      banner.remove();
    });

    var allow = document.getElementById('vardin-lk-allow');
    if (allow) allow.addEventListener('click', function () {
      state.allowed = true;
      chrome.runtime.sendMessage({ type: 'SET_SITE', host: HOST, kind: 'allow', on: true });
      banner.remove();
    });
  }

  // === Full-page block (only for a confirmed dangerous verdict) ===
  function showBlockOverlay(entry) {
    if (document.getElementById('vardin-block')) return;
    if (readSession('vardin_allowed_' + HOST)) return;

    var reasons = [];
    if (typeof entry.summary === 'string' && entry.summary) reasons.push(entry.summary);
    if (Array.isArray(entry.red_flags)) reasons = reasons.concat(entry.red_flags.slice(0, 4));
    if (reasons.length === 0) reasons.push('This page matched strong scam or malware evidence.');

    var el = document.createElement('div');
    el.id = 'vardin-block';
    el.className = 'vardin-block';
    var items = '';
    for (var i = 0; i < reasons.length; i++) items += '<li>' + safeSummary(reasons[i]) + '</li>';

    el.innerHTML = '<div class="vardin-block-card">' +
      '<div class="vardin-block-icon">\u26A0</div>' +
      '<h1>This page looks dangerous</h1>' +
      (entry.score ? '<div class="vardin-score">Risk ' + entry.score + '/100</div>' : '') +
      '<p>Vardin stopped you here because this page matched strong scam or malware evidence:</p>' +
      '<ul>' + items + '</ul>' +
      '<div class="vardin-block-actions">' +
      '<button class="vardin-btn-leave" id="vardin-leave">Leave this site</button>' +
      '<button class="vardin-btn-continue" id="vardin-continue">Continue anyway</button>' +
      '</div>' +
      '<p class="vardin-block-note">Automated assessment, not a guarantee. If you must continue, do not enter passwords, card numbers or crypto details on this page.</p>' +
      '</div>';

    document.documentElement.appendChild(el);
    document.documentElement.style.overflow = 'hidden';

    chrome.runtime.sendMessage({
      type: 'VARDIN_BLOCKED',
      host: HOST,
      url: window.location.href,
      score: entry.score || 0,
      summary: reasons[0] || ''
    });

    var leave = document.getElementById('vardin-leave');
    if (leave) leave.addEventListener('click', function () {
      try { window.location.replace('about:blank'); } catch (e) {}
    });

    var cont = document.getElementById('vardin-continue');
    if (cont) cont.addEventListener('click', function () {
      state.overridden = true;
      writeSession('vardin_allowed_' + HOST, '1');
      document.documentElement.style.overflow = '';
      el.remove();
    });
  }

  // === High-risk banner (never shown for a medium score) ===
  function showRiskBanner(entry) {
    if (state.allowed || state.overridden) return;
    if (readSession('vardin_banner_dismissed_' + HOST)) return;
    if (document.getElementById('vardin-warning-banner')) return;
    if (entry.tier !== 'warn' && entry.tier !== 'block') return;

    var banner = document.createElement('div');
    banner.id = 'vardin-warning-banner';
    banner.className = 'vardin-banner';
    banner.innerHTML = '<span>\u26A0\uFE0F <strong>Vardin:</strong> this site shows strong scam indicators' +
      (entry.score ? ' (risk ' + entry.score + '/100)' : '') +
      '. Be careful with passwords, card details and payments here.</span>' +
      '<button class="vardin-close" id="vardin-banner-close">&times;</button>';
    document.body.insertBefore(banner, document.body.firstChild);

    var close = document.getElementById('vardin-banner-close');
    if (close) close.addEventListener('click', function () {
      writeSession('vardin_banner_dismissed_' + HOST, '1');
      banner.remove();
    });
  }

  function applyTier(entry) {
    state.tier = entry.tier || 'none';
    state.score = entry.score || 0;
    state.summary = entry.summary || '';
    if (state.tier === 'block') showBlockOverlay(entry);
    else if (state.tier === 'warn') showRiskBanner(entry);
    // 'info' and 'none' deliberately change nothing on the page.
  }

  // === Submit guard: only on a high or blocked page, only for passwords/cards ===
  function formHasSensitiveFields(form) {
    if (!form || !form.querySelectorAll) return false;
    if (form.querySelector('input[type="password"]')) return true;
    return !!form.querySelector('input[autocomplete*="cc"], input[name*="card"], input[name*="credit"], input[id*="card"], input[id*="credit"]');
  }

  document.addEventListener('submit', function (event) {
    if (state.tier !== 'block' && state.tier !== 'warn') return;
    if (state.overridden || state.allowed) return;
    var form = event.target;
    if (!formHasSensitiveFields(form)) return;
    var proceed = window.confirm('Vardin: this site shows strong scam indicators. Send this form with your password or card details anyway?');
    if (!proceed) {
      event.preventDefault();
      event.stopPropagation();
    } else {
      state.overridden = true;
    }
  }, true);

  // === Phone numbers on the page (collected on request, not on load) ===
  function collectPhones() {
    var found = [];
    var seen = {};
    function push(raw) {
      var value = String(raw || '').trim();
      var digits = value.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) return;
      if (seen[digits]) return;
      seen[digits] = true;
      found.push({ display: value.slice(0, 32), digits: digits });
    }
    try {
      var links = document.querySelectorAll('a[href^="tel:"]');
      for (var i = 0; i < links.length && found.length < 5; i++) {
        push(String(links[i].getAttribute('href') || '').replace(/^tel:/i, ''));
      }
      if (found.length < 5 && document.body && document.body.innerText) {
        var text = document.body.innerText.slice(0, 20000);
        var re = /(\+\d{1,3}[\s.\-]?)?(\(\d{2,4}\)[\s.\-]?)?\d(?:[\s.\-]?\d){5,14}/g;
        var match;
        while ((match = re.exec(text)) !== null && found.length < 5) {
          push(match[0]);
        }
      }
    } catch (e) {}
    return found;
  }

  // === Clipboard checks (deterministic signals only) ===
  function isCryptoAddress(text) {
    if (!text) return false;
    var t = text.trim();
    if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(t)) return true;
    if (/^bc1[a-z0-9]{20,40}$/i.test(t)) return true;
    if (/^0x[a-fA-F0-9]{40}$/.test(t)) return true;
    return false;
  }

  function pastedUrlWarning(text) {
    if (!text) return '';
    var match = String(text).match(/https?:\/\/[^\s]+/i);
    if (!match) return '';
    var candidate = match[0];
    try {
      var host = new URL(candidate).hostname.toLowerCase();
      if (G.isIpHost(host)) {
        return '\u26A0\uFE0F Vardin: that link points at a raw IP address instead of a real domain. Verify it before opening.';
      }
      var look = G.detectLookalike(candidate);
      if (look) {
        return '\u26A0\uFE0F Vardin: that link looks like it imitates ' + look.brand + '. The real site is ' + look.brand + '.com.';
      }
    } catch (e) {}
    return '';
  }

  function showPasteWarning(text) {
    var existing = document.getElementById('vardin-paste-warning');
    if (existing) existing.remove();
    var el = document.createElement('div');
    el.id = 'vardin-paste-warning';
    el.className = 'vardin-paste-warning';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.remove(); }, 6000);
  }

  document.addEventListener('paste', function (e) {
    var text = '';
    if (e.clipboardData) text = e.clipboardData.getData('text') || '';
    if (!text) return;
    var warning = '';
    if (isCryptoAddress(text)) {
      warning = '\u26A0\uFE0F Vardin: you pasted a crypto wallet address. Verify the source \u2014 crypto payments cannot be reversed.';
    } else {
      warning = pastedUrlWarning(text);
    }
    if (warning) showPasteWarning(warning);
  });

  // === Ask the background for this tab's verdict ===
  function refreshRisk() {
    if (state.allowed) return;
    try {
      chrome.runtime.sendMessage({ type: 'CHECK_PAGE_RISK' }, function (response) {
        if (chrome.runtime.lastError) return;
        if (!response) return;
        if (response.tier && response.tier !== 'none') applyTier(response);
      });
    } catch (e) {}
  }

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (!sender || sender.id !== chrome.runtime.id) {
      sendResponse({ error: 'unauthorized' });
      return false;
    }
    if (message.type === 'VARDIN_GET_PHONES') {
      sendResponse({ phones: collectPhones() });
      return false;
    }
    if (message.type === 'VARDIN_APPLY_TIER') {
      applyTier({ tier: message.tier, score: message.score || 0, summary: message.summary || '' });
      sendResponse({ ok: true });
      return false;
    }
    return false;
  });

  // === Start ===
  function start() {
    var lookalike = G.detectLookalike(window.location.href);
    if (lookalike) showLookalikeBanner(lookalike);

    try {
      chrome.runtime.sendMessage({ type: 'GET_SITES', host: HOST }, function (response) {
        if (!chrome.runtime.lastError && response && response.allowed) {
          state.allowed = true;
          return;
        }
        if (document.body) refreshRisk();
      });
    } catch (e) {
      if (document.body) refreshRisk();
    }
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);

  // The background finishes an auto-scan a few seconds after load.
  setTimeout(refreshRisk, 6000);
  setTimeout(refreshRisk, 12000);
})();
`;