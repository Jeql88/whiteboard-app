// Handwriting OCR via Google Cloud Vision (DOCUMENT_TEXT_DETECTION).
// On-demand: the client posts a PNG/JPEG of the board; we extract text and
// merge it into the board's searchable textIndex. The Vision key stays
// server-side. Degrades gracefully when GOOGLE_VISION_KEY is unset.

const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const { rateLimit } = require("../middleware/rateLimit");
const { getCollections } = require("../db");
const { canAccessBoard, toObjectId } = require("../auth/boards");
const { GOOGLE_VISION_KEY } = require("../config");

const VISION_URL = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_KEY}`;

// Per-user cap to stay within Google's free 1k/month tier.
const ocrLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 30,
  key: (req) => req.user?.userId || req.ip,
});

module.exports = function ocrRoutes() {
  const router = express.Router();

  router.post("/:id/ocr", authMiddleware, ocrLimiter, async (req, res) => {
    if (!GOOGLE_VISION_KEY) {
      return res.status(503).json({ error: "OCR is not configured on this server." });
    }
    const { allowed } = await canAccessBoard(req.user, req.params.id).catch(() => ({ allowed: false }));
    if (!allowed) return res.status(403).json({ error: "Not authorized for this board" });

    const { image } = req.body || {};
    if (typeof image !== "string" || !image) {
      return res.status(400).json({ error: "Missing image" });
    }
    // Accept a data URL or raw base64; strip the data: prefix.
    const base64 = image.includes(",") ? image.split(",")[1] : image;
    if (base64.length > 8_000_000) {
      return res.status(413).json({ error: "Image too large" });
    }

    let text = "";
    try {
      const resp = await fetch(VISION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64 },
              features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            },
          ],
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        console.error("[ocr] Vision error:", data?.error?.message);
        return res.status(502).json({ error: "OCR service error" });
      }
      text = data?.responses?.[0]?.fullTextAnnotation?.text || "";
    } catch (err) {
      console.error("[ocr] request failed:", err.message);
      return res.status(502).json({ error: "OCR request failed" });
    }

    const ocrText = text.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 6000);

    // Merge OCR text into the board's searchable index (keep typed text too).
    try {
      const { whiteboards } = getCollections();
      const _id = toObjectId(req.params.id);
      if (_id) {
        const board = await whiteboards.findOne(
          { _id },
          { projection: { typedText: 1 } }
        );
        const textIndex = [board?.typedText || "", ocrText]
          .filter(Boolean)
          .join(" ")
          .slice(0, 8000);
        await whiteboards.updateOne({ _id }, { $set: { ocrText, textIndex } });
      }
    } catch (err) {
      console.error("[ocr] index update failed:", err.message);
    }

    const words = ocrText ? ocrText.split(/\s+/).filter(Boolean).length : 0;
    res.json({ success: true, text: ocrText, words });
  });

  return router;
};
