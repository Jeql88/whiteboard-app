import { API_BASE } from "./config";

const AUTH = `${API_BASE}/api/auth`;

function authHeaders(extra = {}) {
  const token = localStorage.getItem("token");
  return { Authorization: `Bearer ${token}`, ...extra };
}

async function postJson(path, body, headers = {}) {
  // Render's free tier sleeps after inactivity; the first request can take
  // ~30-60s to wake. Use a generous timeout so the UI can show a clear error
  // instead of hanging forever, and tolerate non-JSON error responses (e.g.
  // a 502/503 HTML page returned while the server is still starting up).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(`${AUTH}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: `Server error (${res.status}). Please try again.` };
    }
    if (!res.ok && !data.error) {
      data.error = `Request failed (${res.status})`;
    }
    return data;
  } catch (err) {
    if (err.name === "AbortError") {
      return {
        error:
          "The server took too long to respond (it may be waking up). Please try again in a moment.",
      };
    }
    return { error: "Network error. Please check your connection and retry." };
  } finally {
    clearTimeout(timer);
  }
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
