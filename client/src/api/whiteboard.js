import { API_BASE } from "./config";

const WB = `${API_BASE}/api/whiteboards`;

function authHeaders(extra = {}) {
  const token = localStorage.getItem("token");
  return { Authorization: `Bearer ${token}`, ...extra };
}

export async function getWhiteboards() {
  const res = await fetch(WB, { headers: authHeaders() });
  return res.json();
}

export async function getActiveBoards() {
  try {
    const res = await fetch(`${WB}/active`, { headers: authHeaders() });
    const data = await res.json();
    return Array.isArray(data.active) ? data.active : [];
  } catch {
    return [];
  }
}

export async function createWhiteboard(name) {
  const res = await fetch(WB, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ name }),
  });
  return res.json();
}

export async function deleteWhiteboard(id) {
  const res = await fetch(`${WB}/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return res.json();
}

export async function updateWhiteboard(id, name) {
  const res = await fetch(`${WB}/${id}`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to rename: ${res.status} - ${errorText}`);
  }
  return res.json();
}

export async function saveThumbnail(id, thumbnail) {
  try {
    await fetch(`${WB}/${id}/thumbnail`, {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ thumbnail }),
    });
  } catch {
    /* best-effort; thumbnail is non-critical */
  }
}

export async function getComments(whiteboardId) {
  const res = await fetch(`${WB}/${whiteboardId}/comments`, {
    headers: authHeaders(),
  });
  return res.json();
}

export async function addComment(whiteboardId, text) {
  const res = await fetch(`${WB}/${whiteboardId}/comments`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ text }),
  });
  return res.json();
}

export async function deleteComment(whiteboardId, commentId) {
  const res = await fetch(`${WB}/${whiteboardId}/comments/${commentId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return res.json();
}
