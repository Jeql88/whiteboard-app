// Scene synchronization: element-level merge, serialized per board.
//
// Each board has one snapshot document in `scenes`. Clients emit their full
// element list; we MERGE by element id keeping the higher Excalidraw `version`
// (deletions included — a deleted element with a higher version wins, so
// deletions stick and don't "come back"). The read-merge-write is serialized
// per board with an in-process lock so concurrent updates can't lose the higher
// version via a race (valid on a single instance; would need Redis to scale).

const { ObjectId } = require("mongodb");
const { getCollections } = require("../db");

function sanitizeAppState(appState = {}) {
  return { viewBackgroundColor: appState.viewBackgroundColor || "#ffffff" };
}

// Merge by id, higher version wins (tie-break versionNonce). Deleted elements
// are kept as tombstones so a delete propagates and persists.
function mergeElements(existing = [], incoming = []) {
  const byId = new Map();
  for (const el of existing) if (el && el.id) byId.set(el.id, el);
  for (const el of incoming) {
    if (!el || !el.id) continue;
    const prev = byId.get(el.id);
    if (!prev) {
      byId.set(el.id, el);
      continue;
    }
    const pv = prev.version ?? 0;
    const nv = el.version ?? 0;
    if (nv > pv || (nv === pv && (el.versionNonce ?? 0) > (prev.versionNonce ?? 0))) {
      byId.set(el.id, el);
    }
  }
  return Array.from(byId.values());
}

// --- Per-board serialization (in-process mutex) ---
const boardLocks = new Map(); // whiteboardId -> Promise chain tail
function withBoardLock(whiteboardId, task) {
  const prev = boardLocks.get(whiteboardId) || Promise.resolve();
  const next = prev.then(task, task); // run task regardless of prior outcome
  // Keep the chain but don't let rejections break future tasks.
  boardLocks.set(
    whiteboardId,
    next.catch(() => {})
  );
  return next;
}

async function loadScene(whiteboardId) {
  const { scenes } = getCollections();
  const doc = await scenes.findOne({ whiteboardId });
  if (!doc) return null;
  return {
    elements: doc.elements || [],
    appState: sanitizeAppState(doc.appState),
    files: doc.files || {},
  };
}

function registerSceneHandlers(io, socket) {
  const { scenes, whiteboards } = getCollections();

  socket.on("sceneUpdate", async ({ whiteboardId, elements, appState, files }) => {
    if (!whiteboardId) return;
    const cleanAppState = sanitizeAppState(appState);
    const userId = socket.user.userId;

    const merged = await withBoardLock(whiteboardId, async () => {
      const existing = await scenes.findOne({ whiteboardId });
      const mergedElements = mergeElements(existing?.elements, elements || []);
      const mergedFiles = { ...(existing?.files || {}), ...(files || {}) };
      await scenes.updateOne(
        { whiteboardId },
        {
          $set: {
            whiteboardId,
            elements: mergedElements,
            appState: cleanAppState,
            files: mergedFiles,
            updatedAt: new Date(),
            updatedBy: userId,
          },
        },
        { upsert: true }
      );
      return { elements: mergedElements, files: mergedFiles };
    });

    // Broadcast the MERGED scene so all clients converge on the same set.
    socket.to(whiteboardId).emit("sceneUpdate", {
      elements: merged.elements,
      appState: cleanAppState,
      files: merged.files,
    });

    try {
      await whiteboards.updateOne(
        { _id: new ObjectId(whiteboardId) },
        { $set: { updatedAt: new Date() }, $addToSet: { editors: userId } }
      );
    } catch {
      // whiteboardId may not be a valid ObjectId for ad-hoc/guest boards.
    }
  });
}

module.exports = { registerSceneHandlers, loadScene, mergeElements };
