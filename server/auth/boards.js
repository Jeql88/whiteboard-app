// Board access control. A user may access a board if they own it or are an
// editor. Boards are shared by link, so a guest holding the link is treated as
// an allowed viewer/editor (current product design) — but only for boards that
// actually exist. Unknown/invalid ids are denied.

const { ObjectId } = require("mongodb");
const { getCollections } = require("../db");

// Safe ObjectId: returns null instead of throwing on malformed input.
function toObjectId(id) {
  try {
    return new ObjectId(String(id));
  } catch {
    return null;
  }
}

// Resolve the board doc (or null). Centralizes the id guard.
async function getBoard(whiteboardId) {
  const _id = toObjectId(whiteboardId);
  if (!_id) return null;
  const { whiteboards } = getCollections();
  return whiteboards.findOne({ _id });
}

// Can this user access this board?
// - owner or editor → yes
// - guest (isGuest) holding the link → yes, if the board exists (link-shared)
// - otherwise → no
async function canAccessBoard(user, whiteboardId) {
  const board = await getBoard(whiteboardId);
  if (!board) return false;
  if (user?.isGuest) return true; // link-shared access
  const uid = user?.userId;
  if (!uid) return false;
  if (String(board.userId) === String(uid)) return true;
  if (Array.isArray(board.editors) && board.editors.map(String).includes(String(uid))) {
    return true;
  }
  return false;
}

module.exports = { canAccessBoard, getBoard, toObjectId };
