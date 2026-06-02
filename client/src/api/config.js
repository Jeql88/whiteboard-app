// Base URL for the API + Socket.IO connection.
// Production: same-origin monolith → window.location.origin.
// Development: Vite proxies /api and /socket.io to the node server.
export const API_BASE =
  import.meta.env.VITE_API_BASE ?? window.location.origin;

// Clerk token getter — set by ClerkProvider in main.jsx via setClerkTokenGetter().
let _getToken = () => Promise.resolve(null);
export function setClerkTokenGetter(fn) {
  _getToken = fn;
}

let redirecting = false;
function handleUnauthorized() {
  if (redirecting) return;
  redirecting = true;
  if (!location.pathname.startsWith("/sign-in")) {
    window.location.assign("/sign-in");
  }
}

export async function apiFetch(path, { method = "GET", body, auth = true, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  const h = { ...headers };
  if (body !== undefined) h["Content-Type"] = "application/json";
  if (auth) {
    const token = await _getToken();
    if (token) h.Authorization = `Bearer ${token}`;
  }
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: h,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (res.status === 401 && auth) {
      handleUnauthorized();
      return { error: "Session expired. Please sign in again." };
    }
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: `Server error (${res.status}).` };
    }
    if (!res.ok && !data.error) data.error = `Request failed (${res.status})`;
    return data;
  } catch (err) {
    if (err.name === "AbortError") {
      return { error: "The server took too long (it may be waking up). Try again." };
    }
    return { error: "Network error. Check your connection and retry." };
  } finally {
    clearTimeout(timer);
  }
}
