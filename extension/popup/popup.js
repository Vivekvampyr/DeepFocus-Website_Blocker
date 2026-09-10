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

function updateStatusLabel() {
  statusLabel.textContent = isActive ? "Active" : "Paused";
  statusLabel.style.color = isActive ? "var(--muted)" : "var(--danger)";
}

toggle.addEventListener("change", () => {
  isActive = toggle.checked;
  updateStatusLabel();
  persist();
});

function updateStats() {
  siteCountEl.textContent = sites.length;
  loadBlockedCount();
}

function updateAccountUI(authMode, user = null) {
  if (authMode === "account") {
    accountLabel.textContent = user?.email || "Account";
    accountAction.textContent = "Logout";
    return;
  }

  accountLabel.textContent = "Guest";
  accountAction.textContent = "Log in";
  accountAction.addEventListener("click", async () => {
      const { authMode } = await chrome.storage.local.get("authMode");

      if (authMode === "account") {
        await chrome.storage.local.remove([
          "authMode",
          "accessToken",
          "user",
        ]);

        window.location.href = "login.html";
        return;
      }

      window.location.href = "login-form.html";
    });
}

async function loadBlockedCount() {
  const { blockedCount = 0 } = await chrome.storage.local.get("blockedCount");
  blockedCountEl.textContent = blockedCount;
  chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;

      if (changes.blockedCount) {
        blockedCountEl.textContent =
          changes.blockedCount.newValue ?? 0;
      }
    });
}

// Turn whatever the user typed ("https://www.facebook.com/", "Instagram.com") into a bare domain.
function normalizeDomain(raw) {
  let d = raw.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.replace(/^www\./, "");
  d = d.split("/")[0];
  d = d.split("?")[0];
  return d;
}

function isValidDomain(d) {
  // Simple check: at least "something.something", letters/numbers/dots/hyphens only.
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d);
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.hidden = false;
}

function clearError() {
  errorMsg.hidden = true;
}

function render() {
  listEl.innerHTML = "";
  emptyMsg.hidden = sites.length > 0;

  siteCountEl.textContent = sites.length;

  for (const site of sites) {
    const li = document.createElement("li");

    const label = document.createElement("span");
    label.textContent = site;

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-btn";
    removeBtn.setAttribute("aria-label", `Unblock ${site}`);
    removeBtn.textContent = "\u00D7"; // ×
    removeBtn.addEventListener("click", () => removeSite(site));

    li.appendChild(label);
    li.appendChild(removeBtn);
    listEl.appendChild(li);

    
  }
}

async function persist() {
  await chrome.storage.local.set({ blockedSites: sites, isActive });
  // Tell the background service worker to rebuild its blocking rules.
  chrome.runtime.sendMessage({ type: "SITES_UPDATED", sites, isActive });
}

function addSite(rawValue) {
  const domain = normalizeDomain(rawValue);

  if (!domain) {
    showError("Enter a website first.");
    return;
  }
  if (!isValidDomain(domain)) {
    showError("That doesn't look like a valid domain (e.g. facebook.com).");
    return;
  }
  if (sites.includes(domain)) {
    showError(`${domain} is already blocked.`);
    return;
  }

  clearError();
  sites.push(domain);
  sites.sort();
  render();
  persist();
}

function removeSite(domain) {
  sites = sites.filter((s) => s !== domain);
  render();
  persist();
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  addSite(input.value);
  input.value = "";
  input.focus();
});

input.addEventListener("input", clearError);

// Load saved sites when the popup opens.
(async function init() {
  const { authMode, user: savedUser } =
    await chrome.storage.local.get([
      "authMode",
      "user",
    ]);

  if (!authMode) {
    window.location.href = "login.html";
    return;
  }

  let user = savedUser;

  if (authMode === "account") {
    user = await getCurrentUser();

    if (!user) {
      window.location.href = "login.html";
      return;
    }
  }

  const {
    blockedSites = [],
    isActive: savedActive = true,
  } = await chrome.storage.local.get([
    "blockedSites",
    "isActive",
  ]);

  sites = blockedSites;
  isActive = savedActive;

  toggle.checked = isActive;
  updateStatusLabel();
  updateAccountUI(authMode, user);
  render();
  loadBlockedCount();
})();