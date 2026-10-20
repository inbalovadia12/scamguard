// Extension source: background.js (service worker)
// Auth + language sync + auto-scan (from v2), plus the v3 protection layer:
// local verdict cache, per-site trust lists, desktop alerts, right-click
// scanning, keyboard shortcut, scan history and the hand-off that lets
// protection.js block a confirmed dangerous page.

export const BACKGROUND_JS = String.raw`// Vardin Extension - Background Service Worker v3.0
// Handles: auth token storage, language sync, auto-scan, local verdict cache,
// per-site trust lists, desktop alerts, menu/shortcut scans, history.

importScripts('shared.js');

var APP_BASE = 'https://vardin.base44.app';
var G = self.VardinGuard;
var currentLang = 'en';

var CACHE_KEY = 'vardin_cache';
var HISTORY_KEY = 'vardin_history';
var SITES_KEY = 'vardin_sites';
var PENDING_KEY = 'vardin_pending';
var MAX_CACHE = 300;
var MAX_HISTORY = 20;

function isValidSender(sender) {
  return sender.id === chrome.runtime.id;
}

function getLocal(keys) {
  return new Promise(function (resolve) {
    chrome.storage.local.get(keys, function (r) { resolve(r || {}); });
  });
}

function setLocal(obj) {
  return new Promise(function (resolve) {
    chrome.storage.local.set(obj, function () { resolve(); });
  });
}

function urlKey(url) {
  if (!url) return '';
  return String(url).split('#')[0];
}

function hostOf(url) {
  var u = G.parseUrl(url);
  return u ? u.hostname.toLowerCase() : '';
}

// Threats stay cached longer than clean pages: a confirmed dangerous site does
// not become safe in an afternoon, while a clean verdict can go stale.
function cacheTtl(tier) {
  if (tier === 'block') return 7 * 24 * 60 * 60 * 1000;
  if (tier === 'warn') return 3 * 24 * 60 * 60 * 1000;
  return 12 * 60 * 60 * 1000;
}

async function readCached(url) {
  var key = urlKey(url);
  if (!key) return null;
  var store = (await getLocal([CACHE_KEY]))[CACHE_KEY] || {};
  var hit = store[key];
  if (!hit) return null;
  if (Date.now() - (hit.ts || 0) > cacheTtl(hit.tier)) return null;
  return hit;
}

async function writeCached(url, entry) {
  var key = urlKey(url);
  if (!key) return;
  var patch = {};
  var store = (await getLocal([CACHE_KEY]))[CACHE_KEY] || {};
  store[key] = entry;
  var keys = Object.keys(store);
  if (keys.length > MAX_CACHE) {
    keys.sort(function (a, b) { return (store[a].ts || 0) - (store[b].ts || 0); });
    for (var i = 0; i < keys.length - MAX_CACHE; i++) delete store[keys[i]];
  }
  patch[CACHE_KEY] = store;
  await setLocal(patch);
}

async function addHistory(entry) {
  var store = (await getLocal([HISTORY_KEY]))[HISTORY_KEY] || [];
  store.unshift(entry);
  var patch = {};
  patch[HISTORY_KEY] = store.slice(0, MAX_HISTORY);
  await setLocal(patch);
}

async function getSites() {
  var r = await getLocal([SITES_KEY]);
  var s = r[SITES_KEY] || {};
  return { allow: s.allow || [], always: s.always || [] };
}

function hostInList(list, host) {
  if (!host) return false;
  for (var i = 0; i < list.length; i++) {
    var h = String(list[i]).toLowerCase();
    if (host === h) return true;
    if (host.slice(-(h.length + 1)) === '.' + h) return true;
  }
  return false;
}

async function hostAllowed(host) {
  if (!host) return false;
  if (G.isOwnHost(host)) return true;
  var sites = await getSites();
  return hostInList(sites.allow, host) || hostInList(sites.allow, G.rootDomain(host));
}

async function hostAlwaysScan(host) {
  if (!host) return false;
  var sites = await getSites();
  return hostInList(sites.always, host) || hostInList(sites.always, G.rootDomain(host));
}

async function updateSite(host, kind, on) {
  if (!host) return await getSites();
  var sites = await getSites();
  var list = (kind === 'always' ? sites.always : sites.allow).filter(function (h) { return h !== host; });
  if (on) list.push(host);
  if (kind === 'always') sites.always = list; else sites.allow = list;
  var patch = {};
  patch[SITES_KEY] = sites;
  await setLocal(patch);
  return sites;
}

// === Badge ===
function setBadge(tabId, tier, score) {
  if (typeof tabId !== 'number') return;
  try {
    if (tier === 'block' || score >= 71) {
      chrome.action.setBadgeText({ text: '!', tabId: tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444', tabId: tabId });
    } else if (tier === 'warn' || (score >= 36 && score <= 70)) {
      chrome.action.setBadgeText({ text: '?', tabId: tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#f59e0b', tabId: tabId });
    } else {
      chrome.action.setBadgeText({ text: '', tabId: tabId });
    }
  } catch (e) {}
}

function clearBadge(tabId) {
  if (typeof tabId !== 'number') return;
  try { chrome.action.setBadgeText({ text: '', tabId: tabId }); } catch (e) {}
}

// === Desktop alerts (only for pages the user did not open on purpose) ===
var notifiedHosts = {};

function shouldNotify(host) {
  if (!host) return false;
  var last = notifiedHosts[host] || 0;
  if (Date.now() - last < 30 * 60 * 1000) return false;
  notifiedHosts[host] = Date.now();
  return true;
}

function notify(title, message, high) {
  try {
    if (!chrome.notifications) return;
    chrome.notifications.create('vardin-' + Date.now(), {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: title,
      message: String(message || '').slice(0, 220),
      priority: high ? 2 : 1,
      requireInteraction: !!high
    });
  } catch (e) {}
}

function verdictTitle(tier, score) {
  if (tier === 'block') return 'Vardin: dangerous page';
  if (tier === 'warn') return 'Vardin: strong scam indicators';
  if (tier === 'info') return 'Vardin: some risk signals (' + score + '/100)';
  return 'Vardin: no threats found';
}

function entryFrom(url, data) {
  var analysis = (data && data.analysis) || {};
  var tier = G.tierFromResponse(data);
  var summary = analysis.summary || analysis.explanation || analysis.verdict || '';
  return {
    url: url,
    tier: tier,
    score: Number(analysis.risk_score) || 0,
    level: analysis.risk_level || 'low',
    is_scam: analysis.is_scam === true,
    // A page that could not be loaded was never verified, so the popup shows it
    // as "could not check" instead of green.
    inconclusive: analysis.inconclusive === true,
    summary: String(summary).slice(0, 300),
    ts: Date.now()
  };
}

async function storeRisk(tabId, entry) {
  if (typeof tabId !== 'number' || !entry) return;
  var patch = {};
  patch['risk_' + tabId] = { tier: entry.tier, score: entry.score, level: entry.level, url: entry.url, summary: entry.summary };
  await setLocal(patch);
}

async function recordScan(url, data, tabId, opts) {
  opts = opts || {};
  var entry = entryFrom(url, data);
  await writeCached(url, entry);
  await storeRisk(tabId, entry);
  setBadge(tabId, entry.tier, entry.score);
  // Auto-scan only logs the pages worth remembering, so history stays readable.
  if (opts.source !== 'auto' || entry.tier !== 'none') await addHistory(entry);
  var host = hostOf(url);
  if (opts.notify && (entry.tier === 'block' || entry.tier === 'warn') && shouldNotify(host)) {
    notify(verdictTitle(entry.tier, entry.score), (entry.score ? entry.score + '/100 - ' : '') + (entry.summary || url), entry.tier === 'block');
  }
  return entry;
}

async function storePending(url, data, entry) {
  var patch = {};
  patch[PENDING_KEY] = { url: url, entry: entry, data: data, ts: Date.now() };
  await setLocal(patch);
}

async function scanWebpage(url, body, tabId, opts) {
  var auth = await getLocal(['authToken', 'appId']);
  if (!auth.authToken || !auth.appId) return { error: 'not_authenticated' };

  var response = await fetch(APP_BASE + '/api/apps/' + auth.appId + '/functions/scanWebpage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + auth.authToken,
      'X-App-Id': auth.appId
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    if (response.status === 401) return { error: 'not_authenticated' };
    if (response.status === 403) return { error: 'upgrade_required' };
    if (response.status === 402) return { error: 'no_credits' };
    return { error: 'scan_failed' };
  }

  var data = await response.json();
  var entry = await recordScan(url, data, tabId, opts);
  return { entry: entry, data: data };
}

// === Auto-scan on navigation ===
var scanTimeouts = {};

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (changeInfo.status !== 'complete') return;
  if (!tab || !tab.url) return;
  if (G.isInternalUrl(tab.url)) return;

  chrome.storage.local.get(['autoScan', 'authToken', 'appId', 'lang'], function (result) {
    if (!result.authToken || !result.appId) return;
    if (result.lang) currentLang = result.lang;
    clearBadge(tabId);

    autoScanUrl(tabId, tab.url, !!result.autoScan);

    if (scanTimeouts[tabId]) clearTimeout(scanTimeouts[tabId]);
    scanTimeouts[tabId] = setTimeout(function () {
      autoScanUrl(tabId, tab.url, !!result.autoScan);
    }, 4000);
  });
});

async function autoScanUrl(tabId, url, autoScanOn) {
  try {
    var host = hostOf(url);
    if (!url || G.isInternalUrl(url) || G.isOwnHost(host)) return;
    if (await hostAllowed(host)) return;

    var always = await hostAlwaysScan(host);
    if (!autoScanOn && !always) return;

    // A cached verdict is instant, costs nothing, and keeps the badge honest.
    var cached = await readCached(url);
    if (cached) {
      setBadge(tabId, cached.tier, cached.score);
      await storeRisk(tabId, cached);
      return;
    }

    await scanWebpage(url, {
      page_text: '',
      screenshot_data_url: '',
      page_url: url,
      options: { scan_type: 'url', answer_type: 'risk_score', language: currentLang }
    }, tabId, { source: 'auto', notify: true });
  } catch (_e) {
    // Silent fail for auto-scan
  }
}

// === Right-click scanning ===
function buildMenus() {
  try {
    chrome.contextMenus.removeAll(function () {
      chrome.contextMenus.create({ id: 'vardin-scan-page', title: 'Scan this page with Vardin', contexts: ['page'] });
      chrome.contextMenus.create({ id: 'vardin-scan-link', title: 'Scan this link with Vardin', contexts: ['link'] });
      chrome.contextMenus.create({ id: 'vardin-scan-selection', title: 'Scan this text with Vardin', contexts: ['selection'] });
      chrome.contextMenus.create({ id: 'vardin-scan-image', title: 'Scan this image with Vardin', contexts: ['image'] });
      chrome.contextMenus.create({ id: 'vardin-check-phone', title: 'Check this number with Vardin', contexts: ['selection'] });
    });
  } catch (e) {}
}

function openPhoneGuard(value) {
  try {
    chrome.tabs.create({ url: APP_BASE + '/phone-guard?number=' + encodeURIComponent(value) });
  } catch (e) {}
}

function tryOpenPopup() {
  try {
    if (chrome.action && chrome.action.openPopup) {
      var p = chrome.action.openPopup();
      if (p && p.catch) p.catch(function () {});
    }
  } catch (e) {}
}

async function requireAuth() {
  var auth = await getLocal(['authToken', 'appId']);
  if (!auth.authToken || !auth.appId) {
    notify('Vardin', 'Open the Vardin extension and log in to scan with one click.', false);
    return null;
  }
  return auth;
}

async function menuScanPage(tabId, url) {
  if (!(await requireAuth())) return;
  if (!url || G.isInternalUrl(url) || G.isOwnHost(hostOf(url))) return;
  var result = await scanWebpage(url, {
    page_text: '', screenshot_data_url: '', page_url: url,
    options: { scan_type: 'url', answer_type: 'risk_score', language: currentLang }
  }, tabId, { source: 'menu', notify: true });
  if (result.error) { notify('Vardin', 'Could not scan this page.', false); return; }
  await storePending(url, result.data, result.entry);
  if (result.entry.tier === 'block' || result.entry.tier === 'warn') tryOpenPopup();
}

async function menuScanText(tabId, text, kind) {
  if (!(await requireAuth())) return;
  if (!text || !text.trim()) return;
  var body = kind === 'url'
    ? { page_text: '', screenshot_data_url: '', page_url: text.trim(), options: { scan_type: 'url', answer_type: 'risk_score', language: currentLang } }
    : { page_text: text.slice(0, 8000), screenshot_data_url: '', page_url: '', options: { scan_type: 'chat', answer_type: 'risk_score', language: currentLang } };
  var result = await scanWebpage(kind === 'url' ? text.trim() : 'Selected text', body, tabId, { source: 'menu', notify: true });
  if (result.error) { notify('Vardin', 'Could not scan this selection.', false); return; }
  await storePending(kind === 'url' ? text.trim() : 'Selected text', result.data, result.entry);
  tryOpenPopup();
}

async function menuScanImage(tabId, srcUrl, pageUrl) {
  if (!(await requireAuth())) return;
  if (!srcUrl) return;
  try {
    var response = await fetch(srcUrl);
    if (!response.ok) { notify('Vardin', 'Could not load that image.', false); return; }
    var blob = await response.blob();
    if (!blob || blob.size > 4 * 1024 * 1024) { notify('Vardin', 'That image is too large to scan.', false); return; }
    var dataUrl = await new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    var result = await scanWebpage(pageUrl || srcUrl, {
      page_text: '', screenshot_data_url: dataUrl, page_url: pageUrl || srcUrl,
      options: { scan_type: 'screenshot', answer_type: 'risk_score', language: currentLang }
    }, tabId, { source: 'menu', notify: true });
    if (result.error) { notify('Vardin', 'Could not scan that image.', false); return; }
    await storePending(srcUrl, result.data, result.entry);
    tryOpenPopup();
  } catch (_e) {
    notify('Vardin', 'Could not scan that image.', false);
  }
}

chrome.contextMenus.onClicked.addListener(function (info, tab) {
  var id = String((info && info.menuItemId) || '');
  if (id.indexOf('vardin-') !== 0) return;
  var tabId = tab ? tab.id : undefined;
  var pageUrl = (tab && tab.url) || '';

  if (id === 'vardin-scan-page') { menuScanPage(tabId, pageUrl); return; }
  if (id === 'vardin-scan-link') { menuScanText(tabId, (info && info.linkUrl) || '', 'url'); return; }
  if (id === 'vardin-scan-selection') { menuScanText(tabId, (info && info.selectionText) || '', 'text'); return; }
  if (id === 'vardin-scan-image') { menuScanImage(tabId, (info && info.srcUrl) || '', pageUrl); return; }
  if (id === 'vardin-check-phone') {
    var selection = String((info && info.selectionText) || '');
    var digits = selection.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
      notify('Vardin', 'Select a phone number (7-15 digits) to check it.', false);
      return;
    }
    openPhoneGuard(digits);
  }
});

// === Keyboard shortcut: scan the current page ===
chrome.commands.onCommand.addListener(function (command) {
  if (command !== 'scan-current-page') return;
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs && tabs[0];
    if (!tab) return;
    menuScanPage(tab.id, tab.url || '');
  });
});

chrome.notifications.onClicked.addListener(function () { tryOpenPopup(); });

// === Messages ===
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!isValidSender(sender)) {
    sendResponse({ error: 'Unauthorized sender' });
    return false;
  }

  if (message.type === 'AUTH_TOKEN') {
    chrome.storage.local.set({
      authToken: message.token || null,
      appId: message.appId || null,
      authTimestamp: Date.now()
    }, function () { sendResponse({ success: true }); });
    return true;
  }

  if (message.type === 'AUTH_LOGOUT') {
    chrome.storage.local.remove(['authToken', 'appId', 'authTimestamp'], function () { sendResponse({ success: true }); });
    return true;
  }

  if (message.type === 'LANGUAGE_SYNC') {
    chrome.storage.local.set({ lang: message.lang });
    currentLang = message.lang;
    sendResponse({ success: true });
    return false;
  }

  if (message.type === 'GET_AUTH') {
    chrome.storage.local.get(['authToken', 'appId'], function (result) { sendResponse(result); });
    return true;
  }

  // Content script asks for the verdict that belongs to its tab.
  if (message.type === 'CHECK_PAGE_RISK') {
    var key = 'risk_' + (sender.tab ? sender.tab.id : 0);
    chrome.storage.local.get([key], function (result) {
      sendResponse(result[key] || { tier: 'none', score: 0 });
    });
    return true;
  }

  if (message.type === 'GET_CACHE') {
    readCached(message.url).then(function (hit) { sendResponse({ entry: hit }); });
    return true;
  }

  if (message.type === 'GET_HISTORY') {
    getLocal([HISTORY_KEY]).then(function (r) { sendResponse({ history: r[HISTORY_KEY] || [] }); });
    return true;
  }

  if (message.type === 'CLEAR_HISTORY') {
    setLocal({ vardin_history: [] }).then(function () { sendResponse({ history: [] }); });
    return true;
  }

  if (message.type === 'GET_SITES') {
    var host = message.host || '';
    Promise.all([getSites(), hostAllowed(host), hostAlwaysScan(host)]).then(function (r) {
      sendResponse({ sites: r[0], allowed: r[1], always: r[2] });
    });
    return true;
  }

  if (message.type === 'SET_SITE') {
    updateSite(message.host || '', message.kind === 'always' ? 'always' : 'allow', message.on === true).then(function (sites) {
      sendResponse({ sites: sites });
    });
    return true;
  }

  // The popup ran a scan itself; the background owns the cache/badge/history.
  if (message.type === 'RECORD_SCAN') {
    recordScan(message.url, message.data, message.tabId, { source: 'popup', notify: false }).then(function (entry) {
      sendResponse({ entry: entry });
    });
    return true;
  }

  if (message.type === 'GET_PENDING') {
    getLocal([PENDING_KEY]).then(function (r) { sendResponse({ pending: r[PENDING_KEY] || null }); });
    return true;
  }

  if (message.type === 'CLEAR_PENDING') {
    chrome.storage.local.remove([PENDING_KEY], function () { sendResponse({ success: true }); });
    return true;
  }

  // protection.js replaced the page: remember it and alert once per host.
  if (message.type === 'VARDIN_BLOCKED') {
    var blockedHost = message.host || '';
    var blockedEntry = { url: message.url || '', tier: 'block', score: message.score || 0, level: 'high', summary: message.summary || '', ts: Date.now() };
    addHistory(blockedEntry);
    if (shouldNotify(blockedHost)) {
      notify('Vardin: page blocked', message.summary || 'This page matched strong scam or malware evidence.', true);
    }
    sendResponse({ success: true });
    return false;
  }

  return false;
});

// Clean up per-tab risk data
chrome.tabs.onRemoved.addListener(function (tabId) {
  chrome.storage.local.remove('risk_' + tabId);
  if (scanTimeouts[tabId]) { clearTimeout(scanTimeouts[tabId]); delete scanTimeouts[tabId]; }
});

chrome.runtime.onInstalled.addListener(function () {
  buildMenus();
  console.log('Vardin Scam Scanner v3.0 installed.');
});

chrome.runtime.onStartup.addListener(buildMenus);
`;