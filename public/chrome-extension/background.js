// Vardin background service worker

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get('kid_mode', (data) => {
    if (data.kid_mode === undefined) {
      chrome.storage.sync.set({ kid_mode: false });
    }
  });
});
