import { apiFetch } from "./config";

const AUTH = "/api/auth";

// Public endpoints (no token; a 401 here is a normal "bad credentials", not a
// session-expiry → don't trigger the redirect handler).
export function login(username, password) {
  return apiFetch(`${AUTH}/login`, { method: "POST", body: { username, password }, auth: false });
}

export function register(username, email, password) {
  return apiFetch(`${AUTH}/register`, { method: "POST", body: { username, email, password }, auth: false });
}

export function forgotPassword(email) {
  return apiFetch(`${AUTH}/forgot`, { method: "POST", body: { email }, auth: false });
}

export function resetPassword(id, token, password) {
  return apiFetch(`${AUTH}/reset`, { method: "POST", body: { id, token, password }, auth: false });
}

export function verifyEmail(id, token) {
  return apiFetch(`${AUTH}/verify`, { method: "POST", body: { id, token }, auth: false });
}

// Authenticated endpoints (a 401 means the session expired → redirect).
export function resendVerification() {
  return apiFetch(`${AUTH}/resend-verification`, { method: "POST", body: {} });
}

export function changePassword(currentPassword, newPassword) {
  return apiFetch(`${AUTH}/change-password`, {
    method: "POST",
    body: { currentPassword, newPassword },
  });
}

export function updateEmail(email) {
  return apiFetch(`${AUTH}/email`, { method: "POST", body: { email } });
}

export function getMe() {
  return apiFetch(`${AUTH}/me`);
}
