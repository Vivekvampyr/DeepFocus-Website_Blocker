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


// ---------------------------------------------------------
// UI
// ---------------------------------------------------------

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


// ---------------------------------------------------------
// LOGIN / REGISTER MODE TOGGLE
// ---------------------------------------------------------

modeToggle.type = "button";

modeToggle.addEventListener("click", (event) => {
  event.preventDefault();

  isLoginMode = !isLoginMode;

  passwordInput.value = "";

  updateFormMode();
});


// ---------------------------------------------------------
// BACK
// ---------------------------------------------------------

backBtn.type = "button";

backBtn.addEventListener("click", (event) => {
  event.preventDefault();

  window.location.href = chrome.runtime.getURL(
    "popup/login.html"
  );
});


// ---------------------------------------------------------
// API
// ---------------------------------------------------------

function formatApiError(response, data, defaultMsg) {
  if (data) {
    if (typeof data.detail === "string") {
      return data.detail;
    }
    if (Array.isArray(data.detail) && data.detail.length > 0) {
      return data.detail
        .map((item) => (typeof item === "string" ? item : item.msg || JSON.stringify(item)))
        .join(", ");
    }
    if (typeof data.message === "string") {
      return data.message;
    }
    if (typeof data.error === "string") {
      return data.error;
    }
    if (typeof data.error?.message === "string") {
      return data.error.message;
    }
  }

  if (response?.status === 401) {
    return "Invalid email or password.";
  }
  if (response?.status === 409) {
    return "An account with this email already exists.";
  }
  if (response?.status === 422) {
    return "Please check the form inputs.";
  }
  if (response?.status >= 500) {
    return "Server error. Please try again later.";
  }

  return defaultMsg;
}

async function registerUser() {
  let response;
  try {
    response = await fetch(
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
  } catch (err) {
    throw new Error(
      `Unable to connect to server at ${API_BASE_URL}. Please check your connection.`
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      formatApiError(response, data, "Could not create your account.")
    );
  }

  return data;
}


async function loginUser() {
  let response;
  try {
    response = await fetch(
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
  } catch (err) {
    throw new Error(
      `Unable to connect to server at ${API_BASE_URL}. Please check your connection.`
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      formatApiError(response, data, "Invalid email or password.")
    );
  }

  if (!data.access_token) {
    throw new Error(
      "Login succeeded but no authentication token was returned."
    );
  }

  return data;
}


// ---------------------------------------------------------
// SUBMIT
// ---------------------------------------------------------

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  clearError();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showError("Email and password are required.");
    return;
  }

  submitBtn.disabled = true;

  try {
    let loginData;

    // -------------------------
    // REGISTER
    // -------------------------

    if (!isLoginMode) {
      submitBtn.textContent = "Creating account...";

      await registerUser();

      // Automatically log in after registration.
      loginData = await loginUser();
    }

    // -------------------------
    // LOGIN
    // -------------------------

    else {
      submitBtn.textContent = "Logging in...";

      loginData = await loginUser();
    }


    // -------------------------
    // SAVE AUTH STATE
    // -------------------------

    await chrome.storage.local.set({
      authMode: "account",
      accessToken: loginData.access_token,
    });

    console.log(
      "DeepFocus authentication successful."
    );


    // -------------------------
    // DEVICE REGISTRATION
    // -------------------------

    try {
      const device = await registerDevice();

      console.log(
        "DeepFocus device registered:",
        device
      );
    } catch (error) {
      console.error(
        "Device registration failed:",
        error
      );

      // Do NOT prevent login because of this.
    }


    // -------------------------
    // GO TO MAIN POPUP
    // -------------------------

    window.location.href = chrome.runtime.getURL(
      "popup/popup.html"
    );

  } catch (error) {
    console.error(
      "DeepFocus authentication error:",
      error
    );

    showError(
      error.message ||
      "Something went wrong. Please try again."
    );

    submitBtn.disabled = false;

    updateFormMode();
  }
});


// ---------------------------------------------------------
// INITIAL UI
// ---------------------------------------------------------

updateFormMode();