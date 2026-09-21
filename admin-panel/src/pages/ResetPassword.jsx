import { useEffect, useState } from "react";
import api from "../api/client";

function ResetPassword() {
  const [token, setToken] = useState(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // ---------------------------------------------------------
  // READ RESET TOKEN FROM URL HASH
  // ---------------------------------------------------------

  useEffect(() => {
    const hash = window.location.hash;

    if (!hash.startsWith("#token=")) {
      return;
    }

    const tokenValue = hash.substring("#token=".length);

    if (!tokenValue) {
      return;
    }

    setToken(tokenValue);

    // Remove the token from the browser URL immediately.
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search
    );
  }, []);

  // ---------------------------------------------------------
  // SUBMIT
  // ---------------------------------------------------------

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (!token) {
      setError(
        "This password reset link is invalid or has expired."
      );
      return;
    }

    if (password.length < 8) {
      setError(
        "Password must contain at least 8 characters."
      );
      return;
    }

    if (password.length > 128) {
      setError(
        "Password must contain no more than 128 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await api.post("/api/auth/reset-password", {
        token,
        new_password: password,
      });

      setSuccess(true);

      setPassword("");
      setConfirmPassword("");

      // Keep the token out of React state after successful use.
      setToken(null);

    } catch (err) {
      console.error(
        "Password reset failed:",
        err
      );

      const detail = err.response?.data?.detail;

      if (typeof detail === "string") {
        setError(detail);
      } else {
        setError(
          "Unable to reset your password. Please try again."
        );
      }

    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------
  // SHARED STYLES
  // ---------------------------------------------------------

  const pageStyle = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    background: "#15171c",
    color: "#ecedef",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  };

  const cardStyle = {
    width: "100%",
    maxWidth: "440px",
    padding: "40px",
    background: "#1b1e24",
    border: "1px solid #2b2f38",
    borderRadius: "12px",
    boxShadow: "0 20px 50px rgba(0, 0, 0, 0.35)",
  };

  const iconStyle = {
    width: "44px",
    height: "44px",
    margin: "0 auto 22px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#c9a227",
  };

  const titleStyle = {
    margin: "0",
    textAlign: "center",
    fontFamily:
      'Georgia, "Times New Roman", serif',
    fontSize: "32px",
    fontWeight: "600",
    lineHeight: "1.2",
  };

  const subtitleStyle = {
    margin: "12px 0 30px",
    textAlign: "center",
    color: "#868b96",
    fontSize: "14px",
    lineHeight: "1.6",
  };

  const groupStyle = {
    marginBottom: "18px",
  };

  const labelStyle = {
    display: "block",
    marginBottom: "8px",
    fontSize: "13px",
    color: "#b9bdc7",
  };

  const inputStyle = {
    width: "100%",
    padding: "12px 14px",
    border: "1px solid #30343d",
    borderRadius: "8px",
    background: "#15171c",
    color: "#ecedef",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  };

  const submitStyle = {
    width: "100%",
    marginTop: "8px",
    padding: "13px 16px",
    border: "none",
    borderRadius: "8px",
    background: "#c9a227",
    color: "#111318",
    fontSize: "14px",
    fontWeight: "600",
    cursor: loading ? "not-allowed" : "pointer",
    opacity: loading ? 0.7 : 1,
  };

  const errorStyle = {
    margin: "0 0 18px",
    padding: "11px 12px",
    borderRadius: "7px",
    background: "rgba(220, 70, 70, 0.08)",
    border: "1px solid rgba(220, 70, 70, 0.25)",
    color: "#ff8585",
    fontSize: "13px",
    lineHeight: "1.5",
  };

  const successTextStyle = {
    margin: "14px 0 0",
    textAlign: "center",
    color: "#a9afb9",
    fontSize: "14px",
    lineHeight: "1.7",
  };

  // ---------------------------------------------------------
  // SUCCESS STATE
  // ---------------------------------------------------------

  if (success) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>

          <div style={iconStyle}>
            <svg
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                strokeWidth="1.5"
              />

              <path
                d="M8 12.5L10.5 15L16 9.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <h1 style={titleStyle}>
            Password changed successfully
          </h1>

          <p style={successTextStyle}>
            Your password has been updated.
            <br />
            Return to the DeepFocus extension and
            log in again with your new password.
          </p>

        </div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // RESET FORM
  // ---------------------------------------------------------

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>

        <div style={iconStyle}>
          <svg
            width="44"
            height="44"
            viewBox="0 0 24 24"
            fill="none"
          >
            <rect
              x="6"
              y="2.5"
              width="12"
              height="19"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.4"
            />

            <circle
              cx="15"
              cy="12"
              r="1.2"
              fill="currentColor"
            />
          </svg>
        </div>

        <h1 style={titleStyle}>
          Reset password
        </h1>

        <p style={subtitleStyle}>
          Choose a new password for your DeepFocus
          account.
        </p>

        <form onSubmit={handleSubmit}>

          <div style={groupStyle}>
            <label
              htmlFor="new-password"
              style={labelStyle}
            >
              New password
            </label>

            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Enter your new password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              style={inputStyle}
            />
          </div>

          <div style={groupStyle}>
            <label
              htmlFor="confirm-password"
              style={labelStyle}
            >
              Confirm new password
            </label>

            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
              placeholder="Re-enter your new password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={errorStyle}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={submitStyle}
          >
            {loading
              ? "Changing password..."
              : "Change Password"}
          </button>

        </form>

      </div>
    </div>
  );
}

export default ResetPassword;