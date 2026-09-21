// const API_BASE_URL = "http://127.0.0.1:8000";
const API_BASE_URL = "https://deepfocus-backend.vercel.app";


const form = document.getElementById(
  "forgot-password-form"
);

const emailInput = document.getElementById(
  "email"
);

const errorMsg = document.getElementById(
  "error-msg"
);

const successMsg = document.getElementById(
  "success-msg"
);

const submitBtn = document.getElementById(
  "submit-btn"
);

const backBtn = document.getElementById(
  "back-btn"
);


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


function showSuccess(message) {
  successMsg.textContent = message;
  successMsg.hidden = false;
}


function clearSuccess() {
  successMsg.textContent = "";
  successMsg.hidden = true;
}


// ---------------------------------------------------------
// BACK
// ---------------------------------------------------------

backBtn.addEventListener("click", () => {
  window.location.href =
    chrome.runtime.getURL(
      "popup/login-form.html"
    );
});


// ---------------------------------------------------------
// SUBMIT
// ---------------------------------------------------------

form.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    clearError();
    clearSuccess();

    const email = emailInput.value.trim();

    if (!email) {
      showError("Enter your email address.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";


    try {
      const response = await fetch(
        `${API_BASE_URL}/api/auth/forgot-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
          }),
        }
      );


      const data =
        await response.json().catch(
          () => ({})
        );


      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Unable to send the reset link."
        );
      }

      
      showSuccess(
        "If an account exists, a password reset link has been sent to your email."
      );

      emailInput.value = "";
      submitBtn.disabled = true;
      submitBtn.textContent = "Reset Link Sent";


    } catch (error) {
      console.error(
        "Forgot password request failed:",
        error
      );

      showError(
        error.message ||
          "Unable to send the reset link. Please try again."
      );


    } finally {
      if (!successMsg.hidden) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Reset Link Sent";
      } else {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send Reset Link";
      }
    }
  }
);