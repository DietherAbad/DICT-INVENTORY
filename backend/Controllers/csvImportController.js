import bcrypt from "bcryptjs";
import crypto from "crypto";
import InventoryOfficeSupply from "../models/InventoryOfficeSupply.js";
import InventoryOfficeEquipment from "../models/InventoryOfficeEquipment.js";
import InventoryOfficeFurnitureandFixture from "../models/InventoryOfficeFurnitureandFixture.js";
import InventoryOfficeICTEquipment from "../models/InventoryOfficeICTEquipment.js";
import User from "../models/User.js";
import Project from "../models/Project.js";
import Designation from "../models/Designation.js";
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

const normalizeHeader = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

const normalizeProjectName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const normalizeDesignationName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const normalizeEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const PASSWORD_POLICY = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;

const DEFAULT_PROJECTS = [
  "General",
  "eLGU",
  "FreeWifi",
  "IIDB",
  "ILCDB",
  "Tech4Ed",
  "Not Applicable",
  "N/A",
];

const DEFAULT_DESIGNATIONS = [
  "DICT Region 2",
  "Regional Office - Tuguegarao",
  "Office of the Regional Director",
  "AFD",
  "AFD Cashier",
  "Cashier’s Office",
  "Cashiers Office",
  "TOD",
  "Cagayan Office",
  "Isabela Office - Cauayan",
  "Isabela Office - Santiago",
  "Nueva Vizcaya Office",
  "Quirino Office",
  "Batanes Office",
  "Regional Office",
  "Provincial Office",
  "Field Office",
  "Motorpool",
  "Procurement",
  "Asset Management",
  "Helpdesk / Service Desk",
];

const ensureProjectDefaults = async () => {
  const existing = await Project.find().select("normalized").lean();
  const existingSet = new Set(existing.map((p) => p.normalized));
  const toInsert = DEFAULT_PROJECTS.filter(
    (name) => !existingSet.has(normalizeProjectName(name))
  ).map((name) => ({
    name,
    normalized: normalizeProjectName(name),
    active: true,
  }));
  if (toInsert.length) {
    await Project.insertMany(toInsert, { ordered: true });
  }
};

const ensureDesignationDefaults = async () => {
  const existing = await Designation.find().select("normalized").lean();
  const existingSet = new Set(existing.map((d) => d.normalized));
  const toInsert = DEFAULT_DESIGNATIONS.filter(
    (name) => !existingSet.has(normalizeDesignationName(name))
  ).map((name) => ({
    name,
    normalized: normalizeDesignationName(name),
    active: true,
  }));
  if (toInsert.length) {
    await Designation.insertMany(toInsert, { ordered: true });
  }
};

const excelSerialToDate = (serial) => {
  const n = Number(serial);
  if (!Number.isFinite(n)) return null;
  const ms = Math.round((n - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
};

const parseDateValue = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    return excelSerialToDate(value);
  }
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && String(value).trim() === String(asNumber)) {
    return excelSerialToDate(asNumber);
  }
  const raw = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;
const EMAIL_REGEX = /^\S+@\S+\.\S+$/i;

const parseCsv = (text) => {
  const rows = [];
  const input = String(text || "");
  if (!input.trim()) return rows;

  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === "\"") {
      if (inQuotes && input[i + 1] === "\"") {
        field += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((cell) => String(cell).trim() !== "")) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    field += ch;
  }

  row.push(field);
  if (row.some((cell) => String(cell).trim() !== "")) {
    rows.push(row);
  }

  if (rows.length && rows[0].length) {
    rows[0][0] = String(rows[0][0] || "").replace(/^\uFEFF/, "");
  }

  return rows;
};

const CONFIG = {
  supplies: {
    label: "Office Supplies",
    model: InventoryOfficeSupply,
    uniqueField: "stock_no",
    required: [
      "stock_no",
      "itemName",
      "classification",
      "unitofmeasure",
      "balance_qty",
      "balance_unit_cost",
      "project",
      "date",
    ],
    optional: ["remarks", "lowstock_threshold", "status", "disposed_qty"],
    numeric: [
      "stock_no",
      "balance_qty",
      "balance_unit_cost",
      "lowstock_threshold",
      "disposed_qty",
    ],
    dates: ["date"],
    aliases: {
      stock_no: ["stock_no", "stockno", "stock no"],
      itemName: ["itemname", "item_name", "item name", "description", "item"],
      classification: ["classification", "category"],
      unitofmeasure: ["unitofmeasure", "unit_of_measure", "unit of measure", "uom", "unit"],
      balance_qty: ["balance_qty", "qty", "quantity", "balance qty", "stock_qty"],
      balance_unit_cost: ["balance_unit_cost", "unit_cost", "unit cost", "unit price"],
      lowstock_threshold: [
        "lowstock_threshold",
        "low stock threshold",
        "threshold",
      ],
      disposed_qty: ["disposed_qty", "disposed qty", "disposed_quantity", "disposed quantity"],
      project: ["project"],
      remarks: ["remarks", "notes"],
      date: ["date", "date_acquired", "date acquired"],
      status: ["status"],
    },
  },
  users: {
    label: "Users",
    model: User,
    required: [
      "username",
      "email",
      "password",
      "position",
      "designation",
      "project",
    ],
    optional: ["active"],
    numeric: [],
    dates: [],
    booleans: ["active"],
    caseInsensitiveUnique: ["email"],
    aliases: {
      username: ["username", "full_name", "full name", "display_name", "display name", "name"],
      email: ["email", "email_address", "email address"],
      password: ["password", "initial_password", "initial password"],
      position: ["position", "job_title", "job title"],
      designation: ["designation", "office"],
      project: ["project"],
      active: ["active", "is_active", "enabled"],
    },
  },
  equipment: {
    label: "Office Equipment",
    model: InventoryOfficeEquipment,
    uniqueField: "property_no",
    required: [
      "itemName",
      "classification",
      "unitofmeasure",
      "qty",
    ],
    optional: [
      "property_no",
      "item_no",
      "serial_no",
      "batch_no",
      "specifications",
      "asset_type",
      "asset_id",
      "unit_cost",
      "project",
      "date_acquired",
      "status",
      "requeststatus",
      "transfertype",
      "issued_to",
      "current_holder",
      "current_holder_id",
      "transfered_to",
      "transfered_to_id",
      "stored_to",
      "date_issued",
      "date_requested",
      "date_approved",
      "date_released",
      "date_received",
      "ics_no",
      "ptr_no",
      "inclusions",
      "reason",
      "remarks",
    ],
    numeric: ["qty", "unit_cost"],
    dates: [
      "date_acquired",
      "date_issued",
      "date_requested",
      "date_approved",
      "date_released",
      "date_received",
    ],
    userIdFields: [
      "issued_to",
      "current_holder_id",
      "transfered_to_id",
    ],
    optionalUnique: ["asset_id"],
    aliases: {
      property_no: ["property_no", "property no", "propertyno"],
      item_no: ["item_no", "item no", "itemno"],
      itemName: ["itemname", "item_name", "item name", "description", "item"],
      classification: ["classification", "category"],
      unitofmeasure: ["unitofmeasure", "unit_of_measure", "unit of measure", "uom", "unit"],
      qty: ["qty", "quantity"],
      unit_cost: ["unit_cost", "unit cost", "unit price"],
      serial_no: ["serial_no", "serial no", "serial", "serial number"],
      batch_no: ["batch_no", "batch no", "batch", "batch number"],
      specifications: ["specifications", "specification", "specs"],
      asset_type: ["asset_type", "asset type", "asset category", "asset_class"],
      asset_id: ["asset_id", "asset id", "asset tag", "asset_tag"],
      project: ["project"],
      remarks: ["remarks", "notes"],
      date_acquired: ["date_acquired", "date acquired", "date"],
      status: ["status"],
      requeststatus: ["requeststatus", "request_status", "request status"],
      transfertype: ["transfertype", "transfer_type", "transfer type"],
      issued_to: [
        "issued_to",
        "issued to",
        "issuedto",
        "assignee",
        "assigned_to",
        "issued_to_id",
        "issued to id",
        "issuedto_id",
        "issuedtoid",
        "issued_id",
        "issued id",
      ],
      current_holder: ["current_holder", "current holder", "holder"],
      current_holder_id: ["current_holder_id", "current holder id", "holder_id", "holder id"],
      transfered_to: ["transfered_to", "transferred_to", "transfered to", "transferred to"],
      transfered_to_id: [
        "transfered_to_id",
        "transferred_to_id",
        "transfered to id",
        "transferred to id",
        "transfered_id",
        "transferred_id",
      ],
      stored_to: ["stored_to", "stored to", "storage_to", "storage to"],
      date_issued: ["date_issued", "date issued", "issued_date"],
      date_requested: ["date_requested", "date requested", "requested_date"],
      date_approved: ["date_approved", "date approved", "approved_date"],
      date_released: ["date_released", "date released", "released_date"],
      date_received: ["date_received", "date received", "received_date"],
      ics_no: ["ics_no", "ics no", "ics number"],
      ptr_no: ["ptr_no", "ptr no", "ptr number"],
      inclusions: ["inclusions", "inclusion", "included"],
      reason: ["reason"],
    },
  },
  furniture: {
    label: "Furniture & Fixtures",
    model: InventoryOfficeFurnitureandFixture,
    uniqueField: "property_no",
    required: [
      "itemName",
      "classification",
      "unitofmeasure",
      "qty",
    ],
    optional: [
      "property_no",
      "item_no",
      "serial_no",
      "batch_no",
      "specifications",
      "asset_type",
      "asset_id",
      "unit_cost",
      "project",
      "date_acquired",
      "status",
      "requeststatus",
      "transfertype",
      "issued_to",
      "current_holder",
      "current_holder_id",
      "transfered_to",
      "transfered_to_id",
      "stored_to",
      "date_issued",
      "date_requested",
      "date_approved",
      "date_released",
      "date_received",
      "ics_no",
      "ptr_no",
      "inclusions",
      "reason",
      "remarks",
    ],
    numeric: ["qty", "unit_cost"],
    dates: [
      "date_acquired",
      "date_issued",
      "date_requested",
      "date_approved",
      "date_released",
      "date_received",
    ],
    userIdFields: [
      "issued_to",
      "current_holder_id",
      "transfered_to_id",
    ],
    optionalUnique: ["asset_id"],
    aliases: {
      property_no: ["property_no", "property no", "propertyno"],
      item_no: ["item_no", "item no", "itemno"],
      itemName: ["itemname", "item_name", "item name", "description", "item"],
      classification: ["classification", "category"],
      unitofmeasure: ["unitofmeasure", "unit_of_measure", "unit of measure", "uom", "unit"],
      qty: ["qty", "quantity"],
      unit_cost: ["unit_cost", "unit cost", "unit price"],
      serial_no: ["serial_no", "serial no", "serial", "serial number"],
      batch_no: ["batch_no", "batch no", "batch", "batch number"],
      specifications: ["specifications", "specification", "specs"],
      asset_type: ["asset_type", "asset type", "asset category", "asset_class"],
      asset_id: ["asset_id", "asset id", "asset tag", "asset_tag"],
      project: ["project"],
      remarks: ["remarks", "notes"],
      date_acquired: ["date_acquired", "date acquired", "date"],
      status: ["status"],
      requeststatus: ["requeststatus", "request_status", "request status"],
      transfertype: ["transfertype", "transfer_type", "transfer type"],
      issued_to: [
        "issued_to",
        "issued to",
        "issuedto",
        "assignee",
        "assigned_to",
        "issued_to_id",
        "issued to id",
        "issuedto_id",
        "issuedtoid",
        "issued_id",
        "issued id",
      ],
      current_holder: ["current_holder", "current holder", "holder"],
      current_holder_id: ["current_holder_id", "current holder id", "holder_id", "holder id"],
      transfered_to: ["transfered_to", "transferred_to", "transfered to", "transferred to"],
      transfered_to_id: [
        "transfered_to_id",
        "transferred_to_id",
        "transfered to id",
        "transferred to id",
        "transfered_id",
        "transferred_id",
      ],
      stored_to: ["stored_to", "stored to", "storage_to", "storage to"],
      date_issued: ["date_issued", "date issued", "issued_date"],
      date_requested: ["date_requested", "date requested", "requested_date"],
      date_approved: ["date_approved", "date approved", "approved_date"],
      date_released: ["date_released", "date released", "released_date"],
      date_received: ["date_received", "date received", "received_date"],
      ics_no: ["ics_no", "ics no", "ics number"],
      ptr_no: ["ptr_no", "ptr no", "ptr number"],
      inclusions: ["inclusions", "inclusion", "included"],
      reason: ["reason"],
    },
  },
  ict: {
    label: "ICT Equipment",
    model: InventoryOfficeICTEquipment,
    uniqueField: "property_no",
    required: [
      "itemName",
      "classification",
      "unitofmeasure",
      "qty",
    ],
    optional: [
      "property_no",
      "item_no",
      "serial_no",
      "batch_no",
      "specifications",
      "asset_type",
      "asset_id",
      "unit_cost",
      "project",
      "date_acquired",
      "status",
      "requeststatus",
      "transfertype",
      "issued_to",
      "current_holder",
      "current_holder_id",
      "transfered_to",
      "transfered_to_id",
      "stored_to",
      "date_issued",
      "date_requested",
      "date_approved",
      "date_released",
      "date_received",
      "ics_no",
      "ptr_no",
      "inclusions",
      "reason",
      "remarks",
    ],
    numeric: ["qty", "unit_cost"],
    dates: [
      "date_acquired",
      "date_issued",
      "date_requested",
      "date_approved",
      "date_released",
      "date_received",
    ],
    userIdFields: [
      "issued_to",
      "current_holder_id",
      "transfered_to_id",
    ],
    optionalUnique: ["asset_id"],
    aliases: {
      property_no: ["property_no", "property no", "propertyno"],
      item_no: ["item_no", "item no", "itemno"],
      itemName: ["itemname", "item_name", "item name", "description", "item"],
      classification: ["classification", "category"],
      unitofmeasure: ["unitofmeasure", "unit_of_measure", "unit of measure", "uom", "unit"],
      qty: ["qty", "quantity"],
      unit_cost: ["unit_cost", "unit cost", "unit price"],
      serial_no: ["serial_no", "serial no", "serial", "serial number"],
      batch_no: ["batch_no", "batch no", "batch", "batch number"],
      specifications: ["specifications", "specification", "specs"],
      asset_type: ["asset_type", "asset type", "asset category", "asset_class"],
      asset_id: ["asset_id", "asset id", "asset tag", "asset_tag"],
      project: ["project"],
      remarks: ["remarks", "notes"],
      date_acquired: ["date_acquired", "date acquired", "date"],
      status: ["status"],
      requeststatus: ["requeststatus", "request_status", "request status"],
      transfertype: ["transfertype", "transfer_type", "transfer type"],
      issued_to: [
        "issued_to",
        "issued to",
        "issuedto",
        "assignee",
        "assigned_to",
        "issued_to_id",
        "issued to id",
        "issuedto_id",
        "issuedtoid",
        "issued_id",
        "issued id",
      ],
      current_holder: ["current_holder", "current holder", "holder"],
      current_holder_id: ["current_holder_id", "current holder id", "holder_id", "holder id"],
      transfered_to: ["transfered_to", "transferred_to", "transfered to", "transferred to"],
      transfered_to_id: [
        "transfered_to_id",
        "transferred_to_id",
        "transfered to id",
        "transferred to id",
        "transfered_id",
        "transferred_id",
      ],
      stored_to: ["stored_to", "stored to", "storage_to", "storage to"],
      date_issued: ["date_issued", "date issued", "issued_date"],
      date_requested: ["date_requested", "date requested", "requested_date"],
      date_approved: ["date_approved", "date approved", "approved_date"],
      date_released: ["date_released", "date released", "released_date"],
      date_received: ["date_received", "date received", "received_date"],
      ics_no: ["ics_no", "ics no", "ics number"],
      ptr_no: ["ptr_no", "ptr no", "ptr number"],
      inclusions: ["inclusions", "inclusion", "included"],
      reason: ["reason"],
    },
  },
};

const getConfig = (category) => {
  const key = String(category || "").toLowerCase().trim();
  return CONFIG[key] || null;
};

const mapHeaders = (headers, config) => {
  const errors = [];
  const mapping = [];
  const aliases = config.aliases || {};
  const aliasMap = {};
  Object.entries(aliases).forEach(([target, list]) => {
    list.forEach((alias) => {
      aliasMap[normalizeHeader(alias)] = target;
    });
  });

  headers.forEach((header, idx) => {
    const norm = normalizeHeader(header);
    const mapped = aliasMap[norm];
    if (!mapped) {
      errors.push({
        row: 1,
        field: header,
        message: `Unknown column "${header}".`,
      });
      mapping[idx] = null;
    } else {
      mapping[idx] = mapped;
    }
  });

  return { mapping, errors };
};

const coerceNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(String(value).replace(/,/g, "").trim());
  if (!Number.isFinite(num)) return null;
  return num;
};

const normalizeLooseText = (value) => String(value || "").trim();

const parseNumericIdentifier = (value) => {
  const raw = normalizeLooseText(value);
  if (!raw || !/^\d+$/.test(raw)) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
};

const buildExactStringExpr = (field, value) => ({
  $expr: {
    $eq: [{ $trim: { input: { $toString: `$${field}` } } }, normalizeLooseText(value)],
  },
});

const getNextNumericIdentifier = async (model, field) => {
  const docs = await model.find({ [field]: { $ne: null } }).select(field).lean();
  let max = 0;
  docs.forEach((doc) => {
    const numeric = parseNumericIdentifier(doc?.[field]);
    if (numeric !== null && numeric > max) {
      max = numeric;
    }
  });
  return max + 1;
};

const normalizeFlowStatus = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const deriveRequestStatus = ({ status, hasIssuedTo, hasTransferTarget }) => {
  const normalizedStatus = normalizeFlowStatus(status);

  if (normalizedStatus === "issued") return "Issued";
  if (normalizedStatus === "transferred" || normalizedStatus === "trasferred") {
    return "Transferred";
  }
  if (
    normalizedStatus === "for issue" ||
    normalizedStatus === "for issuance" ||
    normalizedStatus === "for transfer"
  ) {
    return "For Approval";
  }

  if (!normalizedStatus && (hasTransferTarget || hasIssuedTo)) {
    return "For Approval";
  }

  return null;
};

const coerceBoolean = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return null;
};

const validateRows = async (config, rows, mapping) => {
  const errors = [];
  const cleaned = [];
  const existingMatches = [];
  const seenUnique = new Map();
  const optionalUniqueFields = config.optionalUnique || [];
  const caseInsensitiveUniqueFields = config.caseInsensitiveUnique || [];
  const optionalUniqueSeen = optionalUniqueFields.reduce((acc, field) => {
    acc[field] = new Map();
    return acc;
  }, {});
  const caseInsensitiveSeen = caseInsensitiveUniqueFields.reduce((acc, field) => {
    acc[field] = new Map();
    return acc;
  }, {});

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const record = {};
    const rowErrors = [];

    row.forEach((value, idx) => {
      const field = mapping[idx];
      if (!field) return;
      const trimmed = typeof value === "string" ? value.trim() : value;
      if (trimmed === "") return;
      if (
        record[field] !== undefined &&
        String(record[field]).trim() !== String(trimmed).trim()
      ) {
        rowErrors.push({
          field,
          message: `Conflicting values found for "${field}" in the same row.`,
        });
        return;
      }
      record[field] = trimmed;
    });

    const hasAnyField = Object.keys(record).length > 0;
    if (!hasAnyField) return;

    if (record.email !== undefined && record.email !== null && record.email !== "") {
      record.email = normalizeEmail(record.email);
    }

    // Normalize user-id columns so CSV can use *_id variants.
    if (record.issued_to_id !== undefined && record.issued_to_id !== null && record.issued_to_id !== "") {
      record.issued_to = record.issued_to_id;
    } else if (record.issued_to !== undefined && record.issued_to !== null && record.issued_to !== "") {
      record.issued_to_id = record.issued_to;
    }

    if (
      record.transfered_to_id !== undefined &&
      record.transferred_to_id !== undefined &&
      String(record.transfered_to_id).trim() !== String(record.transferred_to_id).trim()
    ) {
      rowErrors.push({
        field: "transfered_to_id",
        message: "transfered_to_id and transferred_to_id must match when both are provided.",
      });
    }
    if (record.transfered_to_id === undefined && record.transferred_to_id !== undefined) {
      record.transfered_to_id = record.transferred_to_id;
    }
    if (record.transferred_to_id === undefined && record.transfered_to_id !== undefined) {
      record.transferred_to_id = record.transfered_to_id;
    }
    if (record.transfered_to === undefined && record.transfered_to_id !== undefined) {
      record.transfered_to = record.transfered_to_id;
    }
    if (record.current_holder === undefined && record.current_holder_id !== undefined) {
      record.current_holder = record.current_holder_id;
    }

    config.required.forEach((field) => {
      if (record[field] === undefined || record[field] === null || record[field] === "") {
        rowErrors.push({ field, message: "Required field is missing." });
      }
    });

    config.numeric.forEach((field) => {
      if (record[field] === undefined || record[field] === "") return;
      const num = coerceNumber(record[field]);
      if (num === null || num < 0) {
        rowErrors.push({ field, message: "Must be a valid non-negative number." });
      } else {
        record[field] = num;
      }
    });

    (config.booleans || []).forEach((field) => {
      if (record[field] === undefined || record[field] === "") return;
      const bool = coerceBoolean(record[field]);
      if (bool === null) {
        rowErrors.push({
          field,
          message: "Must be a valid boolean value (true/false, yes/no, 1/0).",
        });
      } else {
        record[field] = bool;
      }
    });

    config.dates.forEach((field) => {
      if (record[field] === undefined || record[field] === null || record[field] === "") return;
      const parsed = parseDateValue(record[field]);
      if (!parsed) {
        rowErrors.push({
          field,
          message: "Invalid date format. Use YYYY-MM-DD or Excel serial.",
        });
      } else {
        record[field] = parsed;
      }
    });

    if (config === CONFIG.users) {
      if (record.email && !EMAIL_REGEX.test(record.email)) {
        rowErrors.push({
          field: "email",
          message: "Must be a valid email address.",
        });
      }

      if (record.password && !PASSWORD_POLICY.test(String(record.password))) {
        rowErrors.push({
          field: "password",
          message:
            "Password must be 8+ characters and include an uppercase letter, a number, and a special character.",
        });
      }
    }

    const uniqueField = config.uniqueField;
    if (uniqueField && record[uniqueField] !== undefined) {
      const key = String(record[uniqueField]);
      if (seenUnique.has(key)) {
        rowErrors.push({
          field: uniqueField,
          message: `Duplicate ${uniqueField} within CSV.`,
        });
      } else {
        seenUnique.set(key, rowNumber);
      }
    }

    optionalUniqueFields.forEach((field) => {
      const value = record[field];
      if (value === undefined || value === null || value === "") return;
      const key = String(value);
      const seenMap = optionalUniqueSeen[field];
      if (seenMap.has(key)) {
        rowErrors.push({
          field,
          message: `Duplicate ${field} within CSV.`,
        });
      } else {
        seenMap.set(key, rowNumber);
      }
    });

    caseInsensitiveUniqueFields.forEach((field) => {
      const value = record[field];
      if (value === undefined || value === null || value === "") return;
      const key = String(value).trim().toLowerCase();
      const seenMap = caseInsensitiveSeen[field];
      if (seenMap.has(key)) {
        rowErrors.push({
          field,
          message: `Duplicate ${field} within CSV.`,
        });
      } else {
        seenMap.set(key, rowNumber);
      }
    });

    if (rowErrors.length) {
      rowErrors.forEach((err) =>
        errors.push({ row: rowNumber, field: err.field, message: err.message })
      );
    } else {
      cleaned.push({ rowNumber, record });
    }
  });

  const userIdFields = Array.from(
    new Set([...(config.userIdFields || []), ...(config.userFields || [])])
  );
  if (userIdFields.length) {
    const entries = [];
    cleaned.forEach((row) => {
      userIdFields.forEach((field) => {
        const value = row.record[field];
        if (value === undefined || value === null || value === "") return;
        entries.push({
          row: row.rowNumber,
          field,
          value: String(value).trim(),
        });
      });
    });

    const invalidEntries = entries.filter((entry) => !OBJECT_ID_REGEX.test(entry.value));
    invalidEntries.forEach((entry) => {
      errors.push({
        row: entry.row,
        field: entry.field,
        message: `${entry.field} must be a valid user id.`,
      });
    });

    const validIds = Array.from(
      new Set(entries.filter((entry) => OBJECT_ID_REGEX.test(entry.value)).map((entry) => entry.value))
    );
    if (validIds.length) {
      const existingUsers = await User.find({ _id: { $in: validIds } })
        .select("_id")
        .lean();
      const existingSet = new Set(existingUsers.map((u) => String(u._id)));
      entries.forEach((entry) => {
        if (!OBJECT_ID_REGEX.test(entry.value)) return;
        if (!existingSet.has(entry.value)) {
          errors.push({
            row: entry.row,
            field: entry.field,
            message: `${entry.field} does not match an existing user.`,
          });
        }
      });
    }
  }

  if (config.required.includes("project") || config.optional.includes("project")) {
    await ensureProjectDefaults();
    const projectNames = cleaned
      .map((row) => row.record.project)
      .filter((v) => v !== undefined && v !== null && v !== "");
    const uniqueProjects = Array.from(
      new Set(projectNames.map((name) => normalizeProjectName(name)))
    );
    if (uniqueProjects.length) {
      const projectDocs = await Project.find({
        normalized: { $in: uniqueProjects },
      })
        .select("normalized active")
        .lean();
      const activeSet = new Set(
        projectDocs.filter((p) => p.active).map((p) => p.normalized)
      );
      const inactiveSet = new Set(
        projectDocs.filter((p) => !p.active).map((p) => p.normalized)
      );
      cleaned.forEach((row) => {
        const name = row.record.project;
        if (!name) return;
        const normalized = normalizeProjectName(name);
        if (inactiveSet.has(normalized)) {
          errors.push({
            row: row.rowNumber,
            field: "project",
            message: "Project exists but is inactive.",
          });
          return;
        }
        if (!activeSet.has(normalized)) {
          errors.push({
            row: row.rowNumber,
            field: "project",
            message: "Project does not exist in the system.",
          });
        }
      });
    }
  }

  if (config.required.includes("designation") || config.optional.includes("designation")) {
    await ensureDesignationDefaults();
    const designationNames = cleaned
      .map((row) => row.record.designation)
      .filter((v) => v !== undefined && v !== null && v !== "");
    const uniqueDesignations = Array.from(
      new Set(designationNames.map((name) => normalizeDesignationName(name)))
    );
    if (uniqueDesignations.length) {
      const designationDocs = await Designation.find({
        normalized: { $in: uniqueDesignations },
      })
        .select("normalized active")
        .lean();
      const activeSet = new Set(
        designationDocs.filter((d) => d.active).map((d) => d.normalized)
      );
      const inactiveSet = new Set(
        designationDocs.filter((d) => !d.active).map((d) => d.normalized)
      );
      cleaned.forEach((row) => {
        const name = row.record.designation;
        if (!name) return;
        const normalized = normalizeDesignationName(name);
        if (inactiveSet.has(normalized)) {
          errors.push({
            row: row.rowNumber,
            field: "designation",
            message: "Designation exists but is inactive.",
          });
          return;
        }
        if (!activeSet.has(normalized)) {
          errors.push({
            row: row.rowNumber,
            field: "designation",
            message: "Designation does not exist in the system.",
          });
        }
      });
    }
  }

  if (config.uniqueField) {
    const uniqueValues = cleaned
      .map((r) => r.record[config.uniqueField])
      .filter((v) => v !== undefined && v !== null);
    if (uniqueValues.length) {
      const existing = await config.model
        .find({
          $or: uniqueValues.map((value) => buildExactStringExpr(config.uniqueField, value)),
        })
        .select(config.uniqueField)
        .lean();
      const existingSet = new Set(
        existing.map((doc) => normalizeLooseText(doc[config.uniqueField]))
      );
      cleaned.forEach((row) => {
        const val = row.record[config.uniqueField];
        if (existingSet.has(normalizeLooseText(val))) {
          errors.push({
            row: row.rowNumber,
            field: config.uniqueField,
            message: `${config.uniqueField} already exists in the database.`,
          });
        }
      });
    }
  }

  if (optionalUniqueFields.length) {
    for (const field of optionalUniqueFields) {
      const values = cleaned
        .map((r) => r.record[field])
        .filter((v) => v !== undefined && v !== null && v !== "");
      if (!values.length) continue;
      const existing = await config.model
        .find({ [field]: { $in: values } })
        .select(field)
        .lean();
      const existingSet = new Set(existing.map((doc) => String(doc[field])));
      cleaned.forEach((row) => {
        const val = row.record[field];
        if (val === undefined || val === null || val === "") return;
        if (existingSet.has(String(val))) {
          errors.push({
            row: row.rowNumber,
            field,
            message: `${field} already exists in the database.`,
          });
        }
      });
    }
  }

  if (caseInsensitiveUniqueFields.length) {
    for (const field of caseInsensitiveUniqueFields) {
      const values = cleaned
        .map((r) => r.record[field])
        .filter((v) => v !== undefined && v !== null && v !== "");
      if (!values.length) continue;

      const existing = await config.model
        .find({
          $or: values.map((value) => ({
            [field]: new RegExp(`^${escapeRegex(value)}$`, "i"),
          })),
        })
        .select(config === CONFIG.users && field === "email" ? "_id email username role active" : field)
        .lean();

      const existingMap = new Map(
        existing.map((doc) => [
          String(doc[field] || "").trim().toLowerCase(),
          doc,
        ])
      );
      const existingSet = new Set(
        existing.map((doc) => String(doc[field] || "").trim().toLowerCase())
      );

      cleaned.forEach((row) => {
        const val = row.record[field];
        if (val === undefined || val === null || val === "") return;
        if (existingSet.has(String(val).trim().toLowerCase())) {
          if (config === CONFIG.users && field === "email") {
            existingMatches.push({
              row: row.rowNumber,
              field,
              email: val,
              existingUser: existingMap.get(String(val).trim().toLowerCase()) || null,
            });
          } else {
            errors.push({
              row: row.rowNumber,
              field,
              message: `${field} already exists in the database.`,
            });
          }
        }
      });
    }
  }

  return { errors, cleaned, existingMatches };
};

const buildDocuments = async (config, cleaned) => {
  if (config === CONFIG.users) {
    return Promise.all(
      cleaned.map(async ({ record }) => ({
        username: String(record.username || "").trim(),
        email: normalizeEmail(record.email),
        password: await bcrypt.hash(String(record.password || ""), 10),
        position: record.position || null,
        designation: record.designation || null,
        project: record.project || null,
        role: "employee",
        active: record.active !== undefined ? record.active : true,
      }))
    );
  }

  const model = config.model;
  const maxIdDoc = await model.findOne().sort({ id: -1 }).select("id").lean();
  let nextId = maxIdDoc?.id ? Number(maxIdDoc.id) + 1 : 1;
  let nextItemNo = await getNextNumericIdentifier(model, "item_no");
  let nextPropertyNo = await getNextNumericIdentifier(model, "property_no");

  return cleaned.map(({ record }) => {
    if (config === CONFIG.supplies) {
      const qty = Number(record.balance_qty || 0);
      const unitCost = Number(record.balance_unit_cost || 0);
      const total = qty * unitCost;
      const threshold =
        record.lowstock_threshold !== undefined && record.lowstock_threshold !== null
          ? Number(record.lowstock_threshold)
          : 10;
      const status = record.status
        ? String(record.status)
        : qty <= 0
        ? "Out of stock"
        : "Instock";

      return {
        id: nextId++,
        stock_no: Number(record.stock_no),
        itemName: record.itemName || null,
        classification: record.classification || null,
        unitofmeasure: record.unitofmeasure || null,
        lowstock_threshold: threshold,
        date: record.date || null,
        project: record.project || null,
        remarks: record.remarks || null,
        status,
        stock_qty: qty,
        stock_unit_cost: unitCost,
        stock_total_cost: total,
        purchase_qty: qty,
        purchase_unit_cost: unitCost,
        purchase_total_cost: total,
        distribution_qty: 0,
        distribution_unit_cost: 0,
        distribution_total_cost: 0,
        balance_qty: qty,
        balance_unit_cost: unitCost,
        balance_total_cost: total,
        disposed_qty:
          record.disposed_qty !== undefined && record.disposed_qty !== null
            ? Number(record.disposed_qty)
            : 0,
        archive: false,
      };
    }

    const qty = Number(record.qty || 0);
    const unitCost =
      record.unit_cost !== undefined && record.unit_cost !== null
        ? Number(record.unit_cost)
        : 0;
    const total = qty * unitCost;
    const issuedToId = record.issued_to_id || record.issued_to || null;
    const transferedToId = record.transfered_to_id || record.transferred_to_id || null;
    const currentHolderId =
      record.current_holder_id ||
      (record.current_holder && OBJECT_ID_REGEX.test(String(record.current_holder).trim())
        ? record.current_holder
        : null) ||
      issuedToId ||
      null;
    const hasIssuedTo =
      issuedToId !== undefined &&
      issuedToId !== null &&
      String(issuedToId).trim() !== "";
    const hasTransferTarget =
      transferedToId !== undefined &&
      transferedToId !== null &&
      String(transferedToId).trim() !== "";
    const hasStatus =
      record.status !== undefined &&
      record.status !== null &&
      String(record.status).trim() !== "";
    const hasRequestStatus =
      record.requeststatus !== undefined &&
      record.requeststatus !== null &&
      String(record.requeststatus).trim() !== "";
    const status = hasStatus
      ? String(record.status).trim()
      : hasTransferTarget
      ? "For Transfer"
      : hasIssuedTo
      ? "For Issue"
      : "In Stock";
    const requeststatus = hasRequestStatus
      ? String(record.requeststatus).trim()
      : deriveRequestStatus({ status, hasIssuedTo, hasTransferTarget });
    const dateRequested =
      record.date_requested || (requeststatus === "For Approval" ? new Date() : null);
    const itemNo =
      record.item_no !== undefined &&
      record.item_no !== null &&
      String(record.item_no).trim() !== ""
        ? String(record.item_no).trim()
        : String(nextItemNo++);
    const propertyNo =
      record.property_no !== undefined &&
      record.property_no !== null &&
      String(record.property_no).trim() !== ""
        ? String(record.property_no).trim()
        : String(nextPropertyNo++);

    const parsedItemNo = parseNumericIdentifier(itemNo);
    if (parsedItemNo !== null && parsedItemNo >= nextItemNo) {
      nextItemNo = parsedItemNo + 1;
    }

    const parsedPropertyNo = parseNumericIdentifier(propertyNo);
    if (parsedPropertyNo !== null && parsedPropertyNo >= nextPropertyNo) {
      nextPropertyNo = parsedPropertyNo + 1;
    }

    return {
      id: nextId++,
      item_no: itemNo,
      property_no: propertyNo,
      public_qr_token: crypto.randomBytes(16).toString("hex"),
      qty,
      itemName: record.itemName || null,
      serial_no: record.serial_no || null,
      batch_no: record.batch_no || null,
      asset_type: record.asset_type || null,
      classification: record.classification || null,
      unitofmeasure: record.unitofmeasure || null,
      status,
      requeststatus,
      transfertype: record.transfertype || null,
      unit_cost: unitCost,
      total_cost: total,
      date_acquired: record.date_acquired || null,
      date_requested: dateRequested,
      date_approved: record.date_approved || null,
      date_released: record.date_released || null,
      date_received: record.date_received || null,
      date_issued: record.date_issued || null,
      issued_to: issuedToId,
      issued_to_id: issuedToId,
      current_holder: record.current_holder || issuedToId || null,
      current_holder_id: currentHolderId,
      transfered_to: record.transfered_to || transferedToId || null,
      transfered_to_id: transferedToId,
      transferred_to_id: transferedToId,
      stored_to: record.stored_to || null,
      project: record.project || "Not Applicable",
      remarks: record.remarks || null,
      reason: record.reason || null,
      inclusions: record.inclusions || null,
      specifications: record.specifications || null,
      ics_no: record.ics_no || null,
      ptr_no: record.ptr_no || null,
      archive: false,
      ...(record.asset_id ? { asset_id: record.asset_id } : {}),
    };
  });
};

const buildPreviewRows = (config, cleaned) =>
  cleaned.slice(0, 5).map(({ record }) => {
    if (config === CONFIG.users) {
      return {
        ...record,
        password: record.password ? "••••••••" : "",
        active: record.active !== undefined ? String(record.active) : "",
      };
    }
    return record;
  });

const buildUserInsertDocument = async (record) => ({
  username: String(record.username || "").trim(),
  email: normalizeEmail(record.email),
  password: await bcrypt.hash(String(record.password || ""), 10),
  position: record.position || null,
  designation: record.designation || null,
  project: record.project || null,
  role: "employee",
  active: record.active !== undefined ? record.active : true,
});

const buildUserUpdatePayload = async (record) => {
  const payload = {
    username: String(record.username || "").trim(),
    email: normalizeEmail(record.email),
    password: await bcrypt.hash(String(record.password || ""), 10),
    position: record.position || null,
    designation: record.designation || null,
    project: record.project || null,
  };

  if (record.active !== undefined) {
    payload.active = record.active;
  }

  return payload;
};

const parseAndValidate = async (req) => {
  const category = req.query?.category || req.body?.category;
  const config = getConfig(category);
  if (!config) {
    return { error: "Invalid or missing category." };
  }
  const file = req.file;
  if (!file?.buffer) {
    return { error: "CSV file is required." };
  }
  const text = file.buffer.toString("utf8");
  const rows = parseCsv(text);
  if (!rows.length) {
    return { error: "CSV appears to be empty." };
  }

  const headers = rows[0];
  const bodyRows = rows.slice(1);
  const { mapping, errors: headerErrors } = mapHeaders(headers, config);
  const { errors: rowErrors, cleaned, existingMatches } = await validateRows(
    config,
    bodyRows,
    mapping
  );

  const errors = [...headerErrors, ...rowErrors];
  return {
    config,
    errors,
    cleaned,
    existingMatches,
    totalRows: bodyRows.length,
  };
};

export const validateCsvImport = async (req, res) => {
  try {
    const result = await parseAndValidate(req);
    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    const preview = buildPreviewRows(result.config, result.cleaned);
    const existingCount = result.config === CONFIG.users ? result.existingMatches.length : 0;
    const newCount =
      result.config === CONFIG.users
        ? Math.max(result.cleaned.length - existingCount, 0)
        : result.cleaned.length;
    return res.status(200).json({
      success: result.errors.length === 0,
      errors: result.errors,
      totalRows: result.totalRows,
      validRows: result.cleaned.length,
      preview,
      category: result.config.label,
      existingCount,
      newCount,
      requiresUpdateConfirmation: existingCount > 0,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to validate CSV." });
  }
};

export const importCsvData = async (req, res) => {
  try {
    const result = await parseAndValidate(req);
    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }
    if (result.errors.length) {
      return res.status(400).json({
        success: false,
        message: "CSV has validation errors.",
        errors: result.errors,
      });
    }

    const updateExisting =
      String(req.query?.updateExisting || req.body?.updateExisting || "")
        .trim()
        .toLowerCase() === "true" ||
      String(req.query?.updateExisting || req.body?.updateExisting || "")
        .trim()
        .toLowerCase() === "1";

    if (
      result.config === CONFIG.users &&
      result.existingMatches.length > 0 &&
      !updateExisting
    ) {
      return res.status(409).json({
        success: false,
        requiresUpdateConfirmation: true,
        message: "Some users already exist. Confirm update to continue.",
        existingCount: result.existingMatches.length,
        newCount: Math.max(result.cleaned.length - result.existingMatches.length, 0),
        category: result.config.label,
      });
    }

    if (result.config === CONFIG.users) {
      const existingMap = new Map(
        result.existingMatches.map((match) => [
          normalizeEmail(match.email),
          match.existingUser,
        ])
      );

      const inserts = [];
      const updates = [];

      for (const { record } of result.cleaned) {
        const existingUser = existingMap.get(normalizeEmail(record.email));
        if (existingUser) {
          updates.push({
            updateOne: {
              filter: { _id: existingUser._id },
              update: { $set: await buildUserUpdatePayload(record) },
            },
          });
        } else {
          inserts.push(await buildUserInsertDocument(record));
        }
      }

      if (!inserts.length && !updates.length) {
        return res.status(400).json({ success: false, message: "No valid rows to import." });
      }

      const [inserted, updateResult] = await Promise.all([
        inserts.length ? result.config.model.insertMany(inserts, { ordered: true }) : [],
        updates.length ? result.config.model.bulkWrite(updates, { ordered: true }) : null,
      ]);

      const updatedCount = Number(updateResult?.matchedCount || 0);
      const insertedCount = Array.isArray(inserted) ? inserted.length : 0;

      await safeCreateLog({
        userId: actorFromReq(req),
        action: `CSV Import - ${result.config.label} (${insertedCount} inserted, ${updatedCount} updated)`,
        status: "success",
        time: nowISO(),
      });

      return res.status(201).json({
        success: true,
        insertedCount,
        updatedCount,
        category: result.config.label,
      });
    }

    const docs = await buildDocuments(result.config, result.cleaned);
    if (!docs.length) {
      return res.status(400).json({ success: false, message: "No valid rows to import." });
    }

    const inserted = await result.config.model.insertMany(docs, { ordered: true });
    await safeCreateLog({
      userId: actorFromReq(req),
      action: `CSV Import - ${result.config.label} (${inserted.length} items)`,
      status: "success",
      time: nowISO(),
    });

    return res.status(201).json({
      success: true,
      insertedCount: inserted.length,
      category: result.config.label,
    });
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.email) {
      return res.status(409).json({
        success: false,
        message: "Email already exists.",
        errors: [{ row: null, field: "email", message: "email already exists in the database." }],
      });
    }
    if (err?.code === 11000 && err?.keyPattern?.asset_id) {
      return res.status(409).json({
        success: false,
        message: "Duplicate asset_id found during import.",
        errors: [
          {
            row: null,
            field: "asset_id",
            message: "asset_id already exists in the database.",
          },
        ],
      });
    }
    await safeCreateLog({
      userId: actorFromReq(req),
      action: "CSV Import - Failed",
      status: "error",
      time: nowISO(),
    });
    return res.status(500).json({ success: false, message: "Failed to import CSV." });
  }
};
