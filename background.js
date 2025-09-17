// background.js - Manifest V3 service worker
import { msToHuman } from './utils.js';
// Key names
const STORAGE_KEY = 'activityData'; // structure: { "YYYY-MM-DD": { "example.com": ms, ... }, ... }

// State variables
let current = {
  tabId: null,
  windowId: null,
  url: null,
  domain: null,
  startTs: null,
  isIdle: false
};

const IDLE_THRESHOLD_SECONDS = 300; // treat idle after 5 min

// Helpers
function now() { return Date.now(); }

function getDomainFromUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch (e) {
    return null;
  }
}

async function saveDuration(domain, ms, timestamp = Date.now()) {
  if (!domain || ms <= 0) return;
    console.log(`Saving time: ${msToHuman(ms)} on ${domain}`);

  const dateKey = new Date(timestamp).toISOString().slice(0,10); // YYYY-MM-DD
  const storage = await chrome.storage.local.get([STORAGE_KEY]);
  const data = storage[STORAGE_KEY] || {};
  data[dateKey] = data[dateKey] || {};
  data[dateKey][domain] = (data[dateKey][domain] || 0) + ms;
  await chrome.storage.local.set({ [STORAGE_KEY]: data });
}

// Start tracking for a domain
function startTracking(domain, tabId, windowId) {
  if (!domain) return;
  // If already tracking same domain, do nothing
  if (current.domain === domain && current.isIdle === false) {
    current.tabId = tabId;
    current.windowId = windowId;
    return;
  }

  // Stop previous
  stopCurrent();

  current.domain = domain;
  current.tabId = tabId;
  current.windowId = windowId;
  current.startTs = now();
  current.isIdle = false;
}

// Stop current tracking and persist elapsed time
function stopCurrent() {
  if (!current.startTs || !current.domain) {
    // reset minimal fields
    current.startTs = null;
    return;
  }
  const elapsed = now() - current.startTs;
  if (elapsed > 0) {
    saveDuration(current.domain, elapsed, current.startTs).catch(console.error);
  }
  current.startTs = null;
  current.tabId = null;
  current.windowId = null;
  current.domain = null;
}

// Called when active tab changes or window changes focus
async function updateActiveTabFromEvent() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      // no active tab (e.g. devtools or no windows)
      stopCurrent();
      return;
    }

    const domain = getDomainFromUrl(tab.url);
    const tabId = tab.id;
    const winId = tab.windowId;

    // If system idle, don't start new tracking
    const idleState = await chrome.idle.queryState(IDLE_THRESHOLD_SECONDS);
    if (idleState !== 'active') {
      // mark idle
      if (!current.isIdle) {
        // save current and mark idle
        stopCurrent();
        current.isIdle = true;
      }
      return;
    }

    // Start tracking this domain
    startTracking(domain, tabId, winId);
  } catch (e) {
    console.error('updateActiveTabFromEvent error', e);
  }
}

// Listen to tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  // activeInfo: {tabId, windowId}
  updateActiveTabFromEvent();
});

// Listen to tab updates (navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // If active tab's URL changed (navigation), update domain
  if (changeInfo.url) {
    updateActiveTabFromEvent();
  }
});

// Listen to window focus change
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // all windows lost focus
    stopCurrent();
    return;
  }
  updateActiveTabFromEvent();
});

// Idle state changes
chrome.idle.onStateChanged.addListener((newState) => {
  if (newState === 'active') {
    // user returned -> resume
    current.isIdle = false;
    updateActiveTabFromEvent();
  } else {
    // idle or locked
    if (!current.isIdle) {
      stopCurrent();
      current.isIdle = true;
    }
  }
});

// On extension installed or service worker started, initialize
chrome.runtime.onStartup.addListener(() => {
  // nothing needed: just attempt to sync state
  updateActiveTabFromEvent();
});
chrome.runtime.onInstalled.addListener(() => {
  updateActiveTabFromEvent();
});

// Before unload (service worker may be killed), persist current
// Note: service workers don't support unload reliably. We persist on events above.
// But to be safer, use alarms to periodically persist (every 30s)
chrome.alarms.create('heartbeat', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(() => {
  // if tracking, write elapsed and reset start ts to now
  if (current.startTs && current.domain && !current.isIdle) {
    const elapsed = now() - current.startTs;
    // accumulate and reset startTs to now
    saveDuration(current.domain, elapsed, current.startTs).catch(console.error);
    current.startTs = now();
  }
});


chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
});