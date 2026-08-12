// controllers/inventoryOfficeFurnitureandFixtureController.js
import InventoryOfficeFurnitureandFixture from "../models/InventoryOfficeFurnitureandFixture.js";
import SystemSettings from "../models/SystemSettings.js";
import { createLog } from "./logsController.js";
import Counter from "../models/Counter.js";
import crypto from "crypto";
import {
  removeSignedFile,
  removeSignedFileIfUnreferenced,
  signedFileExists,
  signedFileUrl,
} from "../utils/upload.js";
import { removeThumbnailFile, thumbnailFileUrl } from "../utils/thumbnailUpload.js";
import {
  buildFieldFilters,
  buildSearchFilter,
  buildStatusFilter,
  parsePagination,
} from "../utils/pagination.js";
import {
  buildIssuanceDocNumber,
  getPropertyTransferDocType,
  getStoredIssuanceDocType,
  resolveIssuanceDocType,
} from "../utils/issuanceDocuments.js";

/**
 * LOGGING NOTES:
 * - This adds Logs entries for CREATE / UPDATE / DELETE (and error cases).
 * - Best practice: set req.user in your auth middleware (JWT), then actorFromReq() will pick it up.
 * - If you don't have req.user yet, you can still pass the actor using:
 *     headers: { "x-user-email": userEmail }
 *   or include { userId } in req.body.
 */

/* ---------- helpers ---------- */
const nowISO = () => new Date().toISOString();
const SIGNED_PREV_TTL_DAYS = 7;
const signedPrevExpiryDate = () =>
  new Date(Date.now() + SIGNED_PREV_TTL_DAYS * 24 * 60 * 60 * 1000);
const isExpiredDate = (dateLike) =>
  !!dateLike && new Date(dateLike).getTime() <= Date.now();
const ASSET_CODE = "FT";
const DEFAULT_SE_THRESHOLD = 50000;

const pad = (num, size) => {
  let s = String(num);
  while (s.length < size) s = `0${s}`;
  return s;
};

const getAssetYear = (dateLike) => {
  const d = dateLike ? new Date(dateLike) : new Date();
  return Number.isFinite(d.getTime()) ? d.getFullYear() : new Date().getFullYear();
};

const getSeThreshold = async () => {
  const settings = await SystemSettings.findOne({ key: "global" }).lean();
  const raw = Number(settings?.se_threshold);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_SE_THRESHOLD;
};

const resolveAssetType = (unitCost, threshold) => {
  const cost = Number(unitCost);
  if (!Number.isFinite(cost)) return null;
  return cost >= threshold ? "PPE" : "SE";
};

const buildAssetId = async (assetType, year) => {
  const counterKey = `assetId.${assetType}.${ASSET_CODE}.${year}`;
  const counter = await Counter.findOneAndUpdate(
    { _id: counterKey },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  ).lean();
  return `${assetType}-${ASSET_CODE}-${year}-${pad(counter.seq, 6)}`;
};

const ensureAssetClassification = async (item) => {
  const threshold = await getSeThreshold();
  const assetType = resolveAssetType(item?.unit_cost, threshold);
  if (!assetType) return item;
  const year = getAssetYear(item?.date_acquired);
  const expectedPrefix = `${assetType}-${ASSET_CODE}-${year}-`;
  const currentId = item?.asset_id || "";

  item.asset_type = assetType;
  if (!currentId || !String(currentId).startsWith(expectedPrefix)) {
    item.asset_id = await buildAssetId(assetType, year);
  }
  return item;
};

const actorFromReq = (req) => {
  return (
    req?.user?.email ||
    req?.user?.username ||
    req?.user?.id ||
    req?.user?._id ||
    req?.body?.userId ||
    req?.body?.email ||
    req?.headers?.["x-user-email"] ||
    req?.headers?.["x-user-id"] ||
    "NA"
  );
};

const escapeRegExp = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeLooseText = (value) => String(value || "").trim();

const parseNumericIdentifier = (value) => {
  const raw = normalizeLooseText(value);
  if (!raw || !/^\d+$/.test(raw)) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
};

const getNextNumericIdentifier = async (field) => {
  const docs = await InventoryOfficeFurnitureandFixture.find({ [field]: { $ne: null } })
    .select(field)
    .lean();
  let max = 0;
  docs.forEach((doc) => {
    const numeric = parseNumericIdentifier(doc?.[field]);
    if (numeric !== null && numeric > max) max = numeric;
  });
  return max + 1;
};

const fmtItemLabel = (item) => {
  const pn = item?.property_no ?? "";
  const name = item?.itemName ?? "";
  const id = item?._id?.toString?.() || "";
  if (pn && name) return `PN:${pn} - ${name}`;
  if (name) return name;
  if (pn) return `PN:${pn}`;
  return id || "Item";
};

const safeCreateLog = async (logData) => {
  try {
    await createLog(logData);
  } catch (e) {
    // Never block the main request if logging fails
    console.error("LOGGING_ERROR:", e?.message || e);
  }
};

const ensurePublicToken = async (item) => {
  if (item?.public_qr_token) return item.public_qr_token;
  const token = crypto.randomBytes(16).toString("hex");
  item.public_qr_token = token;
  await item.save();
  return token;
};

const buildPublicPayload = (item) => ({
  _id: item?._id,
  item_no: item?.item_no,
  property_no: item?.property_no,
  itemName: item?.itemName,
  classification: item?.classification,
  unitofmeasure: item?.unitofmeasure,
  qty: item?.qty,
  status: item?.status,
  unit_cost: item?.unit_cost,
  total_cost: item?.total_cost,
  date_acquired: item?.date_acquired,
  date_issued: item?.date_issued,
  serial_no: item?.serial_no,
  specifications: item?.specifications,
  stored_to: item?.stored_to,
  project: item?.project,
  inclusions: item?.inclusions,
  remarks: item?.remarks,
  requeststatus: item?.requeststatus,
  disposal_reason: item?.disposal_reason,
  disposal_notes: item?.disposal_notes,
  public_qr_token: item?.public_qr_token,
});

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const fmtDelta = (fromVal, toVal) => {
  const f = num(fromVal);
  const t = num(toVal);
  if (f === null || t === null) return null;

  const d = t - f;
  const sign = d > 0 ? "+" : "";
  return `${f} → ${t} (${sign}${d})`;
};

const pickChange = (before, after, key, label) => {
  if (!before && !after) return null;
  const b = before?.[key];
  const a = after?.[key];

  const bd = num(b);
  const ad = num(a);
  if (bd === null && ad === null) return null;
  if (bd === ad) return null;

  const delta = fmtDelta(b, a);
  if (!delta) return null;
  return `${label}: ${delta}`;
};

const pickChangeText = (before, after, key, label) => {
  const b = (before?.[key] ?? "").toString();
  const a = (after?.[key] ?? "").toString();
  if (b === a) return null;
  return `${label}: "${b}" → "${a}"`;
};

const buildHistorySnapshot = (item) => ({
  itemName: item?.itemName ?? null,
  classification: item?.classification ?? null,
  property_no: item?.property_no ?? null,
  serial_no: item?.serial_no ?? null,
  specifications: item?.specifications ?? null,
  batch_no: item?.batch_no ?? null,
  qty: item?.qty ?? null,
  unitofmeasure: item?.unitofmeasure ?? null,
  unit_cost: item?.unit_cost ?? null,
  total_cost: item?.total_cost ?? null,
  project: item?.project ?? null,
  asset_type: item?.asset_type ?? null,
  ics_no: item?.ics_no ?? null,
  par_no: item?.par_no ?? null,
  ptr_no: item?.ptr_no ?? null,
  status: item?.status ?? null,
  requeststatus: item?.requeststatus ?? null,
  issued_to: item?.issued_to ?? null,
  current_holder: item?.current_holder ?? null,
  transfered_to: item?.transfered_to ?? null,
  transfer_type: item?.transfer_type ?? item?.transferType ?? item?.transfer_mode ?? null,
  transfer_target: item?.transfer_target ?? item?.transfer_to ?? null,
  stored_to: item?.stored_to ?? null,
  date_acquired: item?.date_acquired ?? null,
  date_requested: item?.date_requested ?? null,
  date_approved: item?.date_approved ?? null,
  date_released: item?.date_released ?? null,
  date_received: item?.date_received ?? null,
  date_issued: item?.date_issued ?? null,
  transfertype: item?.transfertype ?? null,
  inclusions: item?.inclusions ?? null,
  remarks: item?.remarks ?? null,
  reason: item?.reason ?? null,
  signed_file: item?.signed_file ?? null,
});

const buildChangeList = (before, after) => {
  const changes = [];
  const qtyChange = pickChange(before, after, "qty", "Qty");
  if (qtyChange) changes.push(qtyChange);

  const costFields = [
    ["unit_cost", "Unit Cost"],
    ["total_cost", "Total Cost"],
  ];
  costFields.forEach(([k, label]) => {
    const c = pickChange(before, after, k, label);
    if (c) changes.push(c);
  });

  const textFields = [
    ["issued_to", "Issued To"],
    ["current_holder", "Current Holder"],
    ["transfered_to", "Transferred To"],
    ["stored_to", "Stored To"],
    ["project", "Project"],
    ["classification", "Classification"],
    ["unitofmeasure", "Unit of Measure"],
    ["serial_no", "Serial No"],
    ["specifications", "Specifications"],
    ["batch_no", "Batch No"],
    ["remarks", "Remarks"],
    ["reason", "Reason"],
    ["inclusions", "Inclusions"],
    ["transfertype", "Transfer Type"],
  ];
  textFields.forEach(([k, label]) => {
    const c = pickChangeText(before, after, k, label);
    if (c) changes.push(c);
  });

  return changes;
};

const buildDocNumber = async (prefix) => {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const counter = await Counter.findOneAndUpdate(
    { _id: `${prefix}.${ym}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  const seq = String(counter.seq || 0).padStart(6, "0");
  return `${prefix}-${ym}-${seq}`;
};

const ensureDocNumbers = async (item) => {
  const status = String(item?.status || "").toLowerCase().trim();
  const updates = {};
  if (status === "for issue") {
    const issuanceDocType = await resolveIssuanceDocType(item);
    if (issuanceDocType === "PAR" && !item?.par_no) {
      updates.par_no = await buildIssuanceDocNumber("PAR", item?.date_requested);
    } else if (issuanceDocType === "ICS" && !item?.ics_no) {
      updates.ics_no = await buildIssuanceDocNumber("ICS", item?.date_requested);
    }
  }
  if (status === "for transfer") {
    const transferDocType = getPropertyTransferDocType(item);
    if (transferDocType === "ICS" && item?.ptr_no) {
      updates.ics_no = await buildIssuanceDocNumber("ICS", item?.date_requested);
      updates.ptr_no = null;
    } else if (transferDocType === "ICS" && !item?.ics_no) {
      updates.ics_no = await buildIssuanceDocNumber("ICS", item?.date_requested);
    } else if (transferDocType === "PTR" && !item?.ptr_no) {
      updates.ptr_no = await buildDocNumber("PTR");
    }
  }
  if (!Object.keys(updates).length) return item;
  return InventoryOfficeFurnitureandFixture.findByIdAndUpdate(
    item._id,
    { $set: updates },
    { new: true }
  );
};

const normalizeRole = (role) => String(role || "").trim().toLowerCase();
const getRoleFromReq = (req) =>
  req?.user?.role ||
  req?.user?.data?.role ||
  req?.user?.user?.role ||
  req?.headers?.["x-user-role"] ||
  "";
const isSuperAdmin = (req) => {
  const role = normalizeRole(getRoleFromReq(req));
  return role === "super admin" || role === "superadmin";
};
const clearExpiredPrevSignedFile = async (doc) => {
  if (!doc?.signed_file_prev?.stored_name) return false;
  if (!isExpiredDate(doc.signed_file_prev_expires_at)) return false;
  await removeSignedFileIfUnreferenced(
    doc.signed_file_prev.stored_name,
    doc.history
  );
  doc.signed_file_prev = null;
  doc.signed_file_prev_expires_at = null;
  await doc.save();
  return true;
};

const shouldRotateSignedOnStatus = (status) => {
  const s = String(status || "").trim().toLowerCase();
  if (!s) return false;
  return (
    s === "for issue" ||
    s === "for transfer" ||
    s === "for disposal" ||
    isReturnToInventoryStatus(s)
  );
};
const rotateSignedFile = async (doc) => {
  if (!doc?.signed_file?.url && !doc?.signed_file?.stored_name) return doc;
  if (doc?.signed_file_prev?.stored_name) {
    await removeSignedFileIfUnreferenced(
      doc.signed_file_prev.stored_name,
      doc.history
    );
  }
  await InventoryOfficeFurnitureandFixture.updateOne(
    { _id: doc._id },
    {
      $set: {
        signed_file_prev: doc.signed_file,
        signed_file_prev_expires_at: signedPrevExpiryDate(),
        signed_file: null,
      },
    }
  );
  return InventoryOfficeFurnitureandFixture.findById(doc._id);
};

const canDisposeRole = (role) => {
  const r = normalizeRole(role);
  return (
    r === "super admin" ||
    r === "superadmin" ||
    r === "inventory admin" ||
    r === "inventoryadmin" ||
    r === "afd"
  );
};

const isDisposalPayload = (body) => {
  const status = String(body?.status || "").trim().toLowerCase();
  return (
    status === "for disposal" ||
    status === "disposed" ||
    body?.disposal_reason !== undefined ||
    body?.disposal_notes !== undefined
  );
};

const isReturnToInventoryStatus = (status) =>
  String(status || "").toLowerCase().includes("return to inventory");

const resolveDocTypeFromSnapshot = (snapshot) => {
  const statusLower = String(snapshot?.status || "").toLowerCase();
  const transferType = String(
    snapshot?.transfer_type || snapshot?.transferType || snapshot?.transfer_mode || ""
  );
  const issuedToRef = String(snapshot?.issued_to_id ?? snapshot?.issued_to ?? "");
  const transferToRef = String(
    snapshot?.transfered_to_id ??
      snapshot?.transferred_to_id ??
      snapshot?.transfered_to ??
      ""
  );
  const isReturnToIssuedTransfer =
    (issuedToRef && transferToRef && issuedToRef === transferToRef) ||
    /return\s*to\s*issued/i.test(transferType);
  if (isReturnToIssuedTransfer) return getPropertyTransferDocType(snapshot);
  if (statusLower.includes("issue")) return getStoredIssuanceDocType(snapshot);
  if (statusLower.includes("transfer")) return getPropertyTransferDocType(snapshot);
  if (statusLower.includes("disposal")) return "PDR";
  if (isReturnToInventoryStatus(statusLower)) return "RTI";
  return null;
};

const snapshotSignature = (snap) => {
  if (!snap) return "";
  const picked = {
    status: snap.status ?? null,
    requeststatus: snap.requeststatus ?? null,
    issued_to: snap.issued_to ?? null,
    current_holder: snap.current_holder ?? null,
    transfered_to: snap.transfered_to ?? null,
    transfer_type: snap.transfer_type ?? null,
    transfer_target: snap.transfer_target ?? null,
    transfertype: snap.transfertype ?? null,
    date_requested: snap.date_requested ?? null,
    date_approved: snap.date_approved ?? null,
    date_released: snap.date_released ?? null,
    date_received: snap.date_received ?? null,
    date_checked: snap.date_checked ?? null,
    date_issued: snap.date_issued ?? null,
    disposal_reason: snap.disposal_reason ?? null,
    disposal_notes: snap.disposal_notes ?? null,
  };
  return JSON.stringify(picked);
};

const resolvePreviousSnapshot = (doc) => {
  if (!doc) return null;
  const history = Array.isArray(doc.history) ? doc.history : [];
  const currentSnapshot = buildHistorySnapshot(doc);
  const currentSig = snapshotSignature(currentSnapshot);
  const latest = history[history.length - 1];
  const latestRevertIndexRaw = latest?.revert_to_history_index;
  const latestRevertIndex = Number(latestRevertIndexRaw);
  const latestIsCurrentRevert =
    latest?.reason === "Reverted to previous state" &&
    latestRevertIndexRaw !== null &&
    latestRevertIndexRaw !== undefined &&
    Number.isInteger(latestRevertIndex) &&
    latestRevertIndex >= 0 &&
    snapshotSignature(latest?.doc_snapshot) === currentSig;
  const startIndex = latestIsCurrentRevert
    ? Math.min(latestRevertIndex - 1, history.length - 1)
    : history.length - 1;
  for (let i = startIndex; i >= 0; i -= 1) {
    const snap = history[i]?.doc_snapshot;
    if (!snap) continue;
    if (snapshotSignature(snap) !== currentSig) {
      return { snapshot: snap, historyIndex: i };
    }
  }
  return null;
};

const sanitizeRevertSnapshot = (snapshot) => {
  const cleaned = snapshot ? JSON.parse(JSON.stringify(snapshot)) : {};
  delete cleaned._id;
  delete cleaned.__v;
  delete cleaned.history;
  delete cleaned.createdAt;
  delete cleaned.updatedAt;
  delete cleaned.doc_generated_at;
  return cleaned;
};

const getUserIdentifiers = (req) => {
  const u = req?.user || {};
  return [
    u._id,
    u.id,
    u.userId,
    u.username,
    u.email,
  ]
    .filter(Boolean)
    .map(String);
};

const buildInvolvementFilter = (identifiers) => {
  if (!identifiers.length) return null;
  const fields = [
    "current_holder",
    "current_holder_id",
    "current_holder_is",
    "issued_to",
    "issued_to_id",
    "issued_to_is",
    "transfered_to",
    "transfered_to_id",
    "transfered_to_is",
    "transferred_to",
    "transferred_to_id",
    "transferred_to_is",
    "stored_to",
    "stored_to_id",
    "stored_to_is",
  ];
  const or = identifiers.flatMap((id) => fields.map((f) => ({ [f]: id })));
  return { $or: or };
};

/* -------------------- GET ALL -------------------- */
export const getAllInventory = async (req, res) => {
  try {
    const { page, limit, skip, hasPaging } = parsePagination(req, {
      page: 1,
      limit: 20,
    });
    const status = req.query?.status;
    const search = req.query?.search;
    const searchValue = String(search || "").trim();
    const searchNumber = Number(searchValue);
    const hasNumericSearch =
      searchValue !== "" && Number.isFinite(searchNumber);
    const fetchAll = ["1", "true", "yes"].includes(
      String(req.query?.all || "").trim().toLowerCase()
    );

    const fieldFilters = buildFieldFilters(
      req.query,
      [
        "property_no",
        "itemName",
        "classification",
        "serial_no",
        "specifications",
        "unit_cost",
        "status",
        "issued_to",
        "current_holder",
        "project",
        "stored_to",
      ],
      { prefix: "field_" }
    );

    const assetType = String(req.query?.asset_type || "").trim();
    const stringSearch = buildSearchFilter(searchValue, [
      "property_no",
      "itemName",
      "classification",
      "serial_no",
      "specifications",
      "asset_type",
      "asset_id",
      "batch_no",
      "project",
      "unitofmeasure",
      "status",
      "requeststatus",
      "issued_to",
      "current_holder",
      "transfered_to",
      "stored_to",
      "ics_no",
      "par_no",
      "ptr_no",
    ]);
    const numericSearch = hasNumericSearch
      ? [{ property_no: searchNumber }]
      : [];
    const combinedSearch =
      (stringSearch.$or && stringSearch.$or.length) || numericSearch.length
        ? { $or: [...(stringSearch.$or || []), ...numericSearch] }
        : {};

    const filter = {
      ...(status ? buildStatusFilter(status) : {}),
      ...combinedSearch,
      ...fieldFilters,
      ...(assetType
        ? {
            asset_type: new RegExp(`^${escapeRegExp(assetType)}$`, "i"),
          }
        : {}),
    };

    const role = normalizeRole(req?.user?.role);
    if (role === "employee") {
      const identifiers = getUserIdentifiers(req);
      const involvedFilter = buildInvolvementFilter(identifiers);
      const instockFilter = { status: /^(instock|in stock)$/i };
      const roleFilter = involvedFilter
        ? { $or: [instockFilter, involvedFilter] }
        : instockFilter;
      filter.$and = filter.$and || [];
      filter.$and.push(roleFilter);
    }

    if (fetchAll || !hasPaging) {
      const inventoryItems = await InventoryOfficeFurnitureandFixture.find(filter);
      return res.status(200).json(inventoryItems);
    }

    const [data, total] = await Promise.all([
      InventoryOfficeFurnitureandFixture.find(filter)
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit),
      InventoryOfficeFurnitureandFixture.countDocuments(filter),
    ]);

    return res.status(200).json({ data, total, page, limit });
  } catch (error) {
    console.error("Error fetching inventory:", error);

    await safeCreateLog({
      userId: actorFromReq(req),
      action: "Office Furniture & Fixtures - List",
      status: "error",
      time: nowISO(),
    });

    res.status(500).json({ error: "Internal server error" });
  }
};

/* -------------------- CREATE -------------------- */
export const createInventoryItem = async (req, res) => {
  try {
    const maxIdItem = await InventoryOfficeFurnitureandFixture.findOne(
      {},
      {},
      { sort: { id: -1 } }
    );
    const newId = maxIdItem ? maxIdItem.id + 1 : 1;
    const newItemNo = String(await getNextNumericIdentifier("item_no"));
    const newPropertyNo = String(await getNextNumericIdentifier("property_no"));

    let newItem = await InventoryOfficeFurnitureandFixture.create({
      ...req.body,
      id: newId,
      item_no: newItemNo,
      property_no: newPropertyNo,
      public_qr_token: crypto.randomBytes(16).toString("hex"),
    });

    newItem = await ensureAssetClassification(newItem);
    await newItem.save();
    newItem = await ensureDocNumbers(newItem);

    await safeCreateLog({
      userId: actorFromReq(req),
      action: `Office Furniture & Fixtures - Create (${fmtItemLabel(newItem)})`,
      status: "success",
      time: nowISO(),
    });

    res.status(201).json(newItem);
  } catch (error) {
    console.error("Error creating inventory item:", error);

    await safeCreateLog({
      userId: actorFromReq(req),
      action: "Office Furniture & Fixtures - Create",
      status: "error",
      time: nowISO(),
    });

    res.status(400).json({ error: "Invalid data provided" });
  }
};

/* -------------------- UPDATE -------------------- */
export const updateInventoryItem = async (req, res) => {
  const itemId = req.params.id;
  const isSuperAdminRole = (role) => {
    const key = String(role || "").trim().toLowerCase();
    return key === "super admin" || key === "superadmin";
  };

  try {
    const before = await InventoryOfficeFurnitureandFixture.findById(itemId);
    if (!before) {
      await safeCreateLog({
        userId: actorFromReq(req),
        action: `Office Furniture & Fixtures - Update (Not Found: ${itemId})`,
        status: "error",
        time: nowISO(),
      });
      return res.status(404).json({ error: "Inventory item not found" });
    }

    const version = req.body?.__v;
    if (version !== undefined && Number(before.__v) !== Number(version)) {
      return res.status(409).json({
        success: false,
        message: "Version conflict. Please refresh and try again.",
      });
    }

    if (isDisposalPayload(req.body) && !canDisposeRole(req?.user?.role)) {
      return res.status(403).json({
        success: false,
        message: "Only Super Admin or Inventory Admin can dispose items.",
      });
    }

    const updateData = { ...req.body };
    if ("__v" in updateData) delete updateData.__v;
    if ("asset_type" in updateData) delete updateData.asset_type;
    if ("asset_id" in updateData) delete updateData.asset_id;

    const nextStatusLower = String(updateData.status || "").toLowerCase().trim();
    const beforeStatusLower = String(before?.status || "").toLowerCase().trim();
    if (nextStatusLower === "for issue" && beforeStatusLower !== "for issue") {
      updateData.ics_no = null;
      updateData.par_no = null;
    }
    if (nextStatusLower === "for transfer" && beforeStatusLower !== "for transfer") {
      if (getPropertyTransferDocType(before) === "ICS") {
        updateData.ics_no = null;
        updateData.ptr_no = null;
      } else {
        updateData.ptr_no = null;
      }

      // Checkform prioritizes these legacy id aliases when resolving the
      // recipient, so they must never retain the previous holder's id.
      const transferType = String(updateData.transfer_type || "").toLowerCase();
      if (transferType.includes("dict user") && updateData.transfered_to) {
        updateData.transfered_to_id = updateData.transfered_to;
        updateData.transferred_to_id = updateData.transfered_to;
      } else if (transferType.includes("other agency")) {
        updateData.transfered_to_id = null;
        updateData.transferred_to_id = null;
      }
    }

    if ("status" in updateData) {
      if (isReturnToInventoryStatus(nextStatusLower) && beforeStatusLower !== "issued") {
        return res.status(400).json({
          success: false,
          message: "Only issued items can be returned to inventory.",
        });
      }
    }

    const restrictedFields = [
      "property_no",
      "unit_cost",
      "classification",
      "date_acquired",
      "serial_no",
      "specifications",
      "stored_to",
    ];
    const hasRestrictedUpdate = restrictedFields.some((field) =>
      Object.prototype.hasOwnProperty.call(updateData, field)
    );
    if (hasRestrictedUpdate && !isSuperAdminRole(req?.user?.role)) {
      return res.status(403).json({
        success: false,
        message: "Only Super Admin can edit core item details.",
      });
    }

    if (Object.prototype.hasOwnProperty.call(updateData, "property_no")) {
      const propNo = normalizeLooseText(updateData.property_no);
      if (!propNo) {
        return res.status(400).json({
          success: false,
          message: "Property number is required.",
        });
      }
      updateData.property_no = propNo;
      if (propNo !== normalizeLooseText(before.property_no)) {
        const duplicate = await InventoryOfficeFurnitureandFixture.findOne({
          _id: { $ne: itemId },
          $expr: {
            $eq: [{ $trim: { input: { $toString: "$property_no" } } }, propNo],
          },
        }).lean();
        if (duplicate) {
          return res.status(409).json({
            success: false,
            message: "Property number already exists.",
          });
        }
      }
    }

    let updatedItem = await InventoryOfficeFurnitureandFixture.findOneAndUpdate(
      { _id: itemId, ...(version !== undefined ? { __v: Number(version) } : {}) },
      {
        $set: updateData,
        $inc: { __v: 1 },
      },
      { new: true }
    );

    const shouldRecalcAsset =
      "unit_cost" in updateData ||
      "date_acquired" in updateData ||
      !updatedItem?.asset_type ||
      !updatedItem?.asset_id;
    if (shouldRecalcAsset) {
      const beforeAssetId = updatedItem?.asset_id || null;
      const beforeAssetType = updatedItem?.asset_type || null;
      updatedItem = await ensureAssetClassification(updatedItem);
      if (
        updatedItem?.asset_id !== beforeAssetId ||
        updatedItem?.asset_type !== beforeAssetType
      ) {
        await InventoryOfficeFurnitureandFixture.updateOne(
          { _id: updatedItem._id },
          {
            $set: {
              asset_id: updatedItem.asset_id,
              asset_type: updatedItem.asset_type,
            },
          }
        );
        updatedItem = await InventoryOfficeFurnitureandFixture.findById(updatedItem._id);
      }
    }

    updatedItem = await ensureDocNumbers(updatedItem);

    const beforeStatus = (before.status || "").toString();
    const afterStatus = (updatedItem?.status || "").toString();
    const beforeReqStatus = (before.requeststatus || "").toString();
    const afterReqStatus = (updatedItem?.requeststatus || "").toString();

    const statusChanged = beforeStatus !== afterStatus;
    const reqStatusChanged = beforeReqStatus !== afterReqStatus;

    const shouldRotateSigned = statusChanged && shouldRotateSignedOnStatus(afterStatus);

    if (shouldRotateSigned) {
      updatedItem = await rotateSignedFile(updatedItem);
    }

    let action = `Office Furniture & Fixtures - Update (${fmtItemLabel(
      updatedItem
    )})`;

    const changes = buildChangeList(before, updatedItem);

    // More descriptive logs for common workflow actions
    if (statusChanged) {
      const s = afterStatus.toLowerCase().trim();

      if (s === "issued") {
        action = `Office Furniture & Fixtures - Issued (${fmtItemLabel(
          updatedItem
        )})`;
      } else if (s === "for return to inventory") {
        action = `Office Furniture & Fixtures - Return to Inventory Requested (${fmtItemLabel(
          updatedItem
        )})`;
      } else if (s === "in stock" && isReturnToInventoryStatus(beforeStatus)) {
        action = `Office Furniture & Fixtures - Returned to Inventory (${fmtItemLabel(
          updatedItem
        )})`;
      } else if (s === "for transfer") {
        action = `Office Furniture & Fixtures - Transfer Requested (${fmtItemLabel(
          updatedItem
        )})`;
      } else if (s === "transferred") {
        action = `Office Furniture & Fixtures - Transferred (${fmtItemLabel(
          updatedItem
        )})`;
      } else if (s === "for disposal") {
        action = `Office Furniture & Fixtures - Disposal Requested (${fmtItemLabel(
          updatedItem
        )})`;
      } else if (s === "disposed") {
        action = `Office Furniture & Fixtures - Disposed (${fmtItemLabel(
          updatedItem
        )})`;
      } else {
        action = `Office Furniture & Fixtures - Status Update (${fmtItemLabel(
          updatedItem
        )}): "${beforeStatus}" → "${afterStatus}"`;
      }
    } else if (reqStatusChanged) {
      action = `Office Furniture & Fixtures - Requeststatus Update (${fmtItemLabel(
        updatedItem
      )}): "${beforeReqStatus}" → "${afterReqStatus}"`;
    }

    // If both changed, keep detailed info
    if (statusChanged && reqStatusChanged) {
      action = `Office Furniture & Fixtures - Update (${fmtItemLabel(
        updatedItem
      )}): status "${beforeStatus}" → "${afterStatus}", requeststatus "${beforeReqStatus}" → "${afterReqStatus}"`;
    }

    if (changes.length) {
      action += ` | ${changes.join(" | ")}`;
    }

    const beforeHistoryLen = Array.isArray(before.history) ? before.history.length : 0;
    let normalizedHistory = Array.isArray(updatedItem?.history)
      ? [...updatedItem.history]
      : [];
    const now = new Date().toISOString();
    const actorLabel =
      req?.user?.username || req?.user?.email || req?.body?.userName || actorFromReq(req);

    let historyUpdated = false;

    if (normalizedHistory.length < beforeHistoryLen) {
      normalizedHistory = Array.isArray(before.history) ? [...before.history] : [];
      historyUpdated = true;
    }

    if (normalizedHistory.length > beforeHistoryLen) {
      for (let i = beforeHistoryLen; i < normalizedHistory.length; i += 1) {
        const entry = normalizedHistory[i] || {};
        if (!entry.doc_snapshot) {
          entry.doc_snapshot = buildHistorySnapshot(updatedItem);
          historyUpdated = true;
        }
        if (!Array.isArray(entry.changes) || entry.changes.length === 0) {
          entry.changes = changes;
          historyUpdated = true;
        }
        if (!entry.to) entry.to = now;
        if (!entry.from) entry.from = before?.updatedAt?.toISOString?.() || now;
        if (!entry.name) entry.name = actorLabel;
        if (!entry.doc_type) {
          const statusLower = afterStatus.toLowerCase();
          if (statusLower.includes("issue")) {
            entry.doc_type = getStoredIssuanceDocType(updatedItem);
          }
          else if (statusLower.includes("transfer")) entry.doc_type = getPropertyTransferDocType(updatedItem);
          else if (statusLower.includes("disposal")) entry.doc_type = "PDR";
          else if (isReturnToInventoryStatus(statusLower)) entry.doc_type = "RTI";
        }
        normalizedHistory[i] = entry;
      }
    } else if (statusChanged || reqStatusChanged || changes.length) {
      normalizedHistory.push({
        name: actorLabel || "System",
        from: before?.updatedAt?.toISOString?.() || now,
        to: now,
        reason:
          reqStatusChanged || statusChanged
            ? `Status: "${beforeStatus}" → "${afterStatus}", requeststatus "${beforeReqStatus}" → "${afterReqStatus}"`
            : "Record updated",
        remarks: req?.body?.remarks || "",
        changes,
        doc_type: afterStatus.toLowerCase().includes("issue")
          ? getStoredIssuanceDocType(updatedItem)
          : afterStatus.toLowerCase().includes("transfer")
          ? getPropertyTransferDocType(updatedItem)
          : afterStatus.toLowerCase().includes("disposal")
          ? "PDR"
          : isReturnToInventoryStatus(afterStatus)
          ? "RTI"
          : null,
        doc_snapshot: buildHistorySnapshot(updatedItem),
      });
      historyUpdated = true;
    }

    if (historyUpdated) {
      updatedItem.history = normalizedHistory;
      await InventoryOfficeFurnitureandFixture.updateOne(
        { _id: itemId },
        { $set: { history: normalizedHistory } }
      );
    }

    await safeCreateLog({
      userId: actorFromReq(req),
      action,
      status: "success",
      time: nowISO(),
    });

    res.status(200).json(updatedItem);
  } catch (error) {
    console.error("Error updating inventory item:", error);

    await safeCreateLog({
      userId: actorFromReq(req),
      action: `Office Furniture & Fixtures - Update (${itemId})`,
      status: "error",
      time: nowISO(),
    });

    res.status(400).json({ error: "Invalid data provided" });
  }
};

/* -------------------- DELETE -------------------- */
export const deleteInventoryItem = async (req, res) => {
  const itemId = req.params.id;

  try {
    const existing = await InventoryOfficeFurnitureandFixture.findById(itemId);
    const deletedItem =
      await InventoryOfficeFurnitureandFixture.findByIdAndDelete(itemId);

    if (!deletedItem) {
      await safeCreateLog({
        userId: actorFromReq(req),
        action: `Office Furniture & Fixtures - Delete (Not Found: ${itemId})`,
        status: "error",
        time: nowISO(),
      });
      return res.status(404).json({ error: "Inventory item not found" });
    }

    if (existing?.thumbnail?.stored_name) {
      await removeThumbnailFile(existing.thumbnail.stored_name, "officefurniture");
    }

    await safeCreateLog({
      userId: actorFromReq(req),
      action: `Office Furniture & Fixtures - Delete (${fmtItemLabel(
        existing || deletedItem
      )})`,
      status: "success",
      time: nowISO(),
    });

    res.status(200).json({ message: "Inventory item deleted successfully" });
  } catch (error) {
    console.error("Error deleting inventory item:", error);

    await safeCreateLog({
      userId: actorFromReq(req),
      action: `Office Furniture & Fixtures - Delete (${itemId})`,
      status: "error",
      time: nowISO(),
    });

    res.status(500).json({ error: "Internal server error" });
  }
};

// Thumbnail upload
export const uploadFurnitureThumbnail = async (req, res) => {
  const itemId = req.params.id;
  const actor = actorFromReq(req);

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Thumbnail file is required." });
    }

    const existing = await InventoryOfficeFurnitureandFixture.findById(itemId);
    if (!existing) {
      await removeThumbnailFile(req.file.filename, "officefurniture");
      await safeCreateLog({
        userId: actor,
        action: `Office Furniture & Fixtures - Thumbnail Upload (Not Found: ${itemId})`,
        status: "error",
        time: nowISO(),
      });
      return res.status(404).json({ success: false, message: "Inventory item not found" });
    }

    if (existing?.thumbnail?.stored_name) {
      await removeThumbnailFile(existing.thumbnail.stored_name, "officefurniture");
    }

    existing.thumbnail = {
      url: thumbnailFileUrl(req.file.filename, "officefurniture"),
      filename: req.file.originalname,
      stored_name: req.file.filename,
      size: req.file.size,
      uploaded_by: actor,
      uploaded_at: new Date(),
    };

    await existing.save();

    await safeCreateLog({
      userId: actor,
      action: `Office Furniture & Fixtures - Thumbnail Upload (${fmtItemLabel(existing)})`,
      status: "success",
      time: nowISO(),
    });

    return res.status(200).json({ success: true, data: existing.thumbnail });
  } catch (error) {
    console.error("Thumbnail upload error:", error);
    if (req.file?.filename) {
      await removeThumbnailFile(req.file.filename, "officefurniture");
    }
    await safeCreateLog({
      userId: actor,
      action: `Office Furniture & Fixtures - Thumbnail Upload (${itemId})`,
      status: "error",
      time: nowISO(),
    });
    return res.status(500).json({ success: false, message: "Failed to upload thumbnail." });
  }
};

// Upload/replace signed file (ICS/PTR/PDR)
export const uploadSignedInventoryFile = async (req, res) => {
  const itemId = req.params.id;
  const actor = actorFromReq(req);

  if (!req.file) {
    return res.status(400).json({ success: false, message: "File is required." });
  }

  try {
    const existing = await InventoryOfficeFurnitureandFixture.findById(itemId);
    if (!existing) {
      await removeSignedFile(req.file.filename);
      return res.status(404).json({ success: false, message: "Inventory item not found" });
    }

    if (existing?.signed_file_prev?.stored_name) {
      await removeSignedFileIfUnreferenced(
        existing.signed_file_prev.stored_name,
        existing.history
      );
      existing.signed_file_prev = null;
      existing.signed_file_prev_expires_at = null;
    }

    if (existing?.signed_file?.stored_name) {
      existing.signed_file_prev = { ...existing.signed_file };
      existing.signed_file_prev_expires_at = signedPrevExpiryDate();
    } else {
      existing.signed_file_prev = null;
      existing.signed_file_prev_expires_at = null;
    }

    existing.signed_file = {
      url: signedFileUrl(req.file.filename),
      filename: req.file.originalname,
      stored_name: req.file.filename,
      uploaded_by: actor,
      uploaded_at: new Date(),
    };

    await existing.save();

    const statusLower = (existing.status || "").toString().toLowerCase();
    const docType = statusLower.includes("issue")
      ? getStoredIssuanceDocType(existing)
      : statusLower.includes("transfer")
      ? getPropertyTransferDocType(existing)
      : statusLower.includes("disposal")
      ? "PDR"
      : isReturnToInventoryStatus(statusLower)
      ? "RTI"
      : null;

    if (docType) {
      const historyEntry = {
        name: req?.user?.username || req?.user?.email || actor || "System",
        from: existing?.updatedAt?.toISOString?.() || new Date().toISOString(),
        to: new Date().toISOString(),
        reason: "Signed file uploaded",
        remarks: "",
        changes: [],
        doc_type: docType,
        signed_file: existing.signed_file,
        doc_snapshot: buildHistorySnapshot(existing),
      };
      const nextHistory = Array.isArray(existing.history)
        ? [...existing.history, historyEntry]
        : [historyEntry];
      await InventoryOfficeFurnitureandfixture.updateOne(
        { _id: existing._id },
        { $set: { history: nextHistory } }
      );
    }

    await safeCreateLog({
      userId: actor,
      action: `Office Furniture & Fixtures - Signed File Uploaded (${fmtItemLabel(existing)})`,
      status: "success",
      time: nowISO(),
    });

    res.status(200).json({ success: true, data: existing.signed_file });
  } catch (error) {
    await safeCreateLog({
      userId: actor,
      action: `Office Furniture & Fixtures - Signed File Upload (${itemId})`,
      status: "error",
      time: nowISO(),
    });
    res.status(500).json({ success: false, message: "Failed to upload file." });
  }
};

// Revert signed file to previous version (superadmin only)
export const revertSignedInventoryFile = async (req, res) => {
  const itemId = req.params.id;
  const actor = actorFromReq(req);

  if (!isSuperAdmin(req)) {
    return res.status(403).json({ success: false, message: "Access denied." });
  }

  try {
    const existing = await InventoryOfficeFurnitureandFixture.findById(itemId);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Inventory item not found" });
    }

    if (!existing?.signed_file_prev?.stored_name) {
      return res.status(404).json({ success: false, message: "No previous signed file found." });
    }

    if (isExpiredDate(existing.signed_file_prev_expires_at)) {
      await removeSignedFileIfUnreferenced(
        existing.signed_file_prev.stored_name,
        existing.history
      );
      existing.signed_file_prev = null;
      existing.signed_file_prev_expires_at = null;
      await existing.save();
      return res
        .status(410)
        .json({ success: false, message: "Previous signed file has expired." });
    }

    if (existing?.signed_file?.stored_name) {
      await removeSignedFileIfUnreferenced(
        existing.signed_file.stored_name,
        existing.history
      );
    }

    existing.signed_file = { ...existing.signed_file_prev };
    existing.signed_file_prev = null;
    existing.signed_file_prev_expires_at = null;
    await existing.save();

    await safeCreateLog({
      userId: actor,
      action: `Office Furniture & Fixtures - Signed File Reverted (${fmtItemLabel(existing)})`,
      status: "success",
      time: nowISO(),
    });

    return res.status(200).json({ success: true, data: existing.signed_file });
  } catch (error) {
    await safeCreateLog({
      userId: actor,
      action: `Office Furniture & Fixtures - Signed File Revert (${itemId})`,
      status: "error",
      time: nowISO(),
    });
    return res
      .status(500)
      .json({ success: false, message: "Failed to revert signed file." });
  }
};

// Revert item to previous state based on history snapshot (superadmin only)
export const revertInventoryState = async (req, res) => {
  const itemId = req.params.id;
  const actor = actorFromReq(req);

  if (!isSuperAdmin(req)) {
    return res.status(403).json({ success: false, message: "Access denied." });
  }

  try {
    const existing = await InventoryOfficeFurnitureandFixture.findById(itemId);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Inventory item not found" });
    }

    const previousState = resolvePreviousSnapshot(existing);
    if (!previousState) {
      return res.status(404).json({ success: false, message: "No previous state found." });
    }
    const { snapshot, historyIndex } = previousState;

    const expectedVersionRaw = req.body?.__v;
    const expectedVersion = Number(expectedVersionRaw);
    if (
      expectedVersionRaw === null ||
      expectedVersionRaw === undefined ||
      !Number.isInteger(expectedVersion) ||
      expectedVersion !== Number(existing.__v)
    ) {
      return res.status(409).json({
        success: false,
        message: "Version conflict. Please refresh and try again.",
      });
    }

    const before = existing.toObject();
    const prevSignedStored = snapshot?.signed_file?.stored_name || null;
    const currentSignedStored = existing?.signed_file?.stored_name || null;

    if (prevSignedStored && !(await signedFileExists(prevSignedStored))) {
      return res.status(410).json({
        success: false,
        message: "The signed file for the previous state is no longer available.",
      });
    }

    const prevSlotStored = existing?.signed_file_prev?.stored_name || null;
    const signedFilesToRemove = new Set(
      [currentSignedStored, prevSlotStored].filter(
        (storedName) => storedName && storedName !== prevSignedStored
      )
    );

    const updates = {
      ...sanitizeRevertSnapshot(snapshot),
      signed_file_prev: null,
      signed_file_prev_expires_at: null,
    };

    const mergedAfter = { ...before, ...updates };
    const changes = buildChangeList(before, mergedAfter);
    const now = new Date().toISOString();

    const historyEntry = {
      name: actor || "System",
      from: before?.updatedAt?.toISOString?.() || now,
      to: now,
      reason: "Reverted to previous state",
      remarks: "",
      changes,
      doc_type: resolveDocTypeFromSnapshot(mergedAfter),
      signed_file: mergedAfter?.signed_file || null,
      doc_snapshot: buildHistorySnapshot(mergedAfter),
      revert_to_history_index: historyIndex,
    };

    const nextHistory = Array.isArray(existing.history)
      ? [...existing.history, historyEntry]
      : [historyEntry];

    const updateResult = await InventoryOfficeFurnitureandFixture.updateOne(
      { _id: itemId, __v: expectedVersion },
      { $set: { ...updates, history: nextHistory }, $inc: { __v: 1 } }
    );
    if (!updateResult.modifiedCount) {
      return res.status(409).json({
        success: false,
        message: "Version conflict. Please refresh and try again.",
      });
    }

    for (const storedName of signedFilesToRemove) {
      try {
        await removeSignedFileIfUnreferenced(storedName, nextHistory);
      } catch (fileError) {
        console.error("Failed to clean up signed file after furniture state revert:", fileError);
      }
    }

    await safeCreateLog({
      userId: actor,
      action: `Office Furniture & Fixtures - Revert State (${fmtItemLabel(existing)})`,
      status: "success",
      time: nowISO(),
    });

    const updated = await InventoryOfficeFurnitureandFixture.findById(itemId);
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Error reverting furniture inventory state:", error);
    await safeCreateLog({
      userId: actor,
      action: `Office Furniture & Fixtures - Revert State (${itemId})`,
      status: "error",
      time: nowISO(),
    });
    return res
      .status(500)
      .json({ success: false, message: "Failed to revert state." });
  }
};

/* -------------------- GET BY ID -------------------- */
export const getInventoryItemById = async (req, res) => {
  const itemId = req.params.id;

  try {
    const role = normalizeRole(req?.user?.role);
    let inventoryItem = null;

    if (role === "employee") {
      const identifiers = getUserIdentifiers(req);
      const involvedFilter = buildInvolvementFilter(identifiers);
      const instockFilter = { status: /^(instock|in stock)$/i };
      const roleFilter = involvedFilter
        ? { $or: [instockFilter, involvedFilter] }
        : instockFilter;
      inventoryItem = await InventoryOfficeFurnitureandFixture.findOne({
        _id: itemId,
        ...roleFilter,
      });
      if (!inventoryItem) {
        return res.status(403).json({ error: "Access denied" });
      }
    } else {
      inventoryItem = await InventoryOfficeFurnitureandFixture.findById(itemId);
    }
    if (!inventoryItem) {
      await safeCreateLog({
        userId: actorFromReq(req),
        action: `Office Furniture & Fixtures - View (Not Found: ${itemId})`,
        status: "error",
        time: nowISO(),
      });
      return res.status(404).json({ error: "Inventory item not found" });
    }

    await clearExpiredPrevSignedFile(inventoryItem);
    inventoryItem = await ensureDocNumbers(inventoryItem);

    // Optional: usually too noisy, but if you want view logs, uncomment:
    // await safeCreateLog({
    //   userId: actorFromReq(req),
    //   action: `Office Furniture & Fixtures - View (${fmtItemLabel(inventoryItem)})`,
    //   status: "success",
    //   time: nowISO(),
    // });

    await ensurePublicToken(inventoryItem);
    res.status(200).json(inventoryItem);
  } catch (error) {
    console.error("Error fetching inventory item:", error);

    await safeCreateLog({
      userId: actorFromReq(req),
      action: `Office Furniture & Fixtures - View (${itemId})`,
      status: "error",
      time: nowISO(),
    });

    res.status(500).json({ error: "Internal server error" });
  }
};

// PUBLIC GET (no auth, limited fields)
export const getPublicInventoryItem = async (req, res) => {
  const itemId = req.params.id;
  try {
    const inventoryItem = await InventoryOfficeFurnitureandFixture.findById(itemId);
    if (!inventoryItem) {
      return res.status(404).json({ error: "Inventory item not found" });
    }
    await ensurePublicToken(inventoryItem);
    return res.status(200).json(buildPublicPayload(inventoryItem));
  } catch (error) {
    console.error("Error fetching public inventory item:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
