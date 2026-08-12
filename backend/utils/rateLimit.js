const rateStores = new Map();
let lastCleanup = 0;

const getClientIp = (req) => {
  const xf = req.headers["x-forwarded-for"];
  if (Array.isArray(xf)) return xf[0];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  return req.ip || req.connection?.remoteAddress || "unknown";
};

const cleanupStore = (now, windowMs) => {
  if (now - lastCleanup < windowMs) return;
  lastCleanup = now;
  for (const [key, entry] of rateStores.entries()) {
    if (now > entry.resetAt) rateStores.delete(key);
  }
};

export const createRateLimiter = ({
  windowMs = 60 * 1000,
  max = 60,
  message = "Too many requests. Please try again later.",
  keyGenerator,
  skip,
} = {}) => {
  return (req, res, next) => {
    if (typeof skip === "function" && skip(req)) return next();
    const now = Date.now();
    cleanupStore(now, windowMs);

    const keyBase = keyGenerator ? keyGenerator(req) : getClientIp(req);
    const key = `${keyBase}:${req.baseUrl || ""}:${req.path || ""}`;

    const existing = rateStores.get(key);
    if (!existing || now > existing.resetAt) {
      rateStores.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    existing.count += 1;
    if (existing.count > max) {
      const retry = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.set("Retry-After", String(retry));
      return res.status(429).json({ success: false, message });
    }

    rateStores.set(key, existing);
    return next();
  };
};

export const authKey = (req) => {
  const ip = getClientIp(req);
  const email = (req.body?.email || req.body?.username || "").toString().trim().toLowerCase();
  return email ? `${ip}:${email}` : ip;
};

export const userKey = (req) => {
  const ip = getClientIp(req);
  const userId =
    req?.user?.id || req?.user?._id || req?.user?.email || req?.user?.username || "";
  return userId ? `${ip}:${userId}` : ip;
};

export const isAdminRole = (role) => {
  const key = String(role || "").trim().toLowerCase();
  return key === "super admin" || key === "superadmin" || key === "inventory admin";
};

export const createWriteLimiter = ({
  windowMs = 5 * 60 * 1000,
  max = 60,
  message = "Too many write requests. Please slow down.",
  skip,
} = {}) =>
  createRateLimiter({
    windowMs,
    max,
    message,
    keyGenerator: userKey,
    skip,
  });
