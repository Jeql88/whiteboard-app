// Concurrent-edit merge test. A and B each draw a DIFFERENT element at nearly
// the same time; a fresh client C must then see BOTH (proves no data loss).
// Also tests same-id conflict converging to the higher version.
const { io } = require("socket.io-client");
const URL = "http://localhost:4000";
const BOARD = process.argv[2];

const elA = { id: "A1", type: "rectangle", x: 10, y: 10, width: 50, height: 50, version: 1, versionNonce: 111 };
const elB = { id: "B1", type: "ellipse", x: 90, y: 90, width: 40, height: 40, version: 1, versionNonce: 222 };

const A = io(URL, { transports: ["websocket"] });
const B = io(URL, { transports: ["websocket"] });

let ready = 0;
const go = () => {
  if (++ready < 2) return;
  // A and B emit different elements ~simultaneously, each only knowing its own.
  setTimeout(() => A.emit("sceneUpdate", { whiteboardId: BOARD, elements: [elA], appState: {}, files: {} }), 50);
  setTimeout(() => B.emit("sceneUpdate", { whiteboardId: BOARD, elements: [elB], appState: {}, files: {} }), 60);

  // Then a same-id conflict: A sends A1 v2, B sends A1 v1 (older) — v2 must win.
  setTimeout(() => A.emit("sceneUpdate", { whiteboardId: BOARD, elements: [{ ...elA, x: 999, version: 2, versionNonce: 333 }], appState: {}, files: {} }), 700);
  setTimeout(() => B.emit("sceneUpdate", { whiteboardId: BOARD, elements: [{ ...elA, x: 5, version: 1, versionNonce: 999 }], appState: {}, files: {} }), 720);

  // Fresh client joins after dust settles → reads persisted/merged scene.
  setTimeout(() => {
    const C = io(URL, { transports: ["websocket"] });
    C.on("sceneInit", (scene) => {
      const ids = (scene?.elements || []).map((e) => e.id).sort();
      const a1 = (scene?.elements || []).find((e) => e.id === "A1");
      const hasBoth = ids.includes("A1") && ids.includes("B1");
      const conflictResolved = a1 && a1.version === 2 && a1.x === 999;
      console.log("elements seen by fresh client:", ids);
      console.log((hasBoth ? "PASS" : "FAIL") + " both concurrent elements survived (no data loss)");
      console.log((conflictResolved ? "PASS" : "FAIL") + " same-id conflict resolved to higher version");
      [A, B, C].forEach((s) => s.disconnect());
      process.exit(hasBoth && conflictResolved ? 0 : 1);
    });
    C.on("connect", () => C.emit("joinWhiteboard", BOARD));
  }, 1500);
};
A.on("connect", () => { A.emit("joinWhiteboard", BOARD); go(); });
B.on("connect", () => { B.emit("joinWhiteboard", BOARD); go(); });
setTimeout(() => { console.log("TIMEOUT"); process.exit(1); }, 15000);
