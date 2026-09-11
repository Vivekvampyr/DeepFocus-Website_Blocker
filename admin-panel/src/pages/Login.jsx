import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { setAuthToken } from "../api/client";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const loginResponse = await api.post("/api/auth/login", {
        email: email.trim(),
        password,
      });

      const token = loginResponse.data.access_token;

      // Save token for future requests.
      localStorage.setItem("admin_token", token);

      setAuthToken(token);

      // Verify account identity and role.
      const meResponse = await api.get("/api/auth/me");

      const user = meResponse.data;

      if (user.role !== "ADMIN") {
        localStorage.removeItem("admin_token");
        setAuthToken(null);

        setError("You do not have administrator access.");
        return;
      }

      localStorage.setItem(
        "admin_user",
        JSON.stringify(user)
      );

      navigate("/admin/dashboard", {
        replace: true,
      });

    } catch (err) {
      console.error("Admin login failed:", err);

      const message =
        err.response?.data?.detail ||
        "Unable to login. Please check your credentials.";

      setError(
        typeof message === "string"
          ? message
          : "Unable to login."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">

        <div className="login-brand">
          <h1>DeepFocus</h1>
          <p>Administration</p>
        </div>

        <form onSubmit={handleSubmit}>

          <div className="form-group">
            <label htmlFor="email">
              Email
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="admin@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              Password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

        </form>

      </div>
    </div>
  );
}

export default Login;