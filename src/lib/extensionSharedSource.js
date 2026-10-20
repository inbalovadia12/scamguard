// Extension source: shared.js
// Loaded by background.js (importScripts), protection.js (manifest content
// script order) and popup.html, so all three surfaces judge a page by exactly
// the same rules.
//
// WHY THIS FILE EXISTS: false positives. A security tool that cries wolf gets
// uninstalled. So:
//   * a page is BLOCKED only on hard threat-intelligence evidence, or on a
//     top-tier AI verdict that is explicit (is_scam) and self-confident;
//   * a merely medium score NEVER blocks and NEVER warns in the page;
//   * an inconclusive / timed-out analysis NEVER blocks;
//   * a domain is called a lookalike only when it is a one-character edit of a
//     distinctive brand, or a brand used as a token with a separator, on a host
//     that is not the brand's own domain.

export const SHARED_JS = String.raw`// Vardin - shared risk gate (background + content script + popup)
(function () {
  'use strict';

  var OWN_HOSTS = ['vardin.base44.app', 'vardin.com', 'app.vardin.com', 'www.vardin.com'];

  // Distinctive brand tokens, 5+ characters. Deliberately EXCLUDES brands that
  // are also ordinary English words (bank, target, office, chase, wise, prime,
  // steam, booking) because a one-character difference on a dictionary word
  // produces false lookalike hits on legitimate sites.
  var BRANDS = [
    'paypal', 'coinbase', 'metamask', 'binance', 'cashapp', 'venmo', 'zelle',
    'revolut', 'stripe', 'shopify', 'amazon', 'google', 'microsoft', 'apple',
    'netflix', 'facebook', 'instagram', 'whatsapp', 'telegram', 'linkedin',
    'dropbox', 'icloud', 'outlook', 'gmail', 'yahoo', 'spotify', 'snapchat',
    'tiktok', 'discord', 'twitch', 'airbnb', 'aliexpress', 'alibaba',
    'docusign', 'adobe', 'zoom', 'walmart', 'costco', 'tesco', 'fedex',
    'santander', 'hapoalim', 'robinhood', 'fidelity', 'vanguard', 'schwab',
    'wellsfargo', 'bankofamerica', 'citibank', 'barclays'
  ];

  // Brands whose name next to another word ("paypal-secure", "coinbase-help")
  // is almost always an imitation, and where the harm is money leaving an
  // account. Kept deliberately narrow.
  var SEPARATOR_BRANDS = [
    'paypal', 'coinbase', 'metamask', 'binance', 'cashapp', 'venmo', 'zelle',
    'wellsfargo', 'bankofamerica', 'citibank', 'santander', 'hapoalim',
    'amazon', 'apple', 'netflix', 'google', 'microsoft', 'whatsapp',
    'instagram', 'facebook', 'tiktok', 'docusign', 'icloud', 'outlook', 'gmail'
  ];

  // The real address for each brand, so a warning can tell the user where to go
  // instead ("the real address is paypal.com"). Kept in sync with
  // base44/shared/brandLookalikes.ts.
  var BRAND_OFFICIAL = {
    paypal: 'paypal.com', coinbase: 'coinbase.com', metamask: 'metamask.io',
    binance: 'binance.com', cashapp: 'cash.app', venmo: 'venmo.com',
    zelle: 'zellepay.com', revolut: 'revolut.com', stripe: 'stripe.com',
    shopify: 'shopify.com', amazon: 'amazon.com', google: 'google.com',
    microsoft: 'microsoft.com', apple: 'apple.com', netflix: 'netflix.com',
    facebook: 'facebook.com', instagram: 'instagram.com', whatsapp: 'whatsapp.com',
    telegram: 'telegram.org', linkedin: 'linkedin.com', dropbox: 'dropbox.com',
    icloud: 'icloud.com', outlook: 'outlook.com', gmail: 'gmail.com',
    yahoo: 'yahoo.com', spotify: 'spotify.com', snapchat: 'snapchat.com',
    tiktok: 'tiktok.com', discord: 'discord.com', twitch: 'twitch.tv',
    airbnb: 'airbnb.com', aliexpress: 'aliexpress.com', alibaba: 'alibaba.com',
    docusign: 'docusign.com', adobe: 'adobe.com', zoom: 'zoom.us',
    walmart: 'walmart.com', costco: 'costco.com', tesco: 'tesco.com',
    fedex: 'fedex.com', santander: 'santander.com', hapoalim: 'bankhapoalim.co.il',
    robinhood: 'robinhood.com', fidelity: 'fidelity.com', vanguard: 'vanguard.com',
    schwab: 'schwab.com', wellsfargo: 'wellsfargo.com',
    bankofamerica: 'bankofamerica.com', citibank: 'citibank.com',
    barclays: 'barclays.co.uk'
  };

  function officialFor(brand) {
    return BRAND_OFFICIAL[brand] || brand + '.com';
  }

  // A brand joined to one of these words (paypalverify, amazonsupport) is an
  // imitation. A brand inside an ordinary word (applebees) is not.
  var AFFIX_WORDS = ['secure', 'security', 'login', 'signin', 'verify', 'verification',
    'account', 'support', 'service', 'update', 'alert', 'billing', 'payment', 'help',
    'auth', 'confirm', 'official', 'center', 'centre', 'team', 'online', 'safe', 'protection'];

  var TWO_LEVEL_TLDS = [
    'co.uk', 'org.uk', 'gov.uk', 'ac.uk', 'co.il', 'org.il', 'ac.il', 'com.au',
    'net.au', 'org.au', 'co.nz', 'co.za', 'com.br', 'com.mx', 'com.ar',
    'co.jp', 'com.sg', 'com.hk', 'co.in', 'com.tw', 'co.kr', 'com.cn',
    'com.tr', 'com.ua', 'co.ke', 'com.ng', 'com.ph', 'com.my', 'com.vn'
  ];

  function isOwnHost(host) {
    if (!host) return false;
    host = String(host).toLowerCase();
    for (var i = 0; i < OWN_HOSTS.length; i++) {
      if (host === OWN_HOSTS[i] || host.slice(-(OWN_HOSTS[i].length + 1)) === '.' + OWN_HOSTS[i]) return true;
    }
    return false;
  }

  function parseUrl(url) {
    if (!url || typeof url !== 'string') return null;
    var withProto = url.indexOf('http') === 0 ? url : 'https://' + url;
    try {
      var u = new URL(withProto);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      return u;
    } catch (e) {
      return null;
    }
  }

  function isInternalUrl(url) {
    if (!url || typeof url !== 'string') return true;
    var lower = url.toLowerCase();
    if (lower.indexOf('chrome://') === 0) return true;
    if (lower.indexOf('chrome-extension://') === 0) return true;
    if (lower.indexOf('edge://') === 0) return true;
    if (lower.indexOf('about:') === 0) return true;
    if (lower.indexOf('view-source:') === 0) return true;
    if (lower.indexOf('file://') === 0) return true;
    if (lower.indexOf('data:') === 0) return true;
    return false;
  }

  function isIpHost(host) {
    return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host || '');
  }

  function rootDomain(host) {
    if (!host) return '';
    host = String(host).toLowerCase().replace(/\.$/, '');
    var parts = host.split('.');
    if (parts.length <= 2) return host;
    var lastTwo = parts.slice(-2).join('.');
    if (TWO_LEVEL_TLDS.indexOf(lastTwo) !== -1 && parts.length >= 3) {
      return parts.slice(-3).join('.');
    }
    return lastTwo;
  }

  function mainLabel(root) {
    if (!root) return '';
    var parts = root.split('.');
    return parts.length > 1 ? parts[0] : root;
  }

  // Digit/letter lookalikes plus the classic two-letter swaps.
  function normalizeLabel(label) {
    return String(label)
      .replace(/0/g, 'o')
      .replace(/1/g, 'l')
      .replace(/3/g, 'e')
      .replace(/5/g, 's')
      .replace(/7/g, 't')
      .replace(/rn/g, 'm')
      .replace(/vv/g, 'w')
      .replace(/cl/g, 'd');
  }

  function editDistance(a, b) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > 1) return 99;
    var prev = [];
    for (var j = 0; j <= b.length; j++) prev[j] = j;
    for (var i = 1; i <= a.length; i++) {
      var cur = [i];
      for (var k = 1; k <= b.length; k++) {
        var cost = a.charAt(i - 1) === b.charAt(k - 1) ? 0 : 1;
        cur[k] = Math.min(prev[k] + 1, cur[k - 1] + 1, prev[k - 1] + cost);
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function hasBrandToken(label) {
    var tokens = label.split(/[^a-z0-9]+/).filter(function (tk) { return tk.length > 0; });
    if (tokens.length < 2) return null;
    for (var i = 0; i < tokens.length; i++) {
      if (SEPARATOR_BRANDS.indexOf(tokens[i]) !== -1) return tokens[i];
    }
    return null;
  }

  /**
   * Returns { brand: 'paypal', reason: 'imitation' } when the host imitates a
   * brand, otherwise null. Deterministic and offline - no scan, no credits.
   */
  function detectLookalike(url) {
    var u = parseUrl(url);
    if (!u) return null;
    var host = u.hostname.toLowerCase();
    if (!host || isIpHost(host) || host === 'localhost' || isOwnHost(host)) return null;
    if (host.indexOf('.') === -1) return null;

    var root = rootDomain(host);
    var label = mainLabel(root).toLowerCase();
    if (label.length < 5) return null;

    // The brand's own domain is never an imitation.
    if (BRANDS.indexOf(label) !== -1) return null;

    // A brand's real address buried inside a longer host:
    // paypal.com.login-user.xyz
    for (var n = 0; n < BRANDS.length; n++) {
      var official = officialFor(BRANDS[n]);
      if (host.indexOf(official + '.') !== -1) {
        return { brand: BRANDS[n], official: official, reason: 'imitation' };
      }
    }

    var normalized = normalizeLabel(label);
    if (normalized !== label && BRANDS.indexOf(normalized) !== -1) {
      return { brand: normalized, official: officialFor(normalized), reason: 'lookalike' };
    }

    for (var i = 0; i < BRANDS.length; i++) {
      var brand = BRANDS[i];
      if (brand.length < 5) continue;

      // A brand next to a security-sounding word: paypalverify, secure-paypal.
      // "applebees" is left alone because "bees" is not one of those words.
      if (label.indexOf(brand) === 0) {
        if (AFFIX_WORDS.indexOf(label.slice(brand.length)) !== -1) {
          return { brand: brand, official: officialFor(brand), reason: 'imitation' };
        }
      } else {
        var trailing = label.length - brand.length;
        if (trailing > 0 && label.slice(trailing) === brand && AFFIX_WORDS.indexOf(label.slice(0, trailing)) !== -1) {
          return { brand: brand, official: officialFor(brand), reason: 'imitation' };
        }
      }

      if (brand.charAt(0) !== label.charAt(0)) continue;
      if (editDistance(label, brand) === 1) {
        return { brand: brand, official: officialFor(brand), reason: 'lookalike' };
      }
    }

    var tokenBrand = hasBrandToken(label);
    if (tokenBrand) return { brand: tokenBrand, official: officialFor(tokenBrand), reason: 'imitation' };

    return null;
  }

  /**
   * The single verdict gate. 'block' replaces the page, 'warn' shows a page
   * banner and arms the submit guard, 'info' is display-only (badge/popup).
   * Medium and inconclusive results land in 'info' or 'none' by design.
   */
  function threatTier(analysis, meta) {
    var a = analysis || {};
    meta = meta || {};
    var score = Number(a.risk_score);
    if (!isFinite(score)) score = 0;
    var confidence = Number(a.confidence);
    if (!isFinite(confidence)) confidence = 0;
    var level = typeof a.risk_level === 'string' ? a.risk_level.toLowerCase() : '';

    // 1. Hard threat-intelligence evidence - the only source of a block that
    //    does not depend on the AI at all.
    if (meta.urlhausListed === true) return 'block';
    if (Number(meta.vtMalicious) >= 5) return 'block';

    // 2. AI-only verdict: must be top-tier, explicit and self-confident. An
    //    inconclusive fallback ("could not complete in time") never qualifies.
    if (level === 'high' && score >= 90 && a.is_scam === true && confidence >= 80) return 'block';

    // 3. High but not certain - banner and submit guard, never a page takeover.
    if (level === 'high' && score >= 71) return 'warn';

    if (score >= 36 && score <= 70) return 'info';
    if (score >= 71) return 'warn';
    return 'none';
  }

  function isOverlayWorthy(tier) {
    return tier === 'block';
  }

  function isBlockingTier(tier) {
    return tier === 'block';
  }

  function tierFromResponse(data) {
    var analysis = (data && data.analysis) || {};
    var meta = {
      urlhausListed: !!(data && data.urlhaus && data.urlhaus.listed),
      vtMalicious: (data && data.virustotal && Number(data.virustotal.malicious)) || 0
    };
    return threatTier(analysis, meta);
  }

  self.VardinGuard = {
    OWN_HOSTS: OWN_HOSTS,
    isOwnHost: isOwnHost,
    parseUrl: parseUrl,
    isInternalUrl: isInternalUrl,
    isIpHost: isIpHost,
    rootDomain: rootDomain,
    mainLabel: mainLabel,
    detectLookalike: detectLookalike,
    threatTier: threatTier,
    tierFromResponse: tierFromResponse,
    isOverlayWorthy: isOverlayWorthy,
    isBlockingTier: isBlockingTier
  };
})();
`;