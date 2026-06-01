import { API_BASE } from "./config";

const AUTH = `${API_BASE}/api/auth`;

function authHeaders(extra = {}) {
  const token = localStorage.getItem("token");
  return { Authorization: `Bearer ${token}`, ...extra };
}

async function postJson(path, body, headers = {}) {
  const res = await fetch(`${AUTH}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return res.json();
}

export function login(username, password) {
  return postJson("/login", { username, password });
}

export function register(username, email, password) {
  return postJson("/register", { username, email, password });
}

export function forgotPassword(email) {
  return postJson("/forgot", { email });
}

export function resetPassword(id, token, password) {
  return postJson("/reset", { id, token, password });
}

export function verifyEmail(id, token) {
  return postJson("/verify", { id, token });
}

export function resendVerification() {
  return postJson("/resend-verification", {}, authHeaders());
}

export function changePassword(currentPassword, newPassword) {
  return postJson("/change-password", { currentPassword, newPassword }, authHeaders());
}

export function updateEmail(email) {
  return postJson("/email", { email }, authHeaders());
}

export async function getMe() {
  const res = await fetch(`${AUTH}/me`, { headers: authHeaders() });
  return res.json();
}
