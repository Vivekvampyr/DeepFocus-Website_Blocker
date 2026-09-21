import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../api/client";

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [loading, setLoading] = useState(false);


  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");


    if (!token) {
      setError("This password reset link is invalid.");
      return;
    }


    if (password.length < 8) {
      setError(
        "Password must be at least 8 characters."
      );
      return;
    }


    if (password.length > 128) {
      setError(
        "Password must be 128 characters or less."
      );
      return;
    }


    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }


    setLoading(true);


    try {
      const response = await api.post(
        "/api/auth/reset-password",
        {
          token,
          new_password: password,
        }
      );

      setSuccess(
        response.data?.message ||
          "Password reset successfully."
      );

      setPassword("");
      setConfirmPassword("");

    } catch (err) {
      console.error(
        "Password reset failed:",
        err
      );

      setError(
        err.response?.data?.detail ||
          "Unable to reset your password."
      );

    } finally {
      setLoading(false);
    }
  }


  return (
    <main className="auth-container">

      <div className="brand">

        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
        >
          <rect
            x="4"
            y="2"
            width="14"
            height="20"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.4"
          />

          <circle
            cx="14.5"
            cy="12"
            r="1.3"
            fill="currentColor"
          />
        </svg>

        <h1>Reset password</h1>

        <p>
          Choose a new password for your
          DeepFocus account.
        </p>

      </div>


      {!success ? (
        <form
          onSubmit={handleSubmit}
          className="auth-form"
        >

          <label htmlFor="password">
            New password
          </label>

          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            placeholder="••••••••"
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            required
          />


          <label htmlFor="confirm-password">
            Confirm password
          </label>

          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) =>
              setConfirmPassword(event.target.value)
            }
            placeholder="••••••••"
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            required
          />


          {error && (
            <p className="dashboard-error">
              {error}
            </p>
          )}


          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Resetting..."
              : "Reset Password"}
          </button>

        </form>
      ) : (
        <div className="auth-form">

          <p className="dashboard-success">
            {success}
          </p>

          <button
            type="button"
            onClick={() =>
              navigate("/admin/login")
            }
          >
            Go to Login
          </button>

        </div>
      )}

    </main>
  );
}


export default ResetPassword;