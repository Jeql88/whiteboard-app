import { useEffect, useRef, useState } from "react";

// A lightweight minimap that mirrors the old whiteboard's map. It reads the
// live Excalidraw scene + viewport and draws a scaled overview with a rectangle
// showing what's currently visible. Click/drag to recenter.
//
// Excalidraw is an infinite canvas, so the "world" we map is the bounding box
// of all elements unioned with the current viewport, padded a little.
//
// NOTE: the container is ALWAYS rendered (so the canvas ref exists); we only
// fade it out when the board is empty. Returning null while empty would mean
// the canvas never mounts, so the draw loop could never detect content.

const W = 200;
const H = 140;
const PAD = 80; // world padding around content (scene units)

export default function Minimap({ apiRef }) {
  const canvasRef = useRef(null);
  const worldRef = useRef(null); // last computed world transform, for click mapping
  const [hasContent, setHasContent] = useState(false);

  useEffect(() => {
    let raf;
    let stop = false;
    let last = 0;

    const draw = () => {
      const api = apiRef.current;
      const canvas = canvasRef.current;
      if (!api || !canvas) return;

      const elements = api
        .getSceneElements()
        .filter((el) => !el.isDeleted && el.width != null && el.height != null);
      const app = api.getAppState();

      setHasContent(elements.length > 0);

      // Viewport rect in scene coords.
      const zoom = app.zoom?.value || 1;
      const vw = (app.width || window.innerWidth) / zoom;
      const vh = (app.height || window.innerHeight) / zoom;
      const vx = -app.scrollX;
      const vy = -app.scrollY;

      // World bounds = union of element bbox and viewport, padded.
      let minX = vx,
        minY = vy,
        maxX = vx + vw,
        maxY = vy + vh;
      for (const el of elements) {
        minX = Math.min(minX, el.x);
        minY = Math.min(minY, el.y);
        maxX = Math.max(maxX, el.x + el.width);
        maxY = Math.max(maxY, el.y + el.height);
      }
      minX -= PAD;
      minY -= PAD;
      maxX += PAD;
      maxY += PAD;

      const worldW = Math.max(maxX - minX, 1);
      const worldH = Math.max(maxY - minY, 1);
      const scale = Math.min(W / worldW, H / worldH);
      const offX = (W - worldW * scale) / 2;
      const offY = (H - worldH * scale) / 2;
      const toMap = (x, y) => [offX + (x - minX) * scale, offY + (y - minY) * scale];
      worldRef.current = { minX, minY, scale, offX, offY };

      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== W * dpr) {
        canvas.width = W * dpr;
        canvas.height = H * dpr;
      }
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // The minimap mirrors the board surface, which is light (its
      // viewBackgroundColor is white). Keep it light even in dark UI mode so the
      // user's strokes — typically dark — stay clearly visible. We only theme
      // the surrounding chrome (border/shadow via the container), not the map.
      const boardBg =
        (apiRef.current.getAppState().viewBackgroundColor) || "#ffffff";
      ctx.fillStyle = boardBg;
      ctx.fillRect(0, 0, W, H);

      // Draw each element in a way that reflects what it actually is, so the
      // map reads as a miniature of the board rather than a single grey blob.
      const fallbackStroke = "#475569";
      for (const el of elements) {
        const [mx, my] = toMap(el.x, el.y);
        const w = el.width * scale;
        const h = el.height * scale;
        ctx.strokeStyle = el.strokeColor && el.strokeColor !== "transparent"
          ? el.strokeColor
          : fallbackStroke;
        ctx.fillStyle = ctx.strokeStyle;
        ctx.lineWidth = 1;

        // Path-like elements: trace their actual points so freehand drawings
        // and lines look like themselves, not their bounding box.
        if (Array.isArray(el.points) && el.points.length > 1) {
          ctx.beginPath();
          el.points.forEach(([px, py], i) => {
            const X = mx + px * scale;
            const Y = my + py * scale;
            i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
          });
          ctx.stroke();
          continue;
        }

        switch (el.type) {
          case "ellipse":
            ctx.beginPath();
            ctx.ellipse(mx + w / 2, my + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
            ctx.stroke();
            break;
          case "diamond":
            ctx.beginPath();
            ctx.moveTo(mx + w / 2, my);
            ctx.lineTo(mx + w, my + h / 2);
            ctx.lineTo(mx + w / 2, my + h);
            ctx.lineTo(mx, my + h / 2);
            ctx.closePath();
            ctx.stroke();
            break;
          case "text":
          case "image":
            // Solid-ish block for content elements.
            ctx.globalAlpha = 0.5;
            ctx.fillRect(mx, my, Math.max(w, 1.5), Math.max(h, 1.5));
            ctx.globalAlpha = 1;
            break;
          default: // rectangle, frame, and anything else → outline
            ctx.strokeRect(mx, my, Math.max(w, 1.5), Math.max(h, 1.5));
        }
      }

      // Viewport rectangle.
      const [rx, ry] = toMap(vx, vy);
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rx, ry, vw * scale, vh * scale);
      ctx.fillStyle = "rgba(37,99,235,0.12)";
      ctx.fillRect(rx, ry, vw * scale, vh * scale);
    };

    // Throttle to ~6fps — the minimap doesn't need full frame rate.
    const loop = (t) => {
      if (stop) return;
      if (t - last > 160) {
        last = t;
        draw();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      stop = true;
      cancelAnimationFrame(raf);
    };
  }, [apiRef]);

  // Click/drag on the minimap → center the main canvas there.
  const navigateTo = (e) => {
    const api = apiRef.current;
    const world = worldRef.current;
    if (!api || !world || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const sceneX = world.minX + (mx - world.offX) / world.scale;
    const sceneY = world.minY + (my - world.offY) / world.scale;
    const app = api.getAppState();
    const zoom = app.zoom?.value || 1;
    const vw = (app.width || window.innerWidth) / zoom;
    const vh = (app.height || window.innerHeight) / zoom;
    api.updateScene({
      appState: { scrollX: -(sceneX - vw / 2), scrollY: -(sceneY - vh / 2) },
    });
  };

  return (
    <div
      className={`absolute bottom-4 right-4 z-20 hidden overflow-hidden rounded-lg border border-[var(--surface-border)] bg-[var(--surface-card)] shadow-lg transition-opacity duration-300 sm:block ${
        hasContent ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <canvas
        ref={canvasRef}
        style={{ width: W, height: H, display: "block", cursor: "pointer" }}
        onMouseDown={(e) => {
          navigateTo(e);
          const move = (ev) => navigateTo(ev);
          const up = () => {
            window.removeEventListener("mousemove", move);
            window.removeEventListener("mouseup", up);
          };
          window.addEventListener("mousemove", move);
          window.addEventListener("mouseup", up);
        }}
        title="Minimap — click to navigate"
      />
    </div>
  );
}
