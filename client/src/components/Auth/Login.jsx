import React, { useState } from "react";
import { Link } from "react-router-dom";
import { login } from "../../api/auth";
import AuthLayout from "./AuthLayout";

const inputCls =
  "w-full rounded-lg border border-[var(--surface-border)] bg-transparent px-3 py-2.5 text-sm text-[var(--surface-text)] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await login(username, password);
      if (res.token) {
        localStorage.setItem("token", res.token);
        // Full navigation so App re-reads the token from localStorage and the
        // authed routes render reliably (matches Register's behavior).
        window.location.assign("/whiteboards");
      } else {
        setError(res.error || "Login failed");
        setLoading(false);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to Whitebored"
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link to="/register" className="font-semibold text-brand-600 hover:underline">
            Register
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          required
          className={inputCls}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          className={inputCls}
        />
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10">
            {error}
          </div>
        )}
        <div className="text-right">
          <Link
            to="/forgot"
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Login"}
        </button>
      </form>
    </AuthLayout>
  );
}
