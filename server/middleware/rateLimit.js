// Minimal in-memory rate limiter (per single instance — fine for this app;
// a multi-instance deploy would need a shared store like Redis).
//
// rateLimit({ windowMs, max, key }) → Express middleware that allows `max`
// requests per `windowMs` per derived key (default: client IP). Old buckets are
// pruned lazily so the Map doesn't grow unbounded.

function rateLimit({ windowMs = 15 * 60 * 1000, max = 10, key } = {}) {
  const hits = new Map(); // key -> { count, resetAt }

  return function (req, res, next) {
    const now = Date.now();
    const k = (key ? key(req) : null) || req.ip || req.socket?.remoteAddress || "unknown";

    let bucket = hits.get(k);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      hits.set(k, bucket);
    }
    bucket.count += 1;

    // Opportunistic prune to bound memory.
    if (hits.size > 5000) {
      for (const [hk, b] of hits) if (b.resetAt <= now) hits.delete(hk);
    }

    if (bucket.count > max) {
      const retry = Math.ceil((bucket.resetAt - now) / 1000);
      res.set("Retry-After", String(retry));
      return res
        .status(429)
        .json({ error: "Too many attempts. Please try again later." });
    }
    next();
  };
}

module.exports = { rateLimit };
