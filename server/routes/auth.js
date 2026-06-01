// Auth routes — mounted at /api/auth.

const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");
const { JWT_SECRET, CLIENT_ORIGIN } = require("../config");
const { getCollections } = require("../db");
const { authMiddleware } = require("../middleware/auth");
const { sendResetEmail, sendVerifyEmail } = require("../email");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PW = 8;
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function validPassword(pw) {
  return typeof pw === "string" && pw.length >= MIN_PW;
}

function signToken(user) {
  return jwt.sign(
    { userId: user._id, username: user.username },
    JWT_SECRET,
    { expiresIn: "1d" }
  );
}

// Generate + store a verification token and email a link.
// Returns { verifyUrl, delivered }. Never throws on a send failure — instead
// reports delivered:false so the caller can surface the link in-app (fallback
// for free email tiers that can't deliver to arbitrary recipients yet).
async function sendVerification(req, user) {
  const { users } = getCollections();
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = await bcrypt.hash(rawToken, 10);
  await users.updateOne(
    { _id: user._id },
    { $set: { verifyTokenHash: tokenHash, verifyTokenExp: Date.now() + VERIFY_TTL_MS } }
  );
  const base = CLIENT_ORIGIN || `${req.protocol}://${req.get("host")}`;
  const verifyUrl = `${base}/verify?id=${user._id}&token=${rawToken}`;
  let delivered = false;
  try {
    await sendVerifyEmail(user.email, verifyUrl);
    delivered = true;
  } catch (err) {
    console.error("[auth] verify-email send failed:", err.message);
  }
  return { verifyUrl, delivered };
}

router.post("/register", async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password) {
    return res.status(400).json({ error: "Username, email and password are required" });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "Please enter a valid email address" });
  }
  if (!validPassword(password)) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PW} characters` });
  }

  const { users } = getCollections();
  const normalizedEmail = email.toLowerCase().trim();
  if (await users.findOne({ username })) {
    return res.status(400).json({ error: "Username already taken" });
  }
  if (await users.findOne({ email: normalizedEmail })) {
    return res.status(400).json({ error: "Email already registered" });
  }
  const hash = await bcrypt.hash(password, 10);
  const result = await users.insertOne({
    username,
    email: normalizedEmail,
    password: hash,
    emailVerified: false,
  });
  const user = { _id: result.insertedId, username, email: normalizedEmail };

  // Soft verification: try to email the link; never block access. If delivery
  // fails (e.g. free email tier can't reach this recipient), return the link so
  // the UI can let the user verify directly.
  const { verifyUrl, delivered } = await sendVerification(req, user);

  // Auto-login: return a token so the user is signed in immediately.
  res.json({
    token: signToken(user),
    emailDelivered: delivered,
    verifyUrl: delivered ? undefined : verifyUrl,
  });
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  const { users } = getCollections();
  const user = await users.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  res.json({ token: signToken(user) });
});

// Request a password reset. Always responds 200 so we don't reveal which
// emails exist.
router.post("/forgot", async (req, res) => {
  const { email } = req.body || {};
  res.json({ success: true }); // respond immediately, regardless

  if (!email || !EMAIL_RE.test(email)) return;
  try {
    const { users } = getCollections();
    const user = await users.findOne({ email: email.toLowerCase().trim() });
    if (!user) return;

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = await bcrypt.hash(rawToken, 10);
    await users.updateOne(
      { _id: user._id },
      { $set: { resetTokenHash: tokenHash, resetTokenExp: Date.now() + RESET_TTL_MS } }
    );

    const base = CLIENT_ORIGIN || `${req.protocol}://${req.get("host")}`;
    const resetUrl = `${base}/reset?id=${user._id}&token=${rawToken}`;
    await sendResetEmail(user.email, resetUrl);
  } catch (err) {
    console.error("[auth] forgot-password error:", err.message);
  }
});

// Complete a reset with the emailed token.
router.post("/reset", async (req, res) => {
  const { id, token, password } = req.body || {};
  if (!id || !token || !validPassword(password)) {
    return res.status(400).json({ error: `Invalid request or password too short (min ${MIN_PW})` });
  }
  try {
    const { users } = getCollections();
    const user = await users.findOne({ _id: new ObjectId(id) });
    if (
      !user ||
      !user.resetTokenHash ||
      !user.resetTokenExp ||
      user.resetTokenExp < Date.now()
    ) {
      return res.status(400).json({ error: "Reset link is invalid or expired" });
    }
    if (!(await bcrypt.compare(token, user.resetTokenHash))) {
      return res.status(400).json({ error: "Reset link is invalid or expired" });
    }
    const hash = await bcrypt.hash(password, 10);
    await users.updateOne(
      { _id: user._id },
      { $set: { password: hash }, $unset: { resetTokenHash: "", resetTokenExp: "" } }
    );
    res.json({ success: true });
  } catch {
    res.status(400).json({ error: "Reset link is invalid or expired" });
  }
});

// Change password while logged in.
router.post("/change-password", authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!validPassword(newPassword)) {
    return res.status(400).json({ error: `New password must be at least ${MIN_PW} characters` });
  }
  const { users } = getCollections();
  const user = await users.findOne({ _id: new ObjectId(req.user.userId) });
  if (!user || !(await bcrypt.compare(currentPassword || "", user.password))) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }
  const hash = await bcrypt.hash(newPassword, 10);
  await users.updateOne({ _id: user._id }, { $set: { password: hash } });
  res.json({ success: true });
});

// Current user's account info (for Account Settings + verify banner).
router.get("/me", authMiddleware, async (req, res) => {
  const { users } = getCollections();
  const user = await users.findOne({ _id: new ObjectId(req.user.userId) });
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json({
    username: user.username,
    email: user.email || "",
    emailVerified: !!user.emailVerified,
  });
});

// Confirm an email-verification token (from the emailed link).
router.post("/verify", async (req, res) => {
  const { id, token } = req.body || {};
  if (!id || !token) return res.status(400).json({ error: "Invalid request" });
  try {
    const { users } = getCollections();
    const user = await users.findOne({ _id: new ObjectId(id) });
    if (user?.emailVerified) return res.json({ success: true }); // idempotent
    if (
      !user ||
      !user.verifyTokenHash ||
      !user.verifyTokenExp ||
      user.verifyTokenExp < Date.now() ||
      !(await bcrypt.compare(token, user.verifyTokenHash))
    ) {
      return res.status(400).json({ error: "Verification link is invalid or expired" });
    }
    await users.updateOne(
      { _id: user._id },
      { $set: { emailVerified: true }, $unset: { verifyTokenHash: "", verifyTokenExp: "" } }
    );
    res.json({ success: true });
  } catch {
    res.status(400).json({ error: "Verification link is invalid or expired" });
  }
});

// Re-send the verification email to the logged-in user.
router.post("/resend-verification", authMiddleware, async (req, res) => {
  const { users } = getCollections();
  const user = await users.findOne({ _id: new ObjectId(req.user.userId) });
  if (!user) return res.status(404).json({ error: "Not found" });
  if (user.emailVerified) return res.json({ success: true });
  if (!user.email) return res.status(400).json({ error: "No email on file" });
  const { verifyUrl, delivered } = await sendVerification(req, user);
  res.json({
    success: true,
    emailDelivered: delivered,
    verifyUrl: delivered ? undefined : verifyUrl,
  });
});

// Set/update the email on the account. Changing it resets verification.
router.post("/email", authMiddleware, async (req, res) => {
  const { email } = req.body || {};
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "Please enter a valid email address" });
  }
  const { users } = getCollections();
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await users.findOne({ email: normalizedEmail });
  if (existing && String(existing._id) !== String(req.user.userId)) {
    return res.status(400).json({ error: "Email already in use" });
  }
  await users.updateOne(
    { _id: new ObjectId(req.user.userId) },
    { $set: { email: normalizedEmail, emailVerified: false } }
  );
  const user = await users.findOne({ _id: new ObjectId(req.user.userId) });
  const { verifyUrl, delivered } = await sendVerification(req, user);
  res.json({
    success: true,
    emailDelivered: delivered,
    verifyUrl: delivered ? undefined : verifyUrl,
  });
});

module.exports = router;
