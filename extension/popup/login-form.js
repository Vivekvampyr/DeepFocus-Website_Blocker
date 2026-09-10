const API_BASE_URL = "http://127.0.0.1:8000";

const form = document.getElementById("auth-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const errorMsg = document.getElementById("error-msg");
const submitBtn = document.getElementById("submit-btn");
const formTitle = document.getElementById("form-title");
const formSubtitle = document.getElementById("form-subtitle");
const modeToggle = document.getElementById("mode-toggle");
const backBtn = document.getElementById("back-btn");

let isLoginMode = true;

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.hidden = false;
}

function clearError() {
  errorMsg.textContent = "";
  errorMsg.hidden = true;
}

function updateFormMode() {
  clearError();

  if (isLoginMode) {
    formTitle.textContent = "Login";
    formSubtitle.textContent =
      "Sign in to sync your DeepFocus settings.";

    passwordInput.autocomplete = "current-password";

    submitBtn.textContent = "Login";

    modeToggle.textContent =
      "Don't have an account? Create one";
  } else {
    formTitle.textContent = "Create account";
    formSubtitle.textContent =
      "Create an account to sync across devices.";

    passwordInput.autocomplete = "new-password";

    submitBtn.textContent = "Create account";

    modeToggle.textContent =
      "Already have an account? Login";
  }
}

modeToggle.addEventListener("click", () => {
  isLoginMode = !isLoginMode;
  updateFormMode();
});

backBtn.addEventListener("click", () => {
  window.location.href = "login.html";
});

async function register() {
  const response = await fetch(
    `${API_BASE_URL}/api/auth/register`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: emailInput.value.trim(),
        password: passwordInput.value,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail || "Could not create your account."
    );
  }

  return data;
}

async function login() {
  const response = await fetch(
    `${API_BASE_URL}/api/auth/login`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: emailInput.value.trim(),
        password: passwordInput.value,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail || "Invalid email or password."
    );
  }

  return data;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  clearError();

  submitBtn.disabled = true;
  submitBtn.textContent = isLoginMode
    ? "Logging in..."
    : "Creating account...";

  try {
    if (!isLoginMode) {
      await register();

      // After registration, automatically log the user in.
      isLoginMode = true;

      const data = await login();

      await chrome.storage.local.set({
        authMode: "account",
        accessToken: data.access_token,
      });

      window.location.href = "popup.html";
      return;
    }

    const data = await login();

    await chrome.storage.local.set({
      authMode: "account",
      accessToken: data.access_token,
    });

    window.location.href = "popup.html";

  } catch (error) {
    showError(error.message);
  } finally {
    submitBtn.disabled = false;
    updateFormMode();
  }
});

updateFormMode();