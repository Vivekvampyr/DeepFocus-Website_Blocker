// background/background.js

// background.js — the "brain" of the extension.
// It keeps blocking rules synchronized and tracks how many distractions
// have been blocked.

const API_BASE_URL = "http://127.0.0.1:8000";
// const API_BASE_URL = "https://deepfocus-backend.vercel.app";

chrome.alarms.create("deepfocus-sync", {
  periodInMinutes: 1,
});

function buildRules(sites) {
  const cleanSites = Array.from(
    new Set(
      sites
        .map((d) => (typeof d === "string" ? d.trim().toLowerCase() : ""))
        .filter((d) => d.length > 0)
    )
  );

  return cleanSites.map((domain, index) => ({
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
      isUrlFilterCaseSensitive: false,
      resourceTypes: ["main_frame"]
    }
  }));
}

async function syncRules(sites, isActive) {
  try {
    const existing = await chrome.declarativeNetRequest.getDynamicRules();

    const removeRuleIds = existing.map((rule) => rule.id);
    const addRules = isActive ? buildRules(sites) : [];

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules
    });
  } catch (error) {
    console.error("[DeepFocus] Failed to sync declarativeNetRequest rules:", error);
  }
}

async function handleUnauthorized() {
  await chrome.storage.local.set({
    authMode: "guest",
  });

  await chrome.storage.local.remove([
    "accessToken",
    "user",
  ]);

  try {
    chrome.runtime.sendMessage({ type: "AUTH_REVOKED" }).catch(() => {});
  } catch (e) {}
}

async function syncAccountState() {
  const {
    authMode,
    accessToken,
    deviceId = null,
    isActive = true,
    pendingAdditions = [],
    pendingRemovals = [],
  } = await chrome.storage.local.get([
    "authMode",
    "accessToken",
    "deviceId",
    "isActive",
    "pendingAdditions",
    "pendingRemovals",
  ]);

  if (authMode !== "account" || !accessToken) {
    return;
  }

  try {
    // ---------------------------------------------------------
    // 1. PROCESS OFFLINE PENDING ACTIONS
    // ---------------------------------------------------------

    const nextRemovals = [...(Array.isArray(pendingRemovals) ? pendingRemovals : [])];
    for (const domain of (Array.isArray(pendingRemovals) ? pendingRemovals : [])) {
      try {
        const encodedDomain = encodeURIComponent(domain.trim().toLowerCase());
        const res = await fetch(
          `${API_BASE_URL}/api/sites/domain/${encodedDomain}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "X-Device-Id": deviceId || "",
            },
          }
        );
        if (res.status === 401) {
          await handleUnauthorized();
          return;
        }
        if (res.ok || res.status === 404) {
          const idx = nextRemovals.indexOf(domain);
          if (idx !== -1) nextRemovals.splice(idx, 1);
        }
      } catch (err) {
        console.warn("[DeepFocus] Pending removal error in background:", domain, err);
      }
    }

    const nextAdditions = [...(Array.isArray(pendingAdditions) ? pendingAdditions : [])];
    for (const domain of (Array.isArray(pendingAdditions) ? pendingAdditions : [])) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/sites`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            "X-Device-Id": deviceId || "",
          },
          body: JSON.stringify({ domain: domain.trim().toLowerCase() }),
        });
        if (res.status === 401) {
          await handleUnauthorized();
          return;
        }
        if (res.ok || res.status === 409) {
          const idx = nextAdditions.indexOf(domain);
          if (idx !== -1) nextAdditions.splice(idx, 1);
        }
      } catch (err) {
        console.warn("[DeepFocus] Pending addition error in background:", domain, err);
      }
    }

    await chrome.storage.local.set({
      pendingAdditions: nextAdditions,
      pendingRemovals: nextRemovals,
    });

    // ---------------------------------------------------------
    // 2. FETCH CANONICAL CLOUD STATE
    // ---------------------------------------------------------

    const response = await fetch(
      `${API_BASE_URL}/api/sync`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Device-Id": deviceId || "",
        },
      }
    );

    if (response.status === 401) {
      await handleUnauthorized();
      return;
    }

    if (!response.ok) {
      return;
    }

    const data = await response.json();

    const cloudSites = (data.blocked_sites || [])
      .map((site) => site.domain.trim().toLowerCase())
      .sort();

    const cloudSiteMapObj = {};
    for (const site of (data.blocked_sites || [])) {
      cloudSiteMapObj[site.domain.trim().toLowerCase()] = site.id;
    }

    const newIsActive =
      data.blocking_enabled !== undefined
        ? data.blocking_enabled
        : isActive;

    await chrome.storage.local.set({
      blockedSites: cloudSites,
      isActive: newIsActive,
      cloudSiteMap: cloudSiteMapObj,
      syncVersion: data.sync_version,
    });

    await syncRules(
      cloudSites,
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

// Ensure rules are initialized when service worker boots up
initRules();

chrome.runtime.onInstalled.addListener(async () => {
  await initRules();
  await syncAccountState();
});

chrome.runtime.onStartup.addListener(async () => {
  await initRules();
  await syncAccountState();
});


// ---------------------------------------------------------
// COUNT BLOCKED DISTRACTIONS & FAILSAFE REDIRECTION
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

      // Failsafe redirection in case DeclarativeNetRequest hasn't completed dynamic rule update
      if (!details.url.includes("blocked.html")) {
        chrome.tabs.update(details.tabId, {
          url: chrome.runtime.getURL(`blocked.html?site=${encodeURIComponent(matchedSite)}`)
        });
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
          const blockRes = await fetch(
            `${API_BASE_URL}/api/block-events`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization:
                  `Bearer ${accessToken}`,
                "X-Device-Id": deviceId || "",
              },
              body: JSON.stringify({
                domain: matchedSite,
                device_id: deviceId || null,
              }),
            }
          );
          if (blockRes.status === 401) {
            await handleUnauthorized();
          }
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