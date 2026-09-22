const API_BASE_URL = "http://127.0.0.1:8000";
// const API_BASE_URL = "https://deepfocus-backend.vercel.app";

function parseErrorMessage(data, defaultMsg) {
  if (!data) return defaultMsg;
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail) && data.detail.length > 0) {
    return data.detail
      .map((item) => (typeof item === "string" ? item : item.msg || JSON.stringify(item)))
      .join(", ");
  }
  if (typeof data.message === "string") return data.message;
  if (typeof data.error === "string") return data.error;
  if (typeof data.error?.message === "string") return data.error.message;
  return defaultMsg;
}

async function getAuthToken() {
  const { accessToken } = await chrome.storage.local.get("accessToken");
  return accessToken || null;
}

async function getDeviceId() {
  const { deviceId } = await chrome.storage.local.get("deviceId");

  if (deviceId) {
    return deviceId;
  }

  const newDeviceId = crypto.randomUUID();

  await chrome.storage.local.set({
    deviceId: newDeviceId,
  });

  return newDeviceId;
}

async function handleUnauthorized() {
  await chrome.storage.local.remove([
    "accessToken",
    "user",
  ]);

  await chrome.storage.local.set({
    authMode: "guest",
  });
}

async function authHeaders(extraHeaders = {}) {
  const token = await getAuthToken();
  const deviceId = await getDeviceId();
  const headers = { ...extraHeaders };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (deviceId) {
    headers["X-Device-Id"] = deviceId;
  }

  return headers;
}


async function getCurrentUser() {
  const token = await getAuthToken();

  if (!token) {
    return null;
  }

  try {
    const headers = await authHeaders();
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      method: "GET",
      headers,
    });

    if (response.status === 401) {
      await handleUnauthorized();
      return null;
    }

    if (!response.ok) {
      throw new Error("Authentication check failed.");
    }

    const user = await response.json();

    await chrome.storage.local.set({
      authMode: "account",
      user,
    });

    return user;
  } catch (error) {
    console.error("Authentication check failed:", error);

    // Keep the user logged in when the backend is temporarily offline.
    return {
      offline: true,
    };
  }
}

async function recordBlockEvent(domain) {
  const token = await getAuthToken();

  if (!token) {
    return;
  }

  const deviceId = await getDeviceId();

  try {
    const headers = await authHeaders({
      "Content-Type": "application/json",
    });

    const response = await fetch(
      `${API_BASE_URL}/api/block-events`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          domain,
          device_id: deviceId || null,
        }),
      }
    );

    if (response.status === 401) {
      await handleUnauthorized();
    }
  } catch (error) {
    console.error(
      "Failed to record block event:",
      error
    );
  }
}

async function addCloudSite(domain) {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Not authenticated.");
  }

  const headers = await authHeaders({
    "Content-Type": "application/json",
  });

  const response = await fetch(`${API_BASE_URL}/api/sites`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      domain,
    }),
  });

  if (response.status === 401) {
    await handleUnauthorized();
    throw new Error("This device has been revoked or logged out.");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      parseErrorMessage(data, "Could not add the site to the cloud.")
    );
  }

  return data;
}


async function deleteCloudSite(siteId) {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Not authenticated.");
  }

  const headers = await authHeaders();

  const response = await fetch(
    `${API_BASE_URL}/api/sites/${siteId}`,
    {
      method: "DELETE",
      headers,
    }
  );

  if (response.status === 401) {
    await handleUnauthorized();
    throw new Error("This device has been revoked or logged out.");
  }

  if (response.status === 404) {
    return true;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      parseErrorMessage(data, "Could not remove the site from the cloud.")
    );
  }

  return true;
}


async function deleteCloudSiteByDomain(domain) {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Not authenticated.");
  }

  const encodedDomain = encodeURIComponent(domain.trim().toLowerCase());
  const headers = await authHeaders();

  const response = await fetch(
    `${API_BASE_URL}/api/sites/domain/${encodedDomain}`,
    {
      method: "DELETE",
      headers,
    }
  );

  if (response.status === 401) {
    await handleUnauthorized();
    throw new Error("This device has been revoked or logged out.");
  }

  if (response.status === 404) {
    return true;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      parseErrorMessage(data, "Could not remove the site from the cloud.")
    );
  }

  return true;
}


async function getPendingSyncActions() {
  const { pendingAdditions = [], pendingRemovals = [] } =
    await chrome.storage.local.get(["pendingAdditions", "pendingRemovals"]);

  return {
    pendingAdditions: Array.isArray(pendingAdditions) ? pendingAdditions : [],
    pendingRemovals: Array.isArray(pendingRemovals) ? pendingRemovals : [],
  };
}

async function queuePendingAddition(domain) {
  const clean = domain.trim().toLowerCase();
  const { pendingAdditions, pendingRemovals } = await getPendingSyncActions();

  await chrome.storage.local.set({
    pendingAdditions: Array.from(new Set([...pendingAdditions, clean])),
    pendingRemovals: pendingRemovals.filter((d) => d !== clean),
  });
}

async function queuePendingRemoval(domain) {
  const clean = domain.trim().toLowerCase();
  const { pendingAdditions, pendingRemovals } = await getPendingSyncActions();

  await chrome.storage.local.set({
    pendingAdditions: pendingAdditions.filter((d) => d !== clean),
    pendingRemovals: Array.from(new Set([...pendingRemovals, clean])),
  });
}

async function processPendingSyncActions() {
  const token = await getAuthToken();
  if (!token) return;

  const { pendingAdditions, pendingRemovals } = await getPendingSyncActions();
  if (pendingAdditions.length === 0 && pendingRemovals.length === 0) return;

  const nextRemovals = [...pendingRemovals];
  for (const domain of pendingRemovals) {
    try {
      await deleteCloudSiteByDomain(domain);
      const idx = nextRemovals.indexOf(domain);
      if (idx !== -1) nextRemovals.splice(idx, 1);
    } catch (err) {
      console.warn("[DeepFocus] Pending removal failed for", domain, err);
    }
  }

  const nextAdditions = [...pendingAdditions];
  for (const domain of pendingAdditions) {
    try {
      await addCloudSite(domain);
      const idx = nextAdditions.indexOf(domain);
      if (idx !== -1) nextAdditions.splice(idx, 1);
    } catch (err) {
      if (err.message && err.message.includes("already blocked")) {
        const idx = nextAdditions.indexOf(domain);
        if (idx !== -1) nextAdditions.splice(idx, 1);
      } else {
        console.warn("[DeepFocus] Pending addition failed for", domain, err);
      }
    }
  }

  await chrome.storage.local.set({
    pendingAdditions: nextAdditions,
    pendingRemovals: nextRemovals,
  });
}


async function fetchCloudSites() {
  const token = await getAuthToken();

  if (!token) {
    return null;
  }

  try {
    const headers = await authHeaders();
    const response = await fetch(`${API_BASE_URL}/api/sites`, {
      method: "GET",
      headers,
    });

    if (response.status === 401) {
      await handleUnauthorized();
      return null;
    }

    if (!response.ok) {
      throw new Error("Could not fetch blocked sites.");
    }

    return await response.json();
  } catch (error) {
    console.error("Cloud site fetch failed:", error);

    // Backend unavailable → keep local data.
    return null;
  }
}

async function fetchCloudSyncState() {
  const token = await getAuthToken();

  if (!token) {
    return null;
  }

  try {
    const headers = await authHeaders();
    const response = await fetch(
      `${API_BASE_URL}/api/sync`,
      {
        method: "GET",
        headers,
      }
    );

    if (response.status === 401) {
      await handleUnauthorized();
      return null;
    }

    if (!response.ok) {
      throw new Error("Could not sync DeepFocus.");
    }

    return await response.json();
  } catch (error) {
    console.error("Sync failed:", error);
    return null;
  }
}


async function updateCloudBlockingSetting(enabled) {
  const token = await getAuthToken();

  if (!token) {
    return false;
  }

  const headers = await authHeaders({
    "Content-Type": "application/json",
  });

  const response = await fetch(
    `${API_BASE_URL}/api/settings/blocking`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        blocking_enabled: enabled,
      }),
    }
  );

  if (response.status === 401) {
    await handleUnauthorized();
    return false;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      parseErrorMessage(data, "Could not update blocking settings.")
    );
  }

  return true;
}

function getBrowserName() {
  const ua = navigator.userAgent;

  if (ua.includes("Edg/")) {
    return "Edge";
  }

  if (ua.includes("Firefox/")) {
    return "Firefox";
  }

  if (ua.includes("Chrome/")) {
    return "Chrome";
  }

  if (ua.includes("Safari/")) {
    return "Safari";
  }

  return "Unknown";
}


function getOperatingSystem() {
  const ua = navigator.userAgent;

  if (ua.includes("Windows")) {
    return "Windows";
  }

  if (ua.includes("Mac OS")) {
    return "macOS";
  }

  if (ua.includes("Linux")) {
    return "Linux";
  }

  if (ua.includes("Android")) {
    return "Android";
  }

  if (ua.includes("iPhone") || ua.includes("iPad")) {
    return "iOS";
  }

  return "Unknown";
}

async function registerDevice() {
  const token = await getAuthToken();

  if (!token) {
    return null;
  }

  const deviceId = await getDeviceId();
  const headers = await authHeaders({
    "Content-Type": "application/json",
  });

  const response = await fetch(
    `${API_BASE_URL}/api/devices/register`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        device_id: deviceId,
        browser: getBrowserName(),
        operating_system: getOperatingSystem(),
        extension_version: "1.0.0",
      }),
    }
  );

  if (response.status === 401) {
    await handleUnauthorized();
    throw new Error("This device has been revoked.");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      parseErrorMessage(data, "Could not register this device.")
    );
  }

  await chrome.storage.local.set({
    device: data,
  });

  return data;
}
