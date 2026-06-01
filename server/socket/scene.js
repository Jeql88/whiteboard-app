// Scene synchronization: element-level merge (not last-write-wins).
//
// Each board has one snapshot document in `scenes`. Clients emit their full
// element list, but we MERGE incoming elements with the stored ones by element
// id, keeping the higher Excalidraw `version` per id. This means concurrent
// edits to different elements both survive, and same-element conflicts resolve
// deterministically — instead of one client's whole scene clobbering another's.

const { ObjectId } = require("mongodb");
const { getCollections } = require("../db");

function sanitizeAppState(appState = {}) {
  return { viewBackgroundColor: appState.viewBackgroundColor || "#ffffff" };
}

// Merge two element arrays by id, keeping the higher version (tie-break on
// versionNonce). Deleted elements are kept as tombstones so deletions converge.
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

    // Merge with whatever is currently stored so a stale client can't drop
    // elements it never saw.
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

    // Broadcast the MERGED scene to everyone else so all clients converge on
    // the same authoritative set (not just the sender's view).
    socket.to(whiteboardId).emit("sceneUpdate", {
      elements: mergedElements,
      appState: cleanAppState,
      files: mergedFiles,
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
