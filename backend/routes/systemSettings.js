import express from "express";
import {
  getSystemSettings,
  updateSystemSettings,
} from "../Controllers/systemSettingsController.js";
import { validateBody, schemas } from "../utils/validators.js";
import { createWriteLimiter, isAdminRole } from "../utils/rateLimit.js";

const writeLimiter = createWriteLimiter({
  windowMs: 5 * 60 * 1000,
  max: 30,
  skip: (req) => isAdminRole(req?.user?.role),
});
import { requireAccess, requireAnyAccess, requireAuth } from "../utils/rbac.js";

const router = express.Router();

const requireDocumentSignatoriesAccess = (req, res, next) => {
  if (!Object.prototype.hasOwnProperty.call(req.body || {}, "document_signatories")) {
    return next();
  }
  return requireAccess("settings.signatories")(req, res, next);
};

router.get("/", requireAuth, getSystemSettings);
router.put(
  "/",
  requireAnyAccess([
    "settings.core",
    "settings.workflow",
    "settings.signatories",
    "settings.request_limits",
    "settings.se_threshold",
    "settings.supply_visibility",
    "settings.session_timeout",
    "users.role_management",
  ]),
  requireDocumentSignatoriesAccess,
  writeLimiter,
  validateBody(schemas.settingsUpdate),
  updateSystemSettings
);

export default router;
