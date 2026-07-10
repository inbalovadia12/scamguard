// Vardin Extension - Background Service Worker (Manifest V3)
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
