import jwt from "jsonwebtoken";
import SystemSettings from "../models/SystemSettings.js";
import User from "../models/User.js";

const ROLES = {
  SUPER_ADMIN: "Super Admin",
  INVENTORY_ADMIN: "Inventory Admin",
  REGIONAL_DIRECTOR: "Regional Director",
  ASSISTANT_REGIONAL_DIRECTOR: "Assistant Regional Director",
  MANAGEMENT: "Management",
  AFD: "AFD",
  AFD_SPECIAL: "AFD Special Access",
  TOD: "TOD",
  CAGAYAN_PO: "Cagayan Provincial Officer",
  ISABELA_PO: "Isabela Provincial Officer",
  BATANES_PO: "Batanes Provincial Officer",
  NUEVA_VIZCAYA_PO: "Nueva Vizcaya Provincial Officer",
  QUIRINO_PO: "Quirino Provincial Officer",
  ACCOUNTANT: "Accountant",
  EMPLOYEE: "employee",
};

const ALL_ROLES = Object.values(ROLES);
const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.INVENTORY_ADMIN];
const USER_ADMIN_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.INVENTORY_ADMIN,
  ROLES.REGIONAL_DIRECTOR,
  ROLES.ASSISTANT_REGIONAL_DIRECTOR,
];
const SETTINGS_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.INVENTORY_ADMIN,
  ROLES.REGIONAL_DIRECTOR,
  ROLES.ASSISTANT_REGIONAL_DIRECTOR,
  ROLES.MANAGEMENT,
];
const PROVINCIAL_ROLES = [
  ROLES.CAGAYAN_PO,
  ROLES.ISABELA_PO,
  ROLES.BATANES_PO,
  ROLES.NUEVA_VIZCAYA_PO,
  ROLES.QUIRINO_PO,
];
const AFD_ACCESS_ROLES = [ROLES.AFD, ROLES.AFD_SPECIAL];
const INVENTORY_ROLES = [
  ...ADMIN_ROLES,
  ROLES.REGIONAL_DIRECTOR,
  ROLES.ASSISTANT_REGIONAL_DIRECTOR,
  ...AFD_ACCESS_ROLES,
  ROLES.TOD,
  ...PROVINCIAL_ROLES,
  ROLES.ACCOUNTANT,
];
const STOCK_VIEW_AND_REQUEST_ROLES = Array.from(
  new Set([...INVENTORY_ROLES, ROLES.EMPLOYEE])
);
const OFFICE_DASHBOARD_ROLES = STOCK_VIEW_AND_REQUEST_ROLES;
const STOCK_ENTRY_ROLES = [...ADMIN_ROLES];
const SIGNATORY_ROLES = [...INVENTORY_ROLES];
const EMPLOYEE_LOOKUP_DEFAULT_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.REGIONAL_DIRECTOR,
  ROLES.ASSISTANT_REGIONAL_DIRECTOR,
  ROLES.AFD,
  ROLES.TOD,
];

const FEATURE_TAGS = [
  { tag: "dashboard.main", defaultRoles: ALL_ROLES },
  { tag: "dashboard.office", defaultRoles: OFFICE_DASHBOARD_ROLES },
  { tag: "dashboard.office.cards.supplies", defaultRoles: SIGNATORY_ROLES },
  { tag: "dashboard.office.cards.equipment", defaultRoles: SIGNATORY_ROLES },
  { tag: "dashboard.office.cards.furniture", defaultRoles: SIGNATORY_ROLES },
  { tag: "dashboard.office.cards.ict", defaultRoles: SIGNATORY_ROLES },
  { tag: "stocks.entry", defaultRoles: STOCK_ENTRY_ROLES },
  { tag: "stocks.browse", defaultRoles: STOCK_VIEW_AND_REQUEST_ROLES },
  { tag: "stocks.office_supplies", defaultRoles: STOCK_VIEW_AND_REQUEST_ROLES },
  { tag: "stocks.office_equipment", defaultRoles: STOCK_VIEW_AND_REQUEST_ROLES },
  { tag: "stocks.office_furniture", defaultRoles: STOCK_VIEW_AND_REQUEST_ROLES },
  { tag: "stocks.office_ict", defaultRoles: STOCK_VIEW_AND_REQUEST_ROLES },
  { tag: "stocks.distribution", defaultRoles: SIGNATORY_ROLES },
  { tag: "stocks.distribution.request", defaultRoles: STOCK_VIEW_AND_REQUEST_ROLES },
  { tag: "stocks.request_queue", defaultRoles: STOCK_VIEW_AND_REQUEST_ROLES },
  { tag: "inventory.my", defaultRoles: ALL_ROLES },
  { tag: "inventory.employee_lookup", defaultRoles: EMPLOYEE_LOOKUP_DEFAULT_ROLES },
  { tag: "reports.office_supplies", defaultRoles: SIGNATORY_ROLES },
  { tag: "reports.stock_card", defaultRoles: SIGNATORY_ROLES },
  { tag: "reports.master_ledger", defaultRoles: SIGNATORY_ROLES },
  { tag: "reports.office_equipment.ppe", defaultRoles: SIGNATORY_ROLES },
  { tag: "reports.office_equipment.se", defaultRoles: SIGNATORY_ROLES },
  { tag: "reports.office_furniture.ppe", defaultRoles: SIGNATORY_ROLES },
  { tag: "reports.office_furniture.se", defaultRoles: SIGNATORY_ROLES },
  { tag: "reports.office_ict.ppe", defaultRoles: SIGNATORY_ROLES },
  { tag: "reports.office_ict.se", defaultRoles: SIGNATORY_ROLES },
  { tag: "stocks.govnet_equipment", defaultRoles: [ROLES.SUPER_ADMIN] },
  { tag: "stocks.govnet_supply", defaultRoles: [ROLES.SUPER_ADMIN] },
  { tag: "stocks.freewifi", defaultRoles: [ROLES.SUPER_ADMIN] },
  { tag: "stocks.office_land", defaultRoles: [ROLES.SUPER_ADMIN] },
  { tag: "stocks.office_motor", defaultRoles: [ROLES.SUPER_ADMIN] },
  { tag: "users.dashboard", defaultRoles: USER_ADMIN_ROLES },
  { tag: "users.read", defaultRoles: SIGNATORY_ROLES },
  { tag: "users.manage", defaultRoles: USER_ADMIN_ROLES },
  { tag: "settings.core", defaultRoles: SETTINGS_ROLES },
  { tag: "settings.workflow", defaultRoles: SETTINGS_ROLES },
  { tag: "settings.signatories", defaultRoles: [ROLES.SUPER_ADMIN] },
  { tag: "settings.request_limits", defaultRoles: SETTINGS_ROLES },
  { tag: "settings.se_threshold", defaultRoles: SETTINGS_ROLES },
  { tag: "settings.audit_logs", defaultRoles: SETTINGS_ROLES },
  { tag: "settings.csv_import", defaultRoles: SETTINGS_ROLES },
  { tag: "settings.projects", defaultRoles: SETTINGS_ROLES },
  { tag: "settings.designations", defaultRoles: SETTINGS_ROLES },
  { tag: "settings.supply_visibility", defaultRoles: SETTINGS_ROLES },
  { tag: "settings.backup", defaultRoles: [ROLES.SUPER_ADMIN] },
  { tag: "users.role_management", defaultRoles: [ROLES.SUPER_ADMIN] },
  { tag: "details.office_supplies", defaultRoles: ALL_ROLES },
  { tag: "details.office_equipment", defaultRoles: ALL_ROLES },
  { tag: "details.office_furniture", defaultRoles: ALL_ROLES },
  { tag: "details.office_ict", defaultRoles: ALL_ROLES },
  { tag: "details.checkform", defaultRoles: ALL_ROLES },
  { tag: "details.checkuser", defaultRoles: USER_ADMIN_ROLES },
];

const ALL_FEATURE_TAGS = FEATURE_TAGS.map((feature) => feature.tag);
const ROLE_ACCESS_VERSION = 6;
const ROLE_ACCESS_MIGRATION_TAGS = [
  "settings.signatories",
  "inventory.employee_lookup",
  "stocks.distribution.request",
  "settings.se_threshold",
  "reports.office_equipment.ppe",
  "reports.office_equipment.se",
  "reports.office_furniture.ppe",
  "reports.office_furniture.se",
  "reports.office_ict.ppe",
  "reports.office_ict.se",
];

const normalizeRole = (role) => {
  if (!role || typeof role !== "string") return "";
  return role.trim().toLowerCase();
};

const buildDefaultAccess = () => {
  const map = {};
  ALL_ROLES.forEach((role) => {
    map[normalizeRole(role)] = [];
  });

  FEATURE_TAGS.forEach((feature) => {
    const roles = feature.defaultRoles || [];
    roles.forEach((role) => {
      const key = normalizeRole(role);
      if (!map[key]) map[key] = [];
      map[key].push(feature.tag);
    });
  });

  return map;
};

const DEFAULT_ROLE_ACCESS = buildDefaultAccess();

const normalizeRoleAccessMap = (rawMap) => {
  const normalized = {};
  if (!rawMap || typeof rawMap !== "object") return normalized;
  Object.entries(rawMap).forEach(([roleKey, tags]) => {
    const key = normalizeRole(roleKey);
    if (!key) return;
    const list = Array.isArray(tags) ? tags : [];
    const cleaned = Array.from(new Set(list.filter((t) => typeof t === "string")));
    normalized[key] = cleaned;
  });
  return normalized;
};

const mergeRoleAccessWithDefaults = (rawMap) => {
  const normalized = normalizeRoleAccessMap(rawMap);
  const merged = { ...DEFAULT_ROLE_ACCESS, ...normalized };
  const superKey = normalizeRole(ROLES.SUPER_ADMIN);
  merged[superKey] = [...ALL_FEATURE_TAGS];
  return merged;
};

const isSuperAdmin = (role) => {
  const key = normalizeRole(role);
  return (
    key === normalizeRole(ROLES.SUPER_ADMIN) ||
    key === "superadmin" ||
    key === "admin"
  );
};

const roleAccessCache = {
  data: null,
  fetchedAt: 0,
};

const migrateRoleAccess = async (settings) => {
  if (!settings) return settings;
  const currentVersion = Number(settings.role_access_version || 0);
  if (currentVersion >= ROLE_ACCESS_VERSION) return settings;

  const updated = normalizeRoleAccessMap(settings.role_access || {});
  if (currentVersion < 5) {
    Object.keys(updated).forEach((roleKey) => {
      updated[roleKey] = updated[roleKey].filter(
        (tag) => tag !== "inventory.employee_lookup"
      );
    });
  }
  ROLE_ACCESS_MIGRATION_TAGS.forEach((tag) => {
    const feature = FEATURE_TAGS.find((f) => f.tag === tag);
    if (!feature) return;
    const roles = feature.defaultRoles || [];
    roles.forEach((role) => {
      const key = normalizeRole(role);
      if (!key) return;
      if (!updated[key]) updated[key] = [];
      if (!updated[key].includes(tag)) updated[key].push(tag);
    });
  });

  try {
    await SystemSettings.updateOne(
      { key: "global" },
      { $set: { role_access: updated, role_access_version: ROLE_ACCESS_VERSION } }
    );
  } catch (err) {
    console.error("ROLE_ACCESS_MIGRATION_FAILED:", err?.message || err);
  }

  return { ...settings, role_access: updated, role_access_version: ROLE_ACCESS_VERSION };
};

const getRoleAccessMap = async () => {
  const now = Date.now();
  if (roleAccessCache.data && now - roleAccessCache.fetchedAt < 30000) {
    return roleAccessCache.data;
  }
  const settings = await SystemSettings.findOne({ key: "global" }).lean();
  const migratedSettings = await migrateRoleAccess(settings);
  const merged = mergeRoleAccessWithDefaults(migratedSettings?.role_access || {});
  roleAccessCache.data = merged;
  roleAccessCache.fetchedAt = now;
  return merged;
};

const normalizeSessionVersion = (value) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
};

const resolveDecodedUser = async (decoded) => {
  const userId = decoded?.id || decoded?._id;
  if (!userId) return { user: null, reason: "not_authenticated" };

  const dbUser = await User.findById(userId)
    .select("_id email username role active session_version")
    .lean();
  if (!dbUser) return { user: null, reason: "not_authenticated" };
  if (dbUser.active === false) return { user: null, reason: "inactive" };

  const tokenSessionVersion = normalizeSessionVersion(decoded?.sessionVersion ?? decoded?.sv);
  const currentSessionVersion = normalizeSessionVersion(dbUser?.session_version);
  if (tokenSessionVersion !== currentSessionVersion) {
    return { user: null, reason: "force_logout" };
  }

  return {
    user: {
      ...decoded,
      id: String(dbUser._id),
      _id: String(dbUser._id),
      role: dbUser.role || decoded.role,
      email: dbUser.email || decoded.email,
      username: dbUser.username || decoded.username,
      sessionVersion: currentSessionVersion,
    },
    reason: null,
  };
};

const resolveUserFromToken = async (token) => {
  if (!token) return { user: null, reason: "not_authenticated" };
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    if (!decoded) return { user: null, reason: "not_authenticated" };
    return await resolveDecodedUser(decoded);
  } catch {
    return { user: null, reason: "not_authenticated" };
  }
};

const resolveUserFromRequest = async (req) => {
  req.authFailureReason = null;
  if (req.user) return req.user;

  const authHeader = req.headers?.authorization || "";
  if (typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const resolved = await resolveUserFromToken(token);
      if (resolved.user) {
        req.user = resolved.user;
        req.authFailureReason = null;
        return req.user;
      }
      if (resolved.reason) req.authFailureReason = resolved.reason;
    }
  }

  const token = req.cookies?.accessToken;
  const resolved = await resolveUserFromToken(token);
  if (resolved.user) {
    req.user = resolved.user;
    req.authFailureReason = null;
    return req.user;
  }
  if (resolved.reason) req.authFailureReason = resolved.reason;

  return null;
};

const getAuthFailureMessage = (req) => {
  const reason = String(req?.authFailureReason || "").toLowerCase();
  if (reason === "force_logout") {
    return "You have been force logged out. Please sign in again.";
  }
  if (reason === "inactive") {
    return "Account is inactive. Please contact the administrator.";
  }
  return "Not authenticated";
};

export const requireAuth = async (req, res, next) => {
  const user = await resolveUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ success: false, message: getAuthFailureMessage(req) });
  }
  return next();
};

export const hasAccessTag = async (role, tag) => {
  if (!tag) return true;
  if (isSuperAdmin(role)) return true;
  const roleAccess = await getRoleAccessMap();
  const key = normalizeRole(role);
  const allowed = roleAccess?.[key] || [];
  return allowed.includes(tag);
};

export const requireAccess = (tag) => async (req, res, next) => {
  const user = await resolveUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ success: false, message: getAuthFailureMessage(req) });
  }
  if (!tag) return next();
  if (isSuperAdmin(user.role)) return next();
  const roleAccess = await getRoleAccessMap();
  const key = normalizeRole(user.role);
  const accessList = roleAccess[key] || [];
  if (!accessList.includes(tag)) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }
  return next();
};

export const requireAnyAccess = (tags = []) => async (req, res, next) => {
  const user = await resolveUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ success: false, message: getAuthFailureMessage(req) });
  }
  const tagList = Array.isArray(tags) ? tags : [tags].filter(Boolean);
  if (!tagList.length) return next();
  if (isSuperAdmin(user.role)) return next();
  const roleAccess = await getRoleAccessMap();
  const key = normalizeRole(user.role);
  const accessList = roleAccess[key] || [];
  const ok = tagList.some((tag) => accessList.includes(tag));
  if (!ok) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }
  return next();
};

export const requireSelfOrAccess = (tag) => async (req, res, next) => {
  const user = await resolveUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ success: false, message: getAuthFailureMessage(req) });
  }
  if (req.params?.id && String(req.params.id) === String(user.id)) {
    return next();
  }
  return requireAccess(tag)(req, res, next);
};

export const requireRole = (roles = []) => async (req, res, next) => {
  const user = await resolveUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ success: false, message: getAuthFailureMessage(req) });
  }
  if (!roles.length) return next();
  const allowed = roles.map(normalizeRole).filter(Boolean);
  if (allowed.includes(normalizeRole(user.role)) || isSuperAdmin(user.role)) {
    return next();
  }
  return res.status(403).json({ success: false, message: "Access denied" });
};
