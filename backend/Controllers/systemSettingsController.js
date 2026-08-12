import SystemSettings from "../models/SystemSettings.js";
import { createLog } from "./logsController.js";

const nowISO = () => new Date().toISOString();

const actorFromReq = (req) =>
  req?.user?.email ||
  req?.user?.username ||
  req?.user?.id ||
  req?.user?._id ||
  req?.headers?.["x-user-email"] ||
  req?.headers?.["x-user-id"] ||
  "NA";

const safeCreateLog = async (logData) => {
  try {
    await createLog(logData);
  } catch (e) {
    console.error("LOGGING_ERROR:", e?.message || e);
  }
};

const formatValue = (value) => {
  if (value === undefined) return "—";
  if (value === null) return "null";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const defaultPayload = {
  key: "global",
  enable_signed_download: true,
  enable_signed_upload: true,
  enable_email: true,
  hide_supply_quantities: false,
  hide_supply_quantity_roles: ["super admin", "inventory admin", "afd"],
  distribution_request_limit_default: 5,
  distribution_request_limit_by_role: {
    "super admin": -1,
    "inventory admin": -1,
  },
  se_threshold: 50000,
  cleanup_pending_enabled: true,
  cleanup_pending_days: 14,
  session_timeout_enabled: true,
  session_timeout_minutes: 30,
  role_access_version: 1,
  role_access: {},
  document_signatories: {},
};

const normalizeRoleKey = (roleKey) =>
  typeof roleKey === "string" ? roleKey.trim().toLowerCase() : "";

const sanitizeRoleList = (list) => {
  if (!Array.isArray(list)) return [];
  const cleaned = list
    .map((role) => normalizeRoleKey(role))
    .filter(Boolean);
  return Array.from(new Set(cleaned));
};

const sanitizeLimitValue = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n === -1) return -1;
  if (n < 1) return null;
  return Math.floor(n);
};

const sanitizeLimitMap = (raw) => {
  if (!raw || typeof raw !== "object") return {};
  return Object.entries(raw).reduce((acc, [key, val]) => {
    const roleKey = normalizeRoleKey(key);
    if (!roleKey) return acc;
    const cleanVal = sanitizeLimitValue(val);
    if (cleanVal === null) return acc;
    acc[roleKey] = cleanVal;
    return acc;
  }, {});
};

const DOCUMENT_SIGNATORY_SLOTS = {
  ris: ["checker_id", "approver_id"],
  ptr: ["approver_id", "releaser_id"],
  ics_issuance: ["approver_id"],
  ics_transfer: ["approver_id"],
};

const sanitizeDocumentSignatories = (raw) => {
  if (!raw || typeof raw !== "object") return {};
  return Object.entries(DOCUMENT_SIGNATORY_SLOTS).reduce((documents, [documentKey, slots]) => {
    const source = raw?.[documentKey];
    if (!source || typeof source !== "object") return documents;
    const cleanSlots = slots.reduce((result, slot) => {
      const value = String(source?.[slot] || "").trim();
      if (value) result[slot] = value;
      return result;
    }, {});
    documents[documentKey] = cleanSlots;
    return documents;
  }, {});
};


export const getSystemSettings = async (_req, res) => {
  try {
    let settings = await SystemSettings.findOne({ key: "global" }).lean();
    if (!settings) {
      settings = await SystemSettings.create(defaultPayload);
    }
    return res.status(200).json(settings);
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to load settings." });
  }
};

export const updateSystemSettings = async (req, res) => {
  try {
    const payload = {};
    const before = await SystemSettings.findOne({ key: "global" }).lean();
    const version = req.body?.__v;
    if (version !== undefined && before && Number(before.__v) !== Number(version)) {
      return res.status(409).json({
        success: false,
        message: "Version conflict. Please refresh and try again.",
      });
    }

    if ("enable_signed_download" in req.body) {
      payload.enable_signed_download = !!req.body?.enable_signed_download;
    }

    if ("enable_signed_upload" in req.body) {
      payload.enable_signed_upload = !!req.body?.enable_signed_upload;
    }

    if ("enable_email" in req.body) {
      payload.enable_email = !!req.body?.enable_email;
    }

    if ("hide_supply_quantities" in req.body) {
      payload.hide_supply_quantities = !!req.body?.hide_supply_quantities;
    }

    if ("hide_supply_quantity_roles" in req.body) {
      payload.hide_supply_quantity_roles = sanitizeRoleList(
        req.body?.hide_supply_quantity_roles
      );
    }

    if ("distribution_request_limit_default" in req.body) {
      const limit = sanitizeLimitValue(req.body?.distribution_request_limit_default);
      payload.distribution_request_limit_default = limit && limit > 0 ? limit : 5;
    }

    if ("distribution_request_limit_by_role" in req.body) {
      payload.distribution_request_limit_by_role = sanitizeLimitMap(
        req.body?.distribution_request_limit_by_role
      );
    }

    if ("se_threshold" in req.body) {
      const raw = Number(req.body?.se_threshold);
      payload.se_threshold = Number.isFinite(raw) && raw > 0 ? raw : 50000;
    }

    if ("cleanup_pending_enabled" in req.body) {
      payload.cleanup_pending_enabled = !!req.body?.cleanup_pending_enabled;
    }

    if ("cleanup_pending_days" in req.body) {
      const days = Number(req.body?.cleanup_pending_days);
      payload.cleanup_pending_days = Number.isFinite(days) && days > 0 ? Math.floor(days) : 14;
    }

    if ("session_timeout_enabled" in req.body) {
      payload.session_timeout_enabled = !!req.body?.session_timeout_enabled;
    }

    if ("session_timeout_minutes" in req.body) {
      const minutes = Number(req.body?.session_timeout_minutes);
      payload.session_timeout_minutes =
        Number.isFinite(minutes) && minutes > 0 ? Math.floor(minutes) : 30;
    }


    if ("role_access" in req.body) {
      payload.role_access = req.body?.role_access || {};
    }

    if ("document_signatories" in req.body) {
      payload.document_signatories = sanitizeDocumentSignatories(
        req.body?.document_signatories
      );
    }

    const settings = await SystemSettings.findOneAndUpdate(
      { key: "global", ...(version !== undefined && before ? { __v: Number(version) } : {}) },
      {
        $set: payload,
        $setOnInsert: { key: "global" },
        $inc: { __v: 1 },
      },
      { upsert: true, new: true }
    ).lean();

    const changes = [];
    Object.keys(payload).forEach((key) => {
      if (key === "role_access") {
        changes.push("role_access: updated");
        return;
      }
      if (key === "document_signatories") {
        changes.push("document_signatories: updated");
        return;
      }
      if (key === "distribution_request_limit_by_role") {
        changes.push("distribution_request_limit_by_role: updated");
        return;
      }
      if (key === "hide_supply_quantity_roles") {
        changes.push("hide_supply_quantity_roles: updated");
        return;
      }
      const b = before?.[key];
      const a = settings?.[key];
      if (JSON.stringify(b) !== JSON.stringify(a)) {
        changes.push(`${key}: "${formatValue(b)}" → "${formatValue(a)}"`);
      }
    });

    let action = "System Settings - Update";
    if (changes.length) action += ` | ${changes.join(" | ")}`;

    await safeCreateLog({
      userId: actorFromReq(req),
      action,
      status: "success",
      time: nowISO(),
    });

    return res.status(200).json(settings);
  } catch (err) {
    await safeCreateLog({
      userId: actorFromReq(req),
      action: "System Settings - Update",
      status: "error",
      time: nowISO(),
    });
    return res.status(500).json({ success: false, message: "Failed to update settings." });
  }
};
