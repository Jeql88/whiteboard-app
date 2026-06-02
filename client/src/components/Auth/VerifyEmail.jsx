import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { useSession } from "../../lib/auth-client";
import AuthLayout from "./AuthLayout";

export default function VerifyEmail() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const loggedIn = !!session?.user;

  return (
    <AuthLayout
      title="Email verification"
      subtitle="Account email"
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
      <div className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-[var(--surface-text)] dark:bg-brand-600/15">
        ✓ Your email has been verified. You&apos;re all set!
      </div>
    </AuthLayout>
  );
}
