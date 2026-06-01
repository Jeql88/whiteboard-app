import React, { useEffect, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { verifyEmail } from "../../api/auth";
import AuthLayout from "./AuthLayout";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const id = params.get("id");
  const token = params.get("token");
  const [status, setStatus] = useState("verifying"); // verifying | ok | error

  useEffect(() => {
    if (!id || !token) {
      setStatus("error");
      return;
    }
    verifyEmail(id, token)
      .then((res) => setStatus(res.success ? "ok" : "error"))
      .catch(() => setStatus("error"));
  }, [id, token]);

  const loggedIn = !!localStorage.getItem("token");

  return (
    <AuthLayout
      title="Email verification"
      subtitle={
        status === "verifying" ? "Confirming your email…" : "Account email"
      }
      footer={
        loggedIn ? (
          <button
            onClick={() => navigate("/whiteboards")}
            className="font-semibold text-brand-600 hover:underline"
          >
            Go to your boards
          </button>
        ) : (
          <Link to="/login" className="font-semibold text-brand-600 hover:underline">
            Continue to login
          </Link>
        )
      }
    >
      {status === "verifying" && (
        <div className="text-sm text-[var(--surface-muted)]">Please wait…</div>
      )}
      {status === "ok" && (
        <div className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-[var(--surface-text)] dark:bg-brand-600/15">
          ✓ Your email is verified. You're all set!
        </div>
      )}
      {status === "error" && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/10">
          This verification link is invalid or has expired. You can request a new
          one from your account settings.
        </div>
      )}
    </AuthLayout>
  );
}
