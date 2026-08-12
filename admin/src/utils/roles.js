export const ROLES = {
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

export const ALL_ROLES = Object.values(ROLES);

export const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.INVENTORY_ADMIN];
export const USER_ADMIN_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.INVENTORY_ADMIN,
  ROLES.REGIONAL_DIRECTOR,
  ROLES.ASSISTANT_REGIONAL_DIRECTOR,
];
export const SETTINGS_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.INVENTORY_ADMIN,
  ROLES.REGIONAL_DIRECTOR,
  ROLES.ASSISTANT_REGIONAL_DIRECTOR,
  ROLES.MANAGEMENT,
];

export const PROVINCIAL_ROLES = [
  ROLES.CAGAYAN_PO,
  ROLES.ISABELA_PO,
  ROLES.BATANES_PO,
  ROLES.NUEVA_VIZCAYA_PO,
  ROLES.QUIRINO_PO,
];

export const AFD_ACCESS_ROLES = [ROLES.AFD, ROLES.AFD_SPECIAL];

/** Signatories / custodians (NOT employees) */
export const INVENTORY_ROLES = [
  ...ADMIN_ROLES,
  ROLES.REGIONAL_DIRECTOR,
  ROLES.ASSISTANT_REGIONAL_DIRECTOR,
  ...AFD_ACCESS_ROLES,
  ROLES.TOD,
  ...PROVINCIAL_ROLES,
  ROLES.ACCOUNTANT,
];

/** Employees can view stocks + add to cart + submit requests */
export const STOCK_VIEW_AND_REQUEST_ROLES = Array.from(
  new Set([...INVENTORY_ROLES, ROLES.EMPLOYEE])
);

/** IMPORTANT: Office dashboard + sidebar should be accessible to employees too */
export const OFFICE_DASHBOARD_ROLES = STOCK_VIEW_AND_REQUEST_ROLES;

/** Add stock / stock-in / purchase entry = admin only */
export const STOCK_ENTRY_ROLES = [...ADMIN_ROLES];

/** Distribution actions = signatories only */
export const SIGNATORY_ROLES = [...INVENTORY_ROLES];

export const normalizeRole = (role) => {
  if (!role || typeof role !== "string") return "";
  return role.trim().toLowerCase();
};
