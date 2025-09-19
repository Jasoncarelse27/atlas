// backend/middleware/authMiddleware.mjs
import jwt from "jsonwebtoken";

export default function authMiddleware(req, res, next) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: "UNAUTHORIZED", message: "Missing token" });

  try {
    const decoded = jwt.decode(token) || {};
    const userId = decoded?.sub || decoded?.user_id || decoded?.user?.id;
    if (!userId) return res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid token" });

    req.user = { id: userId, email: decoded?.email };
    req.auth = { user: req.user, raw: decoded };
    next();
  } catch (e) {
    return res.status(401).json({ error: "UNAUTHORIZED", message: "Bad token" });
  }
}