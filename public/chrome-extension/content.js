// Vardin Extension - Content Script
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
