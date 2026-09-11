// background/background.js

// background.js — the "brain" of the extension.
// It keeps blocking rules synchronized and tracks how many distractions
// have been blocked.

// const API_BASE_URL = "http://127.0.0.1:8000";
const API_BASE_URL = "https://deepfocus-backend-ep5kwh77c-vampyr1.vercel.app/";

chrome.alarms.create("deepfocus-sync", {
  periodInMinutes: 1,
});

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

async function syncAccountState() {
  const {
    authMode,
    accessToken,
    isActive = true,
  } = await chrome.storage.local.get([
    "authMode",
    "accessToken",
    "isActive",
  ]);

  if (authMode !== "account" || !accessToken) {
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/sync`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (response.status === 401) {
      await chrome.storage.local.set({
        authMode: "guest",
      });

      await chrome.storage.local.remove([
        "accessToken",
        "user",
      ]);

      return;
    }

    if (!response.ok) {
      return;
    }

    const data = await response.json();

    const sites = data.blocked_sites.map(
      (site) => site.domain
    );

    const newIsActive = data.blocking_enabled;

    await chrome.storage.local.set({
      blockedSites: sites,
      isActive: newIsActive,
    });

    await syncRules(
      sites,
      newIsActive
    );
  } catch (error) {
    console.error(
      "Background sync failed:",
      error
    );
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "deepfocus-sync") {
    syncAccountState();
  }
});

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

chrome.runtime.onStartup.addListener(async () => {
  await initRules();
  await syncAccountState();
});
chrome.runtime.onInstalled.addListener(async () => {
  await initRules();
  await syncAccountState();
});


// ---------------------------------------------------------
// COUNT BLOCKED DISTRACTIONS
// ---------------------------------------------------------

chrome.webNavigation.onBeforeNavigate.addListener(
  async (details) => {
    if (details.frameId !== 0) {
      return;
    }

    const {
      blockedSites = [],
      isActive = true,
      blockedCount = 0,
      authMode = "guest",
      accessToken = null,
      deviceId = null,
    } = await chrome.storage.local.get([
      "blockedSites",
      "isActive",
      "blockedCount",
      "authMode",
      "accessToken",
      "deviceId",
    ]);

    if (!isActive) {
      return;
    }

    try {
      const hostname =
        new URL(details.url).hostname.toLowerCase();

      const matchedSite = blockedSites.find(
        (domain) =>
          hostname === domain ||
          hostname.endsWith(`.${domain}`)
      );

      if (!matchedSite) {
        return;
      }

      // -------------------------
      // LOCAL COUNTER
      // -------------------------

      const newCount = blockedCount + 1;

      await chrome.storage.local.set({
        blockedCount: newCount,
      });


      // -------------------------
      // CLOUD ANALYTICS
      // -------------------------

      if (
        authMode === "account" &&
        accessToken
      ) {
        try {
          await fetch(
            `${API_BASE_URL}/api/block-events`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization:
                  `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                domain: matchedSite,
                device_id: deviceId || null,
              }),
            }
          );
        } catch (error) {
          console.error(
            "Failed to record block event:",
            error
          );
        }
      }

    } catch (error) {
      console.error(
        "Could not process navigation:",
        error
      );
    }
  }
);


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