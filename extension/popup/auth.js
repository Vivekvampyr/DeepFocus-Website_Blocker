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


async function getCurrentUser() {
  const token = await getAuthToken();

  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      await chrome.storage.local.remove([
        "accessToken",
        "user",
      ]);

      await chrome.storage.local.set({
        authMode: "guest",
      });

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

  const { deviceId } =
    await chrome.storage.local.get("deviceId");

  try {
    await fetch(
      `${API_BASE_URL}/api/block-events`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          domain,
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

async function addCloudSite(domain) {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Not authenticated.");
  }

  const response = await fetch(`${API_BASE_URL}/api/sites`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      domain,
    }),
  });

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

  const response = await fetch(
    `${API_BASE_URL}/api/sites/${siteId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      parseErrorMessage(data, "Could not remove the site from the cloud.")
    );
  }

  return true;
}


async function fetchCloudSites() {
  const token = await getAuthToken();

  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/sites`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      await chrome.storage.local.remove([
        "accessToken",
        "user",
      ]);

      await chrome.storage.local.set({
        authMode: "guest",
      });

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
    const response = await fetch(
      `${API_BASE_URL}/api/sync`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.status === 401) {
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

  const response = await fetch(
    `${API_BASE_URL}/api/settings/blocking`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        blocking_enabled: enabled,
      }),
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      parseErrorMessage(data, "Could not update blocking settings.")
    );
  }

  return true;
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

  const response = await fetch(
    `${API_BASE_URL}/api/devices/register`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        device_id: deviceId,
        browser: getBrowserName(),
        operating_system: getOperatingSystem(),
        extension_version: "1.0.0",
      }),
    }
  );

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