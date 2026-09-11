const API_BASE_URL = "http://127.0.0.1:8000";

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
      data.detail || "Could not add the site to the cloud."
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
      data.detail || "Could not remove the site from the cloud."
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

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));

    throw new Error(
      data.detail || "Could not update blocking settings."
    );
  }

  return true;
}