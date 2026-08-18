// controllers/inventoryOfficeSupplyController.js
import InventoryOfficeSupply from "../models/InventoryOfficeSupply.js";
import SystemSettings from "../models/SystemSettings.js";
import { createLog } from "./logsController.js";
import {
  buildFieldFilters,
  buildSearchFilter,
  buildStatusFilter,
  parsePagination,
} from "../utils/pagination.js";
import {
  removeThumbnailFile,
  thumbnailFileUrl,
} from "../utils/thumbnailUpload.js";

/**
 * LOGGING ENABLED for Office Supplies:
 * - CREATE / UPDATE / DELETE (success + error)
 * - List/Get errors
 *
 * How actor (userId) is resolved:
 * 1) req.user.email / req.user.username / req.user.id / req.user._id  (if you have auth middleware)
 * 2) req.body.userId / req.body.email
 * 3) req.headers["x-user-email"] / req.headers["x-user-id"]
 * 4) "NA"
 */

/* ---------- helpers ---------- */
const nowISO = () => new Date().toISOString();

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

const fmtItemLabel = (item) => {
  const stockNo = item?.stock_no ?? "";
  const name = item?.itemName ?? "";
  const cls = item?.classification ?? "";
  if (stockNo && name) return `StockNo:${stockNo} - ${name}${cls ? ` (${cls})` : ""}`;
  if (name) return name;
  if (stockNo) return `StockNo:${stockNo}`;
  return item?._id?.toString?.() || "Item";
};

const safeCreateLog = async (logData) => {
  try {
    await createLog(logData);
  } catch (e) {
    // Don't break the API if logging fails
    console.error("LOGGING_ERROR:", e?.message || e);
  }
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const normalizeRole = (role) => {
  if (!role || typeof role !== "string") return "";
  return role.trim().toLowerCase();
};

const getRoleFromReq = (req) =>
  req?.user?.role ||
  req?.user?.data?.role ||
  req?.user?.user?.role ||
  req?.headers?.["x-user-role"] ||
  "";

const HIDE_SUPPLY_FIELDS = [
  "stock_qty",
  "purchase_qty",
  "distribution_qty",
  "disposed_qty",
  "balance_qty",
  "stock_total_cost",
  "purchase_total_cost",
  "distribution_total_cost",
  "balance_total_cost",
];

const redactSupplyQuantities = (item) => {
  const doc = item?.toObject ? item.toObject() : { ...item };
  HIDE_SUPPLY_FIELDS.forEach((field) => {
    if (field in doc) doc[field] = null;
  });
  return doc;
};

const shouldHideSupplyQuantities = async (req) => {
  const settings = await SystemSettings.findOne({ key: "global" }).lean();
  const enabled = !!settings?.hide_supply_quantities;
  if (!enabled) return false;

  const role = normalizeRole(getRoleFromReq(req));
  const allowed = Array.isArray(settings?.hide_supply_quantity_roles)
    ? settings.hide_supply_quantity_roles.map(normalizeRole)
    : ["super admin", "inventory admin", "afd"];

  return !allowed.includes(role);
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

  // Consider change only if both are numeric-like and different
  const bd = num(b);
  const ad = num(a);

  if (bd === null && ad === null) return null;
  if (bd === ad) return null;

  const delta = fmtDelta(b, a);
  if (!delta) return null;
  return `${label}: ${delta}`;
};

const normalizeSupplyPayload = (before, payload) => {
  const next = { ...(payload || {}) };

  const resolve = (key) =>
    next?.[key] !== undefined && next?.[key] !== null ? next[key] : before?.[key];

  const normalizeNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const applyTotals = (qtyKey, unitCostKey, totalKey) => {
    const qty = normalizeNumber(resolve(qtyKey));
    const unitCost = normalizeNumber(resolve(unitCostKey));
    if (qtyKey in next || unitCostKey in next || totalKey in next) {
      next[qtyKey] = qty;
      next[unitCostKey] = unitCost;
      next[totalKey] = qty * unitCost;
    }
  };

  applyTotals("stock_qty", "stock_unit_cost", "stock_total_cost");
  applyTotals("purchase_qty", "purchase_unit_cost", "purchase_total_cost");
  applyTotals("distribution_qty", "distribution_unit_cost", "distribution_total_cost");
  applyTotals("balance_qty", "balance_unit_cost", "balance_total_cost");

  if (next.lowstock_threshold !== undefined) {
    const t = normalizeNumber(next.lowstock_threshold);
    next.lowstock_threshold = Math.max(1, t || 1);
  }

  if (next.balance_qty !== undefined && next.status === undefined) {
    next.status = normalizeNumber(next.balance_qty) <= 0 ? "Out of stock" : "Instock";
  }

  return next;
};

const buildSupplyStockFilter = (stockStatus) => {
  if (!stockStatus) return {};
  const raw = String(stockStatus).trim().toLowerCase();
  if (!raw || raw === "all") return {};

  if (raw === "out of stock") {
    return {
      $or: [
        { status: new RegExp("^out[\\s-]*of[\\s-]*stock$", "i") },
        { balance_qty: { $lte: 0 } },
      ],
    };
  }

  if (raw === "low stock") {
    return {
      balance_qty: { $gt: 0 },
      $expr: { $lt: ["$balance_qty", { $ifNull: ["$lowstock_threshold", 20] }] },
    };
  }

  if (raw === "in stock") {
    return {
      balance_qty: { $gt: 0 },
      $expr: { $gte: ["$balance_qty", { $ifNull: ["$lowstock_threshold", 20] }] },
    };
  }

  return {};
};

const SUPPLY_SORTABLE_FIELDS = new Set([
  "stock_no",
  "itemName",
  "classification",
  "unitofmeasure",
  "status",
  "project",
  "balance_qty",
  "balance_unit_cost",
  "balance_total_cost",
  "purchase_qty",
  "purchase_unit_cost",
  "purchase_total_cost",
  "distribution_qty",
  "distribution_unit_cost",
  "distribution_total_cost",
  "disposed_qty",
  "lowstock_threshold",
]);

const resolveSortQuery = (query) => {
  const sortByRaw = String(query?.sortBy || "").trim();
  const sortDirRaw = String(query?.sortDir || "").trim().toLowerCase();
  const sortDir = sortDirRaw === "asc" ? 1 : -1;

  if (!sortByRaw || !SUPPLY_SORTABLE_FIELDS.has(sortByRaw)) {
    return { _id: -1 };
  }

  return { [sortByRaw]: sortDir, _id: -1 };
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
    const stockStatus = req.query?.stockStatus;

    const fieldFilters = buildFieldFilters(
      req.query,
      [
        "stock_no",
        "itemName",
        "classification",
        "unitofmeasure",
        "status",
        "project",
        "balance_qty",
        "balance_unit_cost",
        "balance_total_cost",
        "purchase_qty",
        "purchase_unit_cost",
        "purchase_total_cost",
        "distribution_qty",
        "distribution_unit_cost",
        "distribution_total_cost",
        "disposed_qty",
        "lowstock_threshold",
      ],
      { prefix: "field_" }
    );

    const filter = {
      ...(status ? buildStatusFilter(status) : {}),
      ...buildSupplyStockFilter(stockStatus),
      ...buildSearchFilter(search, [
        "itemName",
        "classification",
        "project",
        "unitofmeasure",
        "status",
      ]),
      ...fieldFilters,
    };
    const sortQuery = resolveSortQuery(req.query);

    const hideQuantities = await shouldHideSupplyQuantities(req);

    if (!hasPaging) {
      const inventoryItems = await InventoryOfficeSupply.find(filter).sort(sortQuery);
      const payload = hideQuantities
        ? inventoryItems.map((item) => redactSupplyQuantities(item))
        : inventoryItems;
      return res.status(200).json(payload);
    }

    const [data, total] = await Promise.all([
      InventoryOfficeSupply.find(filter)
        .sort(sortQuery)
        .skip(skip)
        .limit(limit),
      InventoryOfficeSupply.countDocuments(filter),
    ]);

    const payload = hideQuantities
      ? data.map((item) => redactSupplyQuantities(item))
      : data;
    return res.status(200).json({ data: payload, total, page, limit });
  } catch (error) {
    console.error("Error fetching inventory:", error);

    await safeCreateLog({
      userId: actorFromReq(req),
      action: "Office Supply - List",
      status: "error",
      time: nowISO(),
    });

    res.status(500).json({ error: "Internal server error" });
  }
};

/* -------------------- CREATE -------------------- */
export const createInventoryItem = async (req, res) => {
  try {
    const maxIdItem = await InventoryOfficeSupply.findOne({}, {}, { sort: { id: -1 } });
    const maxStockNoItem = await InventoryOfficeSupply.findOne({}, {}, { sort: { stock_no: -1 } });

    let newId = maxIdItem ? maxIdItem.id + 1 : 1;
    let newStockNo = maxStockNoItem ? maxStockNoItem.stock_no + 1 : 1;

    const newItem = await InventoryOfficeSupply.create({
      ...req.body,
      id: newId,
      stock_no: newStockNo,
    });

    await safeCreateLog({
      userId: actorFromReq(req),
      action: `Office Supply - Create (${fmtItemLabel(newItem)})`,
      status: "success",
      time: nowISO(),
    });

    res.status(201).json(newItem);
  } catch (error) {
    console.error("Error creating inventory item:", error);

    await safeCreateLog({
      userId: actorFromReq(req),
      action: "Office Supply - Create",
      status: "error",
      time: nowISO(),
    });

    res.status(400).json({ error: "Invalid data provided" });
  }
};

/* -------------------- UPDATE -------------------- */
export const updateInventoryItem = async (req, res) => {
  const itemId = req.params.id;

  try {
    const before = await InventoryOfficeSupply.findById(itemId);
    if (!before) {
      await safeCreateLog({
        userId: actorFromReq(req),
        action: `Office Supply - Update (Not Found: ${itemId})`,
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

    const normalizedBody = normalizeSupplyPayload(before, req.body);
    if ("__v" in normalizedBody) delete normalizedBody.__v;

    const nextBalance =
      normalizedBody.balance_qty !== undefined
        ? Number(normalizedBody.balance_qty)
        : Number(before.balance_qty);
    if (Number.isFinite(nextBalance) && nextBalance < 0) {
      await safeCreateLog({
        userId: actorFromReq(req),
        action: `Office Supply - Update Rejected (Negative Balance: ${fmtItemLabel(before)})`,
        status: "error",
        time: nowISO(),
      });
      return res.status(422).json({
        success: false,
        message: "Balance quantity cannot be negative.",
      });
    }

    const previousBalance = Number(before.balance_qty ?? before.stock_qty ?? 0);
    const hasClientHistoryEntry =
      Array.isArray(req.body?.history) &&
      req.body.history.length > (Array.isArray(before.history) ? before.history.length : 0);
    if (
      Number.isFinite(previousBalance) &&
      Number.isFinite(nextBalance) &&
      previousBalance !== nextBalance &&
      !hasClientHistoryEntry
    ) {
      const delta = nextBalance - previousBalance;
      normalizedBody.history = [
        ...(Array.isArray(before.history) ? before.history.map((entry) => entry.toObject?.() || entry) : []),
        {
          name: actorFromReq(req),
          history_qty: Math.abs(delta),
          unit_cost: Number(
            normalizedBody.balance_unit_cost ??
              before.balance_unit_cost ??
              before.stock_unit_cost ??
              0
          ),
          date: nowISO(),
          station: "Office Supplies",
          status: "Manual Stock Adjustment",
          requeststatus: delta > 0 ? "Receipt" : "Issue",
          reference: "MANUAL ADJUSTMENT",
          document_type: "ADJUSTMENT",
          movement_type: delta > 0 ? "receipt" : "issue",
          remarks: String(req.body?.remarks || "Balance adjusted manually."),
        },
      ];
    }

    const updatedItem = await InventoryOfficeSupply.findOneAndUpdate(
      { _id: itemId, ...(version !== undefined ? { __v: Number(version) } : {}) },
      {
        $set: normalizedBody,
        $inc: { __v: 1 },
      },
      { new: true }
    );
    if (!updatedItem) {
      await safeCreateLog({
        userId: actorFromReq(req),
        action: `Office Supply - Update (Not Found after update: ${itemId})`,
        status: "error",
        time: nowISO(),
      });
      return res.status(404).json({ error: "Inventory item not found" });
    }

    // Detect meaningful changes (based on common supply fields you are using)
    const changes = [];

    // Core status
    if ((before.status || "") !== (updatedItem.status || "")) {
      changes.push(`status: "${before.status || ""}" → "${updatedItem.status || ""}"`);
    }

    // Quantities (based on your sample data fields)
    const qtyFields = [
      ["stock_qty", "Stock Qty"],
      ["purchase_qty", "Purchase Qty"],
      ["distribution_qty", "Distribution Qty"],
      ["disposed_qty", "Disposed Qty"],
      ["balance_qty", "Balance Qty"],
    ];

    qtyFields.forEach(([k, label]) => {
      const c = pickChange(before, updatedItem, k, label);
      if (c) changes.push(c);
    });

    // Costs (optional but useful)
    const costFields = [
      ["stock_total_cost", "Stock Total Cost"],
      ["purchase_total_cost", "Purchase Total Cost"],
      ["distribution_total_cost", "Distribution Total Cost"],
      ["balance_total_cost", "Balance Total Cost"],
    ];

    costFields.forEach(([k, label]) => {
      const c = pickChange(before, updatedItem, k, label);
      if (c) changes.push(c);
    });

    const thresholdChange = pickChange(
      before,
      updatedItem,
      "lowstock_threshold",
      "Low Stock Threshold"
    );
    if (thresholdChange) changes.push(thresholdChange);

    // Build a readable action
    let action = `Office Supply - Update (${fmtItemLabel(updatedItem)})`;
    if (changes.length) action += ` | ${changes.join(" | ")}`;

    // Optionally classify some common patterns:
    // - Distribution increased => “Distributed”
    // - Distribution decreased => “Distribution Reversed/Returned”
    // - Disposed increased => “Disposed”
    // - Stock increased => “Restocked”
    // (We keep them as part of the details; you can uncomment below to override action label.)
    //
    // const distBefore = num(before.distribution_qty);
    // const distAfter = num(updatedItem.distribution_qty);
    // if (distBefore !== null && distAfter !== null && distAfter > distBefore) {
    //   action = `Office Supply - Distributed (${fmtItemLabel(updatedItem)}) | ${changes.join(" | ")}`;
    // }

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
      action: `Office Supply - Update (${itemId})`,
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
    const existing = await InventoryOfficeSupply.findById(itemId);
    const deletedItem = await InventoryOfficeSupply.findByIdAndDelete(itemId);

    if (!deletedItem) {
      await safeCreateLog({
        userId: actorFromReq(req),
        action: `Office Supply - Delete (Not Found: ${itemId})`,
        status: "error",
        time: nowISO(),
      });
      return res.status(404).json({ error: "Inventory item not found" });
    }

    if (existing?.thumbnail?.stored_name) {
      await removeThumbnailFile(existing.thumbnail.stored_name);
    }

    await safeCreateLog({
      userId: actorFromReq(req),
      action: `Office Supply - Delete (${fmtItemLabel(existing || deletedItem)})`,
      status: "success",
      time: nowISO(),
    });

    res.status(200).json({ message: "Inventory item deleted successfully" });
  } catch (error) {
    console.error("Error deleting inventory item:", error);

    await safeCreateLog({
      userId: actorFromReq(req),
      action: `Office Supply - Delete (${itemId})`,
      status: "error",
      time: nowISO(),
    });

    res.status(500).json({ error: "Internal server error" });
  }
};

/* -------------------- THUMBNAIL UPLOAD -------------------- */
export const uploadSupplyThumbnail = async (req, res) => {
  const itemId = req.params.id;
  const actor = actorFromReq(req);

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Thumbnail file is required." });
    }

    const existing = await InventoryOfficeSupply.findById(itemId);
    if (!existing) {
      await removeThumbnailFile(req.file.filename);
      await safeCreateLog({
        userId: actor,
        action: `Office Supply - Thumbnail Upload (Not Found: ${itemId})`,
        status: "error",
        time: nowISO(),
      });
      return res.status(404).json({ success: false, message: "Inventory item not found" });
    }

    if (existing?.thumbnail?.stored_name) {
      await removeThumbnailFile(existing.thumbnail.stored_name);
    }

    existing.thumbnail = {
      url: thumbnailFileUrl(req.file.filename),
      filename: req.file.originalname,
      stored_name: req.file.filename,
      size: req.file.size,
      uploaded_by: actor,
      uploaded_at: new Date(),
    };

    await existing.save();

    await safeCreateLog({
      userId: actor,
      action: `Office Supply - Thumbnail Upload (${fmtItemLabel(existing)})`,
      status: "success",
      time: nowISO(),
    });

    return res.status(200).json({ success: true, data: existing.thumbnail });
  } catch (error) {
    console.error("Thumbnail upload error:", error);
    if (req.file?.filename) {
      await removeThumbnailFile(req.file.filename);
    }
    await safeCreateLog({
      userId: actor,
      action: `Office Supply - Thumbnail Upload (${itemId})`,
      status: "error",
      time: nowISO(),
    });
    return res.status(500).json({ success: false, message: "Failed to upload thumbnail." });
  }
};

/* -------------------- THUMBNAIL REMOVE -------------------- */
export const removeSupplyThumbnail = async (req, res) => {
  const itemId = req.params.id;
  const actor = actorFromReq(req);

  try {
    const existing = await InventoryOfficeSupply.findById(itemId);
    if (!existing) {
      await safeCreateLog({
        userId: actor,
        action: `Office Supply - Thumbnail Remove (Not Found: ${itemId})`,
        status: "error",
        time: nowISO(),
      });
      return res.status(404).json({ success: false, message: "Inventory item not found" });
    }

    if (existing?.thumbnail?.stored_name) {
      await removeThumbnailFile(existing.thumbnail.stored_name);
    }

    existing.thumbnail = {
      url: null,
      filename: null,
      stored_name: null,
      size: null,
      uploaded_by: null,
      uploaded_at: null,
    };
    await existing.save();

    await safeCreateLog({
      userId: actor,
      action: `Office Supply - Thumbnail Remove (${fmtItemLabel(existing)})`,
      status: "success",
      time: nowISO(),
    });

    return res.status(200).json({ success: true, message: "Thumbnail removed." });
  } catch (error) {
    console.error("Thumbnail remove error:", error);
    await safeCreateLog({
      userId: actor,
      action: `Office Supply - Thumbnail Remove (${itemId})`,
      status: "error",
      time: nowISO(),
    });
    return res.status(500).json({ success: false, message: "Failed to remove thumbnail." });
  }
};

/* -------------------- GET BY ID -------------------- */
export const getInventoryItemById = async (req, res) => {
  const itemId = req.params.id;

  try {
    const inventoryItem = await InventoryOfficeSupply.findById(itemId);
    if (!inventoryItem) {
      await safeCreateLog({
        userId: actorFromReq(req),
        action: `Office Supply - View (Not Found: ${itemId})`,
        status: "error",
        time: nowISO(),
      });
      return res.status(404).json({ error: "Inventory item not found" });
    }

    // Usually view logs are too noisy, so we only log errors by default.
    const hideQuantities = await shouldHideSupplyQuantities(req);
    res.status(200).json(hideQuantities ? redactSupplyQuantities(inventoryItem) : inventoryItem);
  } catch (error) {
    console.error("Error fetching inventory item:", error);

    await safeCreateLog({
      userId: actorFromReq(req),
      action: `Office Supply - View (${itemId})`,
      status: "error",
      time: nowISO(),
    });

    res.status(500).json({ error: "Internal server error" });
  }
};
