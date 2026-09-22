const form = document.getElementById("add-form");
const input = document.getElementById("site-input");
const errorMsg = document.getElementById("error-msg");
const listEl = document.getElementById("site-list");
const emptyMsg = document.getElementById("empty-msg");
const toggle = document.getElementById("active-toggle");
const statusLabel = document.getElementById("status-label");
const blockedCountEl = document.getElementById("blocked-count");
const siteCountEl = document.getElementById("site-count");
const accountLabel = document.getElementById("account-label");
const accountAction = document.getElementById("account-action");

let sites = [];
let isActive = true;

let authMode = "guest";
let currentUser = null;

let syncVersion = 0;

// domain -> backend database ID
let cloudSiteIds = new Map();


// ---------------------------------------------------------
// STATUS
// ---------------------------------------------------------

function updateStatusLabel() {
  statusLabel.textContent = isActive ? "Active" : "Paused";

  statusLabel.style.color = isActive
    ? "var(--muted)"
    : "var(--danger)";
}


// ---------------------------------------------------------
// ACCOUNT UI
// ---------------------------------------------------------

function updateAccountUI(mode, user = null) {
  if (mode === "account") {
    accountLabel.textContent =
      user?.email || "Account";

    accountAction.textContent = "Logout";

    return;
  }

  accountLabel.textContent = "Guest";
  accountAction.textContent = "Log in";
}


// ---------------------------------------------------------
// ACCOUNT BUTTON
// ---------------------------------------------------------

accountAction.addEventListener("click", async (event) => {
  event.preventDefault();
  event.stopPropagation();

  console.log("Account button clicked:", authMode);

  if (authMode === "account") {
    // Immediately switch to guest mode.
    authMode = "guest";
    currentUser = null;

    await chrome.storage.local.set({
      authMode: "guest",
    });

    await chrome.storage.local.remove([
      "accessToken",
      "user",
    ]);

    updateAccountUI("guest");

    console.log("Logged out successfully.");

    return;
  }

  window.location.href = chrome.runtime.getURL(
    "popup/login-form.html"
  );
});


// ---------------------------------------------------------
// TOGGLE
// ---------------------------------------------------------

toggle.addEventListener("change", async () => {
  isActive = toggle.checked;

  updateStatusLabel();

  await persist();

  if (authMode === "account") {
    updateCloudBlockingSetting(isActive).catch((error) => {
      console.warn("Failed to sync blocking setting to cloud:", error);
    });
  }
});


// ---------------------------------------------------------
// DOMAIN
// ---------------------------------------------------------

function normalizeDomain(raw) {
  let d = raw.trim().toLowerCase();

  d = d.replace(/^https?:\/\//, "");
  d = d.replace(/^www\./, "");

  d = d.split("/")[0];
  d = d.split("?")[0];

  return d;
}


function isValidDomain(d) {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d);
}


// ---------------------------------------------------------
// ERROR
// ---------------------------------------------------------

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.hidden = false;
}


function clearError() {
  errorMsg.hidden = true;
}


// ---------------------------------------------------------
// RENDER
// ---------------------------------------------------------

function render() {
  listEl.innerHTML = "";

  emptyMsg.hidden = sites.length > 0;

  siteCountEl.textContent = sites.length;

  for (const site of sites) {
    const li = document.createElement("li");

    const label = document.createElement("span");

    label.textContent = site;

    const removeBtn = document.createElement("button");

    removeBtn.type = "button";
    removeBtn.className = "remove-btn";

    removeBtn.setAttribute(
      "aria-label",
      `Unblock ${site}`
    );

    removeBtn.textContent = "\u00D7";

    removeBtn.addEventListener("click", () => {
      removeSite(site);
    });

    li.appendChild(label);
    li.appendChild(removeBtn);

    listEl.appendChild(li);
  }
}


// ---------------------------------------------------------
// PERSIST LOCAL STATE + DNR
// ---------------------------------------------------------

async function persist() {
  await chrome.storage.local.set({
    blockedSites: sites,
    isActive,
  });

  chrome.runtime.sendMessage({
    type: "SITES_UPDATED",
    sites,
    isActive,
  });
}


// ---------------------------------------------------------
// BLOCK ATTEMPTS
// ---------------------------------------------------------

async function loadBlockedCount() {
  const { blockedCount = 0 } =
    await chrome.storage.local.get("blockedCount");

  blockedCountEl.textContent = blockedCount;
}


// ---------------------------------------------------------
// ADD SITE
// ---------------------------------------------------------

async function addSite(rawValue) {
  const domain = normalizeDomain(rawValue);

  if (!domain) {
    showError("Enter a website first.");
    return;
  }

  if (!isValidDomain(domain)) {
    showError(
      "That doesn't look like a valid domain (e.g. facebook.com)."
    );
    return;
  }

  if (sites.includes(domain)) {
    showError(`${domain} is already blocked.`);
    return;
  }

  clearError();

  // Optimistically add site locally immediately (0ms delay!)
  sites.push(domain);
  sites.sort();

  render();
  await persist();

  // If in account mode, sync with cloud in background
  if (authMode === "account") {
    addCloudSite(domain)
      .then(async (cloudSite) => {
        cloudSiteIds.set(cloudSite.domain, cloudSite.id);
        const cloudSiteMapObj = Object.fromEntries(cloudSiteIds);
        await chrome.storage.local.set({
          cloudSiteMap: cloudSiteMapObj,
        });
      })
      .catch(async (error) => {
        console.warn("Add cloud site failed, queueing offline addition:", error);
        await queuePendingAddition(domain);
      });
  }
}


// ---------------------------------------------------------
// REMOVE SITE
// ---------------------------------------------------------

async function removeSite(domain) {
  clearError();

  const siteId = cloudSiteIds.get(domain);

  // Optimistically remove locally immediately (0ms delay!)
  sites = sites.filter((site) => site !== domain);
  cloudSiteIds.delete(domain);

  render();
  await persist();

  // If in account mode, update cloud in background
  if (authMode === "account") {
    const cloudSiteMapObj = Object.fromEntries(cloudSiteIds);
    chrome.storage.local.set({ cloudSiteMap: cloudSiteMapObj });

    const deletePromise = siteId
      ? deleteCloudSite(siteId).catch(() => deleteCloudSiteByDomain(domain))
      : deleteCloudSiteByDomain(domain);

    deletePromise.catch(async (error) => {
      console.warn("Remove cloud site failed, queueing offline removal:", error);
      await queuePendingRemoval(domain);
    });
  }
}


// ---------------------------------------------------------
// FORM
// ---------------------------------------------------------

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  await addSite(input.value);

  input.value = "";
  input.focus();
});


input.addEventListener("input", clearError);


// ---------------------------------------------------------
// ---------------------------------------------------------
// AUTH STATE
// ---------------------------------------------------------

async function initializeAuth() {
  const {
    authMode: savedAuthMode = "guest",
    user: savedUser = null,
  } = await chrome.storage.local.get([
    "authMode",
    "user",
  ]);

  authMode = savedAuthMode;
  currentUser = savedUser;

  updateAccountUI(authMode, currentUser);

  // Background token verification (non-blocking)
  if (authMode === "account") {
    getCurrentUser()
      .then((user) => {
        if (!user) {
          authMode = "guest";
          currentUser = null;
          updateAccountUI("guest");
        } else if (!user.offline) {
          currentUser = user;
          updateAccountUI("account", user);
        }
      })
      .catch((e) => {
        console.warn("Background auth check warning:", e);
      });
  }

  return true;
}


// ---------------------------------------------------------
// CLOUD SYNC (AUTHORITATIVE CLOUD STATE WITH OFFLINE QUEUE)
// ---------------------------------------------------------

async function syncFromCloud() {
  if (authMode !== "account") {
    return false;
  }

  try {
    // 1. Process any pending offline actions before fetching
    if (typeof processPendingSyncActions === "function") {
      await processPendingSyncActions();
    }

    // 2. Fetch canonical state from cloud
    const state = await fetchCloudSyncState();

    if (!state) {
      return false;
    }

    syncVersion = state.sync_version;

    const cloudSitesList = state.blocked_sites || [];
    const newCloudMap = new Map();
    const cloudDomains = [];

    for (const site of cloudSitesList) {
      const clean = site.domain.trim().toLowerCase();
      newCloudMap.set(clean, site.id);
      cloudDomains.push(clean);
    }
    cloudDomains.sort();

    // Canonical list from cloud
    sites = cloudDomains;
    cloudSiteIds = newCloudMap;

    if (state.blocking_enabled !== undefined) {
      isActive = state.blocking_enabled;
      toggle.checked = isActive;
      updateStatusLabel();
    }

    const cloudSiteMapObj = Object.fromEntries(newCloudMap);
    await chrome.storage.local.set({
      blockedSites: sites,
      isActive,
      cloudSiteMap: cloudSiteMapObj,
      syncVersion,
    });

    render();

    chrome.runtime.sendMessage({
      type: "SITES_UPDATED",
      sites,
      isActive,
    });

    return true;
  } catch (error) {
    console.error("Cloud sync failed:", error);
    return false;
  }
}


// ---------------------------------------------------------
// INITIALIZATION (INSTANT 0MS LOAD FROM CACHE)
// ---------------------------------------------------------

(async function init() {
  // 1. Instantly read all saved state from local storage (0ms)
  const {
    blockedSites = [],
    isActive: savedActive = true,
    syncVersion: savedSyncVersion = 0,
    authMode: savedAuthMode = "guest",
    user: savedUser = null,
    cloudSiteMap = {},
    blockedCount = 0,
  } = await chrome.storage.local.get([
    "blockedSites",
    "isActive",
    "syncVersion",
    "authMode",
    "user",
    "cloudSiteMap",
    "blockedCount",
  ]);

  sites = Array.isArray(blockedSites) ? [...blockedSites] : [];
  isActive = savedActive;
  syncVersion = savedSyncVersion;
  authMode = savedAuthMode;
  currentUser = savedUser;
  cloudSiteIds = new Map(Object.entries(cloudSiteMap || {}));

  // 2. Render UI immediately! (ZERO delay for the user)
  toggle.checked = isActive;
  updateStatusLabel();
  updateAccountUI(authMode, currentUser);
  blockedCountEl.textContent = blockedCount;
  render();

  // 3. Asynchronously verify auth & sync in background without blocking popup
  initializeAuth();

  if (authMode === "account") {
    syncFromCloud().catch((err) => {
      console.warn("Initial cloud sync error:", err);
    });
  }
})();