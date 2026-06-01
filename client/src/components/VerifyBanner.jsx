import { useEffect, useState } from "react";
import { MailWarning, X } from "lucide-react";
import { getMe, resendVerification } from "../api/auth";

// Dismissible "please verify your email" banner. Soft verification: nothing is
// blocked; this is just a reminder shown while emailVerified is false.
export default function VerifyBanner() {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [resent, setResent] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState("");

  useEffect(() => {
    if (sessionStorage.getItem("verifyBannerDismissed") === "1") return;
    getMe()
      .then((me) => {
        if (me && me.email && me.emailVerified === false) {
          setEmail(me.email);
          setShow(true);
        }
      })
      .catch(() => {});
  }, []);

  if (!show) return null;

  const dismiss = () => {
    sessionStorage.setItem("verifyBannerDismissed", "1");
    setShow(false);
  };

  const resend = async () => {
    const res = await resendVerification();
    setResent(true);
    // If the email couldn't be delivered (free tier / unverified domain), the
    // server returns the link so the user can verify directly.
    if (res && res.emailDelivered === false && res.verifyUrl) {
      setFallbackUrl(res.verifyUrl);
    }
  };

  return (
    <div className="flex items-center gap-3 border-b border-amber-300/60 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <MailWarning size={16} className="shrink-0" />
      <span className="flex-1">
        {fallbackUrl ? (
          <>
            Couldn&apos;t email <strong>{email}</strong> on this plan.{" "}
            <a href={fallbackUrl} className="font-semibold underline">
              Click here to verify
            </a>
            .
          </>
        ) : resent ? (
          <>Verification email re-sent to <strong>{email}</strong>. Check your inbox.</>
        ) : (
          <>Please verify your email (<strong>{email}</strong>) to secure your account.</>
        )}
      </span>
      {!resent && (
        <button
          onClick={resend}
          className="rounded-md px-2 py-1 font-semibold underline-offset-2 hover:underline"
        >
          Resend email
        </button>
      )}
      <button onClick={dismiss} title="Dismiss" className="rounded-md p-1 hover:bg-amber-100 dark:hover:bg-amber-500/20">
        <X size={15} />
      </button>
    </div>
  );
}
