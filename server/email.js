// Thin email sender. Uses Resend when RESEND_API_KEY is set; otherwise logs the
// message to the console so the password-reset flow works in dev without a key.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MAIL_FROM = process.env.MAIL_FROM || "onboarding@resend.dev";

let resendClient = null;
if (RESEND_API_KEY) {
  try {
    const { Resend } = require("resend");
    resendClient = new Resend(RESEND_API_KEY);
  } catch (err) {
    console.warn("[email] 'resend' package not available:", err.message);
  }
}

async function sendMail({ to, subject, html, text }) {
  if (!resendClient) {
    // Dev fallback — surface the content (incl. any reset link) in the logs.
    console.log("\n[email:dev] (no RESEND_API_KEY set — not actually sending)");
    console.log(`[email:dev] To: ${to}`);
    console.log(`[email:dev] Subject: ${subject}`);
    console.log(`[email:dev] ${text || html}\n`);
    return { dev: true };
  }
  // The Resend SDK returns { data, error } rather than throwing on API errors,
  // so we must inspect `error` explicitly or failures are silent.
  const { data, error } = await resendClient.emails.send({
    from: MAIL_FROM,
    to,
    subject,
    html,
    text,
  });
  if (error) {
    console.error(`[email] Resend rejected send to ${to}:`, error);
    const err = new Error(error.message || "Email send failed");
    err.resend = error;
    throw err;
  }
  console.log(`[email] sent to ${to} (id: ${data?.id})`);
  return data;
}

async function sendResetEmail(to, resetUrl) {
  return sendMail({
    to,
    subject: "Reset your Whitebored password",
    text: `Reset your password using this link (valid for 1 hour):\n\n${resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto">
        <h2>Reset your password</h2>
        <p>Click the button below to choose a new password. This link is valid for 1 hour.</p>
        <p><a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Reset password</a></p>
        <p style="color:#64748b;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
      </div>`,
  });
}

async function sendVerifyEmail(to, verifyUrl) {
  return sendMail({
    to,
    subject: "Verify your Whitebored email",
    text: `Welcome! Confirm your email address to finish setting up your account:\n\n${verifyUrl}\n\nIf you didn't sign up, you can ignore this email.`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto">
        <h2>Confirm your email</h2>
        <p>Welcome to Whitebored! Click below to verify your email address.</p>
        <p><a href="${verifyUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Verify email</a></p>
        <p style="color:#64748b;font-size:13px">If you didn't sign up, you can safely ignore this email.</p>
      </div>`,
  });
}

module.exports = { sendMail, sendResetEmail, sendVerifyEmail };
