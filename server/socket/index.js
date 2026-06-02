// Socket.IO wiring: handshake auth, room join + scene hydration, then delegate
// to the scene and presence handler modules.

const { socketAuth } = require("../middleware/auth");
const { registerSceneHandlers, loadScene } = require("./scene");
const { registerPresenceHandlers, getChatHistory } = require("./presence");
const { canAccessBoard } = require("../auth/boards");

function initSocket(io) {
  io.use(socketAuth);

  io.on("connection", (socket) => {
    socket.on("joinWhiteboard", async (whiteboardId) => {
      if (!whiteboardId) return;

      // Authorization: only owner/editor (or a guest holding the link) may join
      // and receive the scene. Unknown/unauthorized → reject without joining.
      const allowed = await canAccessBoard(socket.user, whiteboardId).catch(
        () => false
      );
      if (!allowed) {
        socket.emit("accessDenied", { whiteboardId });
        return;
      }

      socket.join(whiteboardId);
      socket.whiteboardId = whiteboardId;

      // Hydrate this socket with the stored snapshot (or null for a new board).
      try {
        const scene = await loadScene(whiteboardId);
        socket.emit("sceneInit", scene);
      } catch (err) {
        console.error("[socket] sceneInit failed:", err.message);
        socket.emit("sceneInit", null);
      }

      // Send the in-memory chat history for this session so a reload/reopen
      // sees prior messages.
      socket.emit("chatHistory", getChatHistory(whiteboardId));
    });

    registerSceneHandlers(io, socket);
    registerPresenceHandlers(io, socket);
  });
}

module.exports = { initSocket };
