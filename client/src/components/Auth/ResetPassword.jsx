import React, { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { resetPassword } from "../../api/auth";
import AuthLayout from "./AuthLayout";

const inputCls =
  "w-full rounded-lg border border-[var(--surface-border)] bg-transparent px-3 py-2.5 text-sm text-[var(--surface-text)] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const id = params.get("id");
  const token = params.get("token");
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const invalidLink = !id || !token;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Password must be at least 8 characters");
    if (password !== confirm) return setError("Passwords do not match");

    setLoading(true);
    try {
      const res = await resetPassword(id, token, password);
      if (res.success) {
        setDone(true);
        setTimeout(() => navigate("/login"), 1500);
      } else {
        setError(res.error || "Could not reset password");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Enter and confirm your new password"
      footer={
        <Link to="/login" className="font-semibold text-brand-600 hover:underline">
          Back to login
        </Link>
      }
    >
      {invalidLink ? (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/10">
          This reset link is missing information. Request a new one from the
          login page.
        </div>
      ) : done ? (
        <div className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-[var(--surface-text)] dark:bg-brand-600/15">
          Password updated. Redirecting to login…
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password (min 8 characters)"
            required
            className={inputCls}
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm new password"
            required
            className={inputCls}
          />
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
