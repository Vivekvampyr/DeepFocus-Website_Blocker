const API_BASE_URL = "http://127.0.0.1:8000";

async function getCurrentUser() {
  const { accessToken } = await chrome.storage.local.get("accessToken");

  if (!accessToken) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      await chrome.storage.local.remove([
        "authMode",
        "accessToken",
        "user",
      ]);

      return null;
    }

    const user = await response.json();

    await chrome.storage.local.set({
      authMode: "account",
      user,
    });

    return user;
  } catch (error) {
    console.error("Authentication check failed:", error);

    // Don't log the user out just because the backend is temporarily
    // unreachable. The extension should continue working offline.
    return {
      offline: true,
    };
  }
}