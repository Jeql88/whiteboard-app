import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { getMe, updateEmail, changePassword } from "../../api/auth";
import ThemeToggle from "../ThemeToggle";

const inputCls =
  "w-full rounded-lg border border-[var(--surface-border)] bg-transparent px-3 py-2.5 text-sm text-[var(--surface-text)] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Notice({ kind, children }) {
  if (!children) return null;
  const cls =
    kind === "error"
      ? "bg-red-50 text-red-600 dark:bg-red-500/10"
      : "bg-brand-50 text-[var(--surface-text)] dark:bg-brand-600/15";
  return <div className={`rounded-lg px-3 py-2 text-sm ${cls}`}>{children}</div>;
}

export default function AccountSettings() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState({});
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState({});

  useEffect(() => {
    getMe().then((me) => {
      if (me?.username) setUsername(me.username);
      if (me?.email) setEmail(me.email);
    });
  }, []);

  const saveEmail = async (e) => {
    e.preventDefault();
    setEmailMsg({});
    if (!EMAIL_RE.test(email)) return setEmailMsg({ error: "Enter a valid email" });
    const res = await updateEmail(email);
    setEmailMsg(res.success ? { ok: "Email updated" } : { error: res.error || "Failed" });
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPwMsg({});
    if (pw.next.length < 8) return setPwMsg({ error: "New password must be at least 8 characters" });
    if (pw.next !== pw.confirm) return setPwMsg({ error: "New passwords do not match" });
    const res = await changePassword(pw.current, pw.next);
    if (res.success) {
      setPwMsg({ ok: "Password changed" });
      setPw({ current: "", next: "", confirm: "" });
    } else {
      setPwMsg({ error: res.error || "Failed" });
    }
  };

  return (
    <div className="min-h-screen bg-[var(--surface-bg)]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--surface-border)] bg-[var(--surface-card)] px-6 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/whiteboards")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--surface-muted)] hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-600/15"
            title="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-bold text-[var(--surface-text)]">Account settings</h1>
        </div>
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-md space-y-6 px-6 py-8">
        <section className="rounded-card border border-[var(--surface-border)] bg-[var(--surface-card)] p-6">
          <p className="mb-4 text-sm text-[var(--surface-muted)]">
            Signed in as <strong className="text-[var(--surface-text)]">{username}</strong>
          </p>
          <form onSubmit={saveEmail} className="space-y-3">
            <label className="block text-sm font-semibold text-[var(--surface-text)]">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputCls}
            />
            <Notice kind="error">{emailMsg.error}</Notice>
            <Notice kind="ok">{emailMsg.ok}</Notice>
            <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              Save email
            </button>
          </form>
        </section>

        <section className="rounded-card border border-[var(--surface-border)] bg-[var(--surface-card)] p-6">
          <form onSubmit={savePassword} className="space-y-3">
            <label className="block text-sm font-semibold text-[var(--surface-text)]">
              Change password
            </label>
            <input
              type="password"
              value={pw.current}
              onChange={(e) => setPw({ ...pw, current: e.target.value })}
              placeholder="Current password"
              className={inputCls}
            />
            <input
              type="password"
              value={pw.next}
              onChange={(e) => setPw({ ...pw, next: e.target.value })}
              placeholder="New password (min 8 characters)"
              className={inputCls}
            />
            <input
              type="password"
              value={pw.confirm}
              onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              placeholder="Confirm new password"
              className={inputCls}
            />
            <Notice kind="error">{pwMsg.error}</Notice>
            <Notice kind="ok">{pwMsg.ok}</Notice>
            <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              Update password
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
