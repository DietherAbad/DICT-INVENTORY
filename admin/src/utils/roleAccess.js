import {
  ALL_ROLES,
  ROLES,
  INVENTORY_ROLES,
  OFFICE_DASHBOARD_ROLES,
  SETTINGS_ROLES,
  SIGNATORY_ROLES,
  STOCK_ENTRY_ROLES,
  STOCK_VIEW_AND_REQUEST_ROLES,
  USER_ADMIN_ROLES,
  normalizeRole,
} from "./roles";

export const FEATURE_GROUPS = [
  "Dashboards",
  "Stock Entry",
  "Stocks & Requests",
  "Distributions",
  "Reports",
  "User Management",
  "Settings",
  "Details",
];

const EMPLOYEE_LOOKUP_DEFAULT_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.REGIONAL_DIRECTOR,
  ROLES.ASSISTANT_REGIONAL_DIRECTOR,
  ROLES.AFD,
  ROLES.TOD,
];

export const FEATURE_TAGS = [
  {
    tag: "dashboard.main",
    label: "Main Dashboard",
    group: "Dashboards",
    description: "Main landing dashboard after login.",
    defaultRoles: ALL_ROLES,
  },
  {
    tag: "dashboard.office",
    label: "Office Inventory Dashboard",
    group: "Dashboards",
    description: "Office inventory overview with smart assistant.",
    defaultRoles: OFFICE_DASHBOARD_ROLES,
  },
  {
    tag: "dashboard.office.cards.supplies",
    label: "Office Dashboard - Supplies Summary Cards",
    group: "Dashboards",
    description: "Show supplies summary cards on the office dashboard.",
    defaultRoles: SIGNATORY_ROLES,
  },
  {
    tag: "dashboard.office.cards.equipment",
    label: "Office Dashboard - Equipment Summary Cards",
    group: "Dashboards",
    description: "Show equipment summary cards on the office dashboard.",
    defaultRoles: SIGNATORY_ROLES,
  },
  {
    tag: "dashboard.office.cards.furniture",
    label: "Office Dashboard - Furniture Summary Cards",
    group: "Dashboards",
    description: "Show furniture summary cards on the office dashboard.",
    defaultRoles: SIGNATORY_ROLES,
  },
  {
    tag: "dashboard.office.cards.ict",
    label: "Office Dashboard - ICT Summary Cards",
    group: "Dashboards",
    description: "Show ICT summary cards on the office dashboard.",
    defaultRoles: SIGNATORY_ROLES,
  },
  {
    tag: "stocks.entry",
    label: "Add Stock & Purchase Forms",
    group: "Stock Entry",
    description: "Create new stock entries and purchase forms.",
    defaultRoles: STOCK_ENTRY_ROLES,
  },
  {
    tag: "stocks.browse",
    label: "Stock Browser",
    group: "Stocks & Requests",
    description: "General stock browsing and overview.",
    defaultRoles: STOCK_VIEW_AND_REQUEST_ROLES,
  },
  {
    tag: "stocks.office_supplies",
    label: "Office Supplies Stocks",
    group: "Stocks & Requests",
    description: "Office supplies stock table.",
    defaultRoles: STOCK_VIEW_AND_REQUEST_ROLES,
  },
  {
    tag: "stocks.office_equipment",
    label: "Office Equipment Stocks",
    group: "Stocks & Requests",
    description: "Office equipment stock table.",
    defaultRoles: STOCK_VIEW_AND_REQUEST_ROLES,
  },
  {
    tag: "stocks.office_furniture",
    label: "Furniture & Fixtures Stocks",
    group: "Stocks & Requests",
    description: "Furniture and fixtures stock table.",
    defaultRoles: STOCK_VIEW_AND_REQUEST_ROLES,
  },
  {
    tag: "stocks.office_ict",
    label: "ICT Equipment Stocks",
    group: "Stocks & Requests",
    description: "ICT equipment stock table.",
    defaultRoles: STOCK_VIEW_AND_REQUEST_ROLES,
  },
  {
    tag: "stocks.distribution",
    label: "Office Supplies Distribution",
    group: "Distributions",
    description: "Distribution approvals and transfer listing.",
    defaultRoles: SIGNATORY_ROLES,
  },
  {
    tag: "stocks.distribution.request",
    label: "Request Supply Distribution",
    group: "Distributions",
    description: "Create supply distribution requests from cart.",
    defaultRoles: STOCK_VIEW_AND_REQUEST_ROLES,
  },
  {
    tag: "stocks.request_queue",
    label: "Inventory Requests Queue",
    group: "Stocks & Requests",
    description: "Inventory request inbox and approvals.",
    defaultRoles: STOCK_VIEW_AND_REQUEST_ROLES,
  },
  {
    tag: "inventory.my",
    label: "My Inventory",
    group: "Stocks & Requests",
    description: "User inventory and issued items.",
    defaultRoles: ALL_ROLES,
  },
  {
    tag: "inventory.employee_lookup",
    label: "Employee Asset Lookup",
    group: "Stocks & Requests",
    description: "Search employees and review assigned property and received supplies.",
    defaultRoles: EMPLOYEE_LOOKUP_DEFAULT_ROLES,
  },
  {
    tag: "reports.office_supplies",
    label: "Office Supplies Reports",
    group: "Reports",
    description: "Office supplies reports and exports.",
    defaultRoles: SIGNATORY_ROLES,
  },
  {
    tag: "reports.stock_card",
    label: "Generate Stock Card",
    group: "Reports",
    description: "Generate stock card for office supplies.",
    defaultRoles: SIGNATORY_ROLES,
  },
  {
    tag: "reports.master_ledger",
    label: "Generate Master Ledger",
    group: "Reports",
    description: "Generate master ledger for office supplies.",
    defaultRoles: SIGNATORY_ROLES,
  },
  {
    tag: "reports.office_equipment.ppe",
    label: "Office Equipment PPE Reports",
    group: "Reports",
    description: "PPE-only reports for office equipment.",
    defaultRoles: SIGNATORY_ROLES,
  },
  {
    tag: "reports.office_equipment.se",
    label: "Office Equipment SE Reports",
    group: "Reports",
    description: "SE-only reports for office equipment.",
    defaultRoles: SIGNATORY_ROLES,
  },
  {
    tag: "reports.office_furniture.ppe",
    label: "Furniture PPE Reports",
    group: "Reports",
    description: "PPE-only reports for furniture and fixtures.",
    defaultRoles: SIGNATORY_ROLES,
  },
  {
    tag: "reports.office_furniture.se",
    label: "Furniture SE Reports",
    group: "Reports",
    description: "SE-only reports for furniture and fixtures.",
    defaultRoles: SIGNATORY_ROLES,
  },
  {
    tag: "reports.office_ict.ppe",
    label: "ICT PPE Reports",
    group: "Reports",
    description: "PPE-only reports for ICT equipment.",
    defaultRoles: SIGNATORY_ROLES,
  },
  {
    tag: "reports.office_ict.se",
    label: "ICT SE Reports",
    group: "Reports",
    description: "SE-only reports for ICT equipment.",
    defaultRoles: SIGNATORY_ROLES,
  },
  {
    tag: "users.dashboard",
    label: "User Management Dashboard",
    group: "User Management",
    description: "User management hub and navigation.",
    defaultRoles: USER_ADMIN_ROLES,
  },
  {
    tag: "users.read",
    label: "User Directory (Read-only)",
    group: "User Management",
    description: "Read-only list of users for display and approvals.",
    defaultRoles: SIGNATORY_ROLES,
  },
  {
    tag: "users.manage",
    label: "User & Role Tables",
    group: "User Management",
    description: "User list, role assignment, and management table.",
    defaultRoles: USER_ADMIN_ROLES,
  },
  {
    tag: "settings.core",
    label: "Settings Dashboard",
    group: "Settings",
    description: "Core settings, measures, classifications.",
    defaultRoles: SETTINGS_ROLES,
  },
  {
    tag: "settings.workflow",
    label: "Workflow Settings",
    group: "Settings",
    description: "Signed file and email workflow toggles.",
    defaultRoles: SETTINGS_ROLES,
  },
  {
    tag: "settings.signatories",
    label: "Document Signatories",
    group: "Settings",
    description: "Assign approvers and signatories for RIS, PTR, and ICS documents.",
    defaultRoles: [ROLES.SUPER_ADMIN],
  },
  {
    tag: "settings.request_limits",
    label: "Request Limits",
    group: "Settings",
    description: "Configure pending request limits per role.",
    defaultRoles: SETTINGS_ROLES,
  },
  {
    tag: "settings.se_threshold",
    label: "SE Threshold",
    group: "Settings",
    description: "Set the PPE/SE unit cost threshold.",
    defaultRoles: SETTINGS_ROLES,
  },
  {
    tag: "settings.session_timeout",
    label: "Session Timeout",
    group: "Settings",
    description: "Control inactivity logout timing for all users.",
    defaultRoles: SETTINGS_ROLES,
  },
  {
    tag: "settings.audit_logs",
    label: "Audit Logs",
    group: "Settings",
    description: "Audit log viewer.",
    defaultRoles: SETTINGS_ROLES,
  },
  {
    tag: "settings.csv_import",
    label: "CSV Import",
    group: "Settings",
    description: "Bulk import supplies and assets via CSV.",
    defaultRoles: SETTINGS_ROLES,
  },
  {
    tag: "settings.projects",
    label: "Project List",
    group: "Settings",
    description: "Manage project selections used in forms.",
    defaultRoles: SETTINGS_ROLES,
  },
  {
    tag: "settings.designations",
    label: "Designation List",
    group: "Settings",
    description: "Manage designation/station selections used in forms.",
    defaultRoles: SETTINGS_ROLES,
  },
  {
    tag: "settings.supply_visibility",
    label: "Supply Quantity Visibility",
    group: "Settings",
    description: "Control who can view supply quantities when hidden mode is enabled.",
    defaultRoles: SETTINGS_ROLES,
  },
  {
    tag: "settings.backup",
    label: "Database Backup & Restore",
    group: "Settings",
    description: "Create, download, and restore database backups.",
    defaultRoles: [ROLES.SUPER_ADMIN],
  },
  {
    tag: "users.role_management",
    label: "Role Management",
    group: "User Management",
    description: "Role access matrix configuration.",
    defaultRoles: [ROLES.SUPER_ADMIN],
  },
  {
    tag: "details.office_supplies",
    label: "Supply Details",
    group: "Details",
    description: "Supply check and distribution details.",
    defaultRoles: ALL_ROLES,
  },
  {
    tag: "details.office_equipment",
    label: "Office Equipment Details",
    group: "Details",
    description: "Office equipment item details.",
    defaultRoles: ALL_ROLES,
  },
  {
    tag: "details.office_furniture",
    label: "Furniture & Fixtures Details",
    group: "Details",
    description: "Furniture and fixtures item details.",
    defaultRoles: ALL_ROLES,
  },
  {
    tag: "details.office_ict",
    label: "ICT Equipment Details",
    group: "Details",
    description: "ICT equipment item details.",
    defaultRoles: ALL_ROLES,
  },
  {
    tag: "details.checkform",
    label: "RIS / PTR Approval Forms",
    group: "Details",
    description: "Approval forms and signatures.",
    defaultRoles: ALL_ROLES,
  },
  {
    tag: "details.checkuser",
    label: "User Detail Views",
    group: "User Management",
    description: "User profile and role editing screens.",
    defaultRoles: USER_ADMIN_ROLES,
  },
];

export const ALL_FEATURE_TAGS = FEATURE_TAGS.map((feature) => feature.tag);

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

export const DEFAULT_ROLE_ACCESS = buildDefaultAccess();
export const ROLE_ACCESS_VERSION = 6;
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

export const normalizeRoleAccessMap = (rawMap) => {
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

export const mergeRoleAccessWithDefaults = (rawMap) => {
  const normalized = normalizeRoleAccessMap(rawMap);
  const merged = { ...DEFAULT_ROLE_ACCESS, ...normalized };
  const superKey = normalizeRole(ROLES.SUPER_ADMIN);
  merged[superKey] = [...ALL_FEATURE_TAGS];
  return merged;
};

export const migrateRoleAccessForClient = (rawMap, currentVersion = 0) => {
  const migrated = normalizeRoleAccessMap(rawMap);
  if (Number(currentVersion || 0) < ROLE_ACCESS_VERSION) {
    Object.keys(migrated).forEach((roleKey) => {
      migrated[roleKey] = migrated[roleKey].filter(
        (tag) => tag !== "inventory.employee_lookup"
      );
    });
    ROLE_ACCESS_MIGRATION_TAGS.forEach((tag) => {
      const feature = FEATURE_TAGS.find((entry) => entry.tag === tag);
      (feature?.defaultRoles || []).forEach((role) => {
        const key = normalizeRole(role);
        if (!migrated[key]) migrated[key] = [];
        if (!migrated[key].includes(tag)) migrated[key].push(tag);
      });
    });
  }
  return mergeRoleAccessWithDefaults(migrated);
};

export const getRoleAccessForRole = (role, rawMap) => {
  const key = normalizeRole(role);
  if (!key) return [];
  const merged = mergeRoleAccessWithDefaults(rawMap);
  return merged[key] || [];
};

export const hasAccessTag = (role, tag, rawMap) => {
  const key = normalizeRole(role);
  if (!key) return false;
  if (key === normalizeRole(ROLES.SUPER_ADMIN)) return true;
  const access = getRoleAccessForRole(role, rawMap);
  return access.includes(tag);
};
