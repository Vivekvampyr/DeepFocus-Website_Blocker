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
  const previousValue = isActive;

  isActive = toggle.checked;

  updateStatusLabel();

  await persist();

  if (authMode !== "account") {
    return;
  }

  try {
    await updateCloudBlockingSetting(isActive);
  } catch (error) {
    console.error(
      "Failed to sync blocking setting:",
      error
    );

    // Revert if cloud update failed.
    isActive = previousValue;
    toggle.checked = previousValue;

    updateStatusLabel();
    await persist();

    showError(
      "Could not sync your blocking setting."
    );
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


  // -------------------------
  // GUEST
  // -------------------------

  if (authMode !== "account") {
    sites.push(domain);
    sites.sort();

    render();
    await persist();

    return;
  }


  // -------------------------
  // ACCOUNT
  // -------------------------

  try {
    const cloudSite = await addCloudSite(domain);

    cloudSiteIds.set(
      cloudSite.domain,
      cloudSite.id
    );

    sites.push(domain);
    sites.sort();

    render();
    await persist();

  } catch (error) {
    console.error("Add cloud site failed:", error);

    showError(error.message);
  }
}


// ---------------------------------------------------------
// REMOVE SITE
// ---------------------------------------------------------

async function removeSite(domain) {
  clearError();

  // -------------------------
  // GUEST
  // -------------------------

  if (authMode !== "account") {
    sites = sites.filter(
      (site) => site !== domain
    );

    render();
    await persist();

    return;
  }


  // -------------------------
  // ACCOUNT
  // -------------------------

  const siteId = cloudSiteIds.get(domain);

  console.log(
    "Removing site:",
    domain,
    "Cloud ID:",
    siteId
  );

  if (!siteId) {
    showError(
      "Could not find this site's cloud record."
    );

    return;
  }


  try {
    await deleteCloudSite(siteId);

    cloudSiteIds.delete(domain);

    sites = sites.filter(
      (site) => site !== domain
    );

    render();
    await persist();

  } catch (error) {
    console.error(
      "Remove cloud site failed:",
      error
    );

    showError(error.message);
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


  // -------------------------
  // GUEST
  // -------------------------

  if (authMode === "guest") {
    updateAccountUI("guest");

    return true;
  }


  // -------------------------
  // ACCOUNT
  // -------------------------

  if (authMode === "account") {
    const user = await getCurrentUser();

    if (!user) {
      authMode = "guest";
      currentUser = null;

      updateAccountUI("guest");

      return true;
    }

    currentUser = user;

    updateAccountUI("account", user);

    try {
      await registerDevice();
    } catch (error) {
      console.error(
        "Device registration/update failed:",
        error
      );
    }

    return true;
  }


  // Safety fallback

  authMode = "guest";

  await chrome.storage.local.set({
    authMode: "guest",
  });

  updateAccountUI("guest");

  return true;
}


// ---------------------------------------------------------
// CLOUD SYNC
// ---------------------------------------------------------

async function syncFromCloud() {
  if (authMode !== "account") {
    return false;
  }

  const state = await fetchCloudSyncState();

  if (!state) {
    return false;
  }

  syncVersion = state.sync_version;

  cloudSiteIds = new Map(
    state.blocked_sites.map((site) => [
      site.domain,
      site.id,
    ])
  );

  sites = state.blocked_sites.map(
    (site) => site.domain
  );

  isActive = state.blocking_enabled;

  await chrome.storage.local.set({
    blockedSites: sites,
    isActive,
  });

  toggle.checked = isActive;

  updateStatusLabel();
  render();

  chrome.runtime.sendMessage({
    type: "SITES_UPDATED",
    sites,
    isActive,
  });

  return true;
}


// ---------------------------------------------------------
// INITIALIZATION
// ---------------------------------------------------------

(async function init() {
  const authenticated = await initializeAuth();

  if (!authenticated) {
    return;
  }


  const {
    blockedSites = [],
    isActive: savedActive = true,
    syncVersion: savedSyncVersion = 0,
  } = await chrome.storage.local.get([
    "blockedSites",
    "isActive",
    "syncVersion",
  ]);

  syncVersion = savedSyncVersion;

  sites = blockedSites;

  isActive = savedActive;

  toggle.checked = isActive;

  updateStatusLabel();

  render();

  await loadBlockedCount();

  // Only logged-in users sync with backend.
  if (authMode === "account") {
    await syncFromCloud();

    render();
  }
})();