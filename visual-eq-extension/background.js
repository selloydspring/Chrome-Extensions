// Visual Audio EQ - Background Service Worker
// Handles extension lifecycle and communication

// Track active tabs with EQ enabled
const activeTabsWithEQ = new Set();

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.local.set({
      eqSettings: { 60: 0, 230: 0, 910: 0, 3600: 0, 14000: 0 },
      masterVolume: 100,
      currentPreset: 'flat'
    });
    
    console.log('Visual Audio EQ: Extension installed');
  } else if (details.reason === 'update') {
    console.log('Visual Audio EQ: Extension updated');
  }
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TAB_EQ_ENABLED') {
    activeTabsWithEQ.add(sender.tab.id);
    updateBadge(sender.tab.id, true);
  } else if (message.type === 'TAB_EQ_DISABLED') {
    activeTabsWithEQ.delete(sender.tab.id);
    updateBadge(sender.tab.id, false);
  }
  
  return true;
});

// Update extension badge to show EQ status
function updateBadge(tabId, isActive) {
  if (isActive) {
    chrome.action.setBadgeText({ text: 'ON', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#00ff88', tabId });
  } else {
    chrome.action.setBadgeText({ text: '', tabId });
  }
}

// Clear EQ state when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  activeTabsWithEQ.delete(tabId);
});

// Clear EQ state when tab navigates to new page
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    activeTabsWithEQ.delete(tabId);
    updateBadge(tabId, false);
  }
});

// Handle keyboard shortcuts (if defined in manifest)
chrome.commands?.onCommand?.addListener((command) => {
  if (command === 'toggle-eq') {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_EQ' });
      }
    });
  }
});

console.log('Visual Audio EQ: Background service worker started');
