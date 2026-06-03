// Socket.IO wiring: handshake auth, room join + scene hydration, then delegate
// to the scene and presence handler modules.

const { socketAuth } = require("../middleware/auth");
const { registerSceneHandlers, loadScene } = require("./scene");
const { registerPresenceHandlers, getChatHistory } = require("./presence");
const { canAccessBoard, getBoard } = require("../auth/boards");

function initSocket(io) {
  io.use(socketAuth);

  io.on("connection", (socket) => {
    socket.on("joinWhiteboard", async (whiteboardId) => {
      if (!whiteboardId) return;

      const { allowed, shareMode } = await canAccessBoard(socket.user, whiteboardId).catch(
        () => ({ allowed: false, shareMode: "edit" })
      );

      if (!allowed) {
        // Tell guest that auth is required for this board.
        socket.emit("accessDenied", {
          whiteboardId,
          reason: socket.user?.isGuest ? "auth_required" : "forbidden",
        });
        return;
      }

      // Attach shareMode to socket so scene handler can enforce view-only.
      socket.shareMode = shareMode;

      socket.join(whiteboardId);
      socket.whiteboardId = whiteboardId;

      // Hydrate this socket with the stored snapshot (or null for a new board).
      try {
        const scene = await loadScene(whiteboardId);
        socket.emit("sceneInit", { ...(scene || {}), shareMode });
      } catch (err) {
        console.error("[socket] sceneInit failed:", err.message);
        socket.emit("sceneInit", { shareMode });
      }

      socket.emit("chatHistory", getChatHistory(whiteboardId));
    });

    // Owner can change shareMode live — verify ownership before broadcasting.
    socket.on("shareModeChanged", async ({ whiteboardId, shareMode }) => {
      if (!whiteboardId || !socket.rooms.has(whiteboardId)) return;
      if (!["edit", "view"].includes(shareMode)) return;
      const board = await getBoard(whiteboardId).catch(() => null);
      if (!board || String(board.userId) !== String(socket.user?.userId)) return;
      socket.shareMode = shareMode;
      socket.to(whiteboardId).emit("shareModeChanged", { shareMode });
    });

    registerSceneHandlers(io, socket);
    registerPresenceHandlers(io, socket);
  });
}

module.exports = { initSocket };
