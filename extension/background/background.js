// background/background.js

// background.js — the "brain" of the extension.
// It keeps blocking rules synchronized and tracks how many distractions
// have been blocked.

function buildRules(sites) {
  return sites.map((domain, index) => ({
    id: index + 1,
    priority: 1,
    action: {
      type: "redirect",
      redirect: {
        extensionPath: `/blocked.html?site=${encodeURIComponent(domain)}`
      }
    },
    condition: {
      urlFilter: `||${domain}^`,
      resourceTypes: ["main_frame"]
    }
  }));
}

async function syncRules(sites, isActive) {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();

  const removeRuleIds = existing.map((rule) => rule.id);
  const addRules = isActive ? buildRules(sites) : [];

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules
  });
}

async function initRules() {
  const {
    blockedSites = [],
    isActive = true,
    blockedCount = 0
  } = await chrome.storage.local.get([
    "blockedSites",
    "isActive",
    "blockedCount"
  ]);

  await syncRules(blockedSites, isActive);

  // Make sure the counter exists.
  await chrome.storage.local.set({ blockedCount });
}

chrome.runtime.onInstalled.addListener(initRules);
chrome.runtime.onStartup.addListener(initRules);


// ---------------------------------------------------------
// COUNT BLOCKED DISTRACTIONS
// ---------------------------------------------------------

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // Only count top-level page navigations.
  if (details.frameId !== 0) return;

  const {
    blockedSites = [],
    isActive = true,
    blockedCount = 0
  } = await chrome.storage.local.get([
    "blockedSites",
    "isActive",
    "blockedCount"
  ]);

  if (!isActive) return;

  const url = details.url;

  try {
    const hostname = new URL(url).hostname.toLowerCase();

    const matchedSite = blockedSites.find((domain) => {
      return (
        hostname === domain ||
        hostname.endsWith(`.${domain}`)
      );
    });

    if (!matchedSite) return;

    const newCount = blockedCount + 1;

    await chrome.storage.local.set({
      blockedCount: newCount
    });
  } catch (error) {
    console.error("Could not process blocked navigation:", error);
  }
});


// ---------------------------------------------------------
// LISTEN FOR POPUP UPDATES
// ---------------------------------------------------------

chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {
    if (message?.type === "SITES_UPDATED") {
      syncRules(message.sites, message.isActive)
        .then(() => sendResponse({ ok: true }))
        .catch((error) => {
          console.error("Failed to sync rules:", error);
          sendResponse({ ok: false, error: error.message });
        });

      return true;
    }
  }
);