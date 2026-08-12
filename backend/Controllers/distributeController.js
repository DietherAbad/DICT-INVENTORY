// Controllers/distributeController.js
import mongoose from "mongoose";
import Distribute from "../models/Distribute.js";
import InventoryOfficeSupply from "../models/InventoryOfficeSupply.js";
import SystemSettings from "../models/SystemSettings.js";
import { createLog } from "./logsController.js";
import {
  removeSignedFile,
  removeSignedFileIfUnreferenced,
  signedFileExists,
  signedFileUrl,
} from "../utils/upload.js";
import { buildSearchFilter, buildStatusFilter, parsePagination } from "../utils/pagination.js";
import { withDbRetry } from "../utils/dbRetry.js";
import { hasAccessTag } from "../utils/rbac.js";

/**
 * LOGGING ENABLED for Distributions (Office Supplies RIS):
 * - Create / Update / Delete (success + error)
 * - List/View errors (optional)
 *
 * For best “who did it” accuracy:
 * - If you have auth middleware, set req.user (email/username/_id).
 * - Or send headers from frontend:  x-user-email / x-user-id
 */

/* ---------------- helpers ---------------- */
const nowISO = () => new Date().toISOString();
const SIGNED_PREV_TTL_DAYS = 7;
const signedPrevExpiryDate = () =>
  new Date(Date.now() + SIGNED_PREV_TTL_DAYS * 24 * 60 * 60 * 1000);
const isExpiredDate = (dateLike) =>
  !!dateLike && new Date(dateLike).getTime() <= Date.now();

const actorFromReq = (req) => {
  return (
    req?.user?.email ||
    req?.user?.username ||
    req?.user?.id ||
    req?.user?._id ||
    req?.headers?.["x-user-email"] ||
    req?.headers?.["x-user-id"] ||
    req?.body?.performedBy || // optional if you send it
    req?.body?.userId || // optional if you send it
    "NA"
  );
};

const safeCreateLog = async (logData) => {
  try {
    await createLog(logData);
  } catch (e) {
    console.error("LOGGING_ERROR:", e?.message || e);
  }
};

const summarizeItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) return "items:0";
  const count = items.length;
  const totalQty = items.reduce((t, it) => t + Number(it?.quantity || 0), 0);
  const sample = items
    .slice(0, 3)
    .map((it) => `${it?.itemName || "Item"} x${it?.quantity ?? 0}`)
    .join(", ");
  const more = count > 3 ? `, +${count - 3} more` : "";
  return `items:${count}, totalQty:${totalQty}, sample:[${sample}${more}]`;
};

const diffField = (before, after, key, label) => {
  const b = before?.[key];
  const a = after?.[key];
  const bs = b === null || b === undefined ? "" : String(b);
  const as = a === null || a === undefined ? "" : String(a);
  if (bs === as) return null;
  return `${label}: "${bs}" → "${as}"`;
};

const diffDate = (before, after, key, label) => {
  const b = before?.[key] ? new Date(before[key]).toISOString() : "";
  const a = after?.[key] ? new Date(after[key]).toISOString() : "";
  if (b === a) return null;
  return `${label}: ${b || "—"} → ${a || "—"}`;
};

const normalizeRole = (role) => String(role || "").trim().toLowerCase();

const buildHistorySnapshot = (dist) => ({
  RIS_no: dist?.RIS_no ?? null,
  request_type: dist?.request_type ?? null,
  distributedto: dist?.distributedto ?? null,
  distributedto_is: dist?.distributedto_is ?? null,
  office: dist?.office ?? null,
  requested_by: dist?.requested_by ?? null,
  requested_by_id: dist?.requested_by_id ?? null,
  status: dist?.status ?? null,
  requeststatus: dist?.requeststatus ?? null,
  date_checked: dist?.date_checked ?? null,
  date_requested: dist?.date_requested ?? null,
  date_approved: dist?.date_approved ?? null,
  date_released: dist?.date_released ?? null,
  date_received: dist?.date_received ?? null,
  purpose: dist?.purpose ?? null,
  remarks: dist?.remarks ?? null,
  disposal_reason: dist?.disposal_reason ?? null,
  disposal_notes: dist?.disposal_notes ?? null,
  items: Array.isArray(dist?.items) ? dist.items : [],
  signed_file: dist?.signed_file ?? null,
});

const snapshotSignature = (snapshot) =>
  JSON.stringify(buildHistorySnapshot(snapshot));

const buildLegacyPreviousTransferSnapshot = (doc) => {
  const current = buildHistorySnapshot(doc);
  const requestStatus = String(current?.requeststatus || "").toLowerCase().trim();
  if (requestStatus === "received" || requestStatus === "transferred") {
    return {
      ...current,
      status: "Pending",
      requeststatus: "Approved",
      date_received: null,
    };
  }
  if (requestStatus === "approved") {
    return {
      ...current,
      status: current?.status === "Transferred" ? "Pending" : current?.status,
      requeststatus: "For Approval",
      date_approved: null,
    };
  }
  if (requestStatus === "for approval") {
    return {
      ...current,
      status: current?.status === "Transferred" ? "Pending" : current?.status,
      requeststatus: "For checking",
      date_checked: null,
    };
  }
  return null;
};

const resolvePreviousSnapshot = (doc) => {
  if (!doc) return null;
  const history = Array.isArray(doc.history) ? doc.history : [];
  const currentSig = snapshotSignature(doc);
  const latest = history[history.length - 1];
  const latestRevertIndexRaw = latest?.revert_to_history_index;
  const latestRevertIndex = Number(latestRevertIndexRaw);
  const latestMatchesCurrentRevert =
    latest?.reason === "Reverted to previous state" &&
    latestRevertIndexRaw !== null &&
    latestRevertIndexRaw !== undefined &&
    Number.isInteger(latestRevertIndex) &&
    snapshotSignature(latest?.doc_snapshot) === currentSig;
  if (latestMatchesCurrentRevert && latestRevertIndex === -1) {
    const snapshot = buildLegacyPreviousTransferSnapshot(doc);
    return snapshot ? { snapshot, historyIndex: -1 } : null;
  }
  const latestIsCurrentRevert =
    latestMatchesCurrentRevert &&
    latestRevertIndex >= 0 &&
    snapshotSignature(latest?.doc_snapshot) === currentSig;
  const startIndex = latestIsCurrentRevert
    ? Math.min(latestRevertIndex - 1, history.length - 1)
    : history.length - 1;
  for (let i = startIndex; i >= 0; i -= 1) {
    const snapshot = history[i]?.doc_snapshot;
    if (!snapshot) continue;
    if (snapshotSignature(snapshot) !== currentSig) {
      return { snapshot, historyIndex: i };
    }
  }
  const snapshot = buildLegacyPreviousTransferSnapshot(doc);
  return snapshot ? { snapshot, historyIndex: -1 } : null;
};

const sanitizeRevertSnapshot = (snapshot) => {
  const cleaned = snapshot ? JSON.parse(JSON.stringify(snapshot)) : {};
  delete cleaned._id;
  delete cleaned.__v;
  delete cleaned.history;
  delete cleaned.createdAt;
  delete cleaned.updatedAt;
  delete cleaned.doc_generated_at;
  delete cleaned.RIS_no;
  return cleaned;
};

const resolveDocType = (dist) =>
  isSupplyDisposal(dist) ? "SDR" : "RIS";
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


const isSupplyDisposal = (doc) =>
  String(doc?.request_type || "").toLowerCase().trim() === "disposal";

const isTransferredLike = (doc) => {
  if (isSupplyDisposal(doc)) return false;
  const rs = String(doc?.requeststatus || "").toLowerCase();
  const st = String(doc?.status || "").toLowerCase();
  return rs === "received" || rs === "transferred" || st === "transferred";
};

const isDeclinedLike = (doc) => {
  const rs = String(doc?.requeststatus || "").toLowerCase();
  const st = String(doc?.status || "").toLowerCase();
  return rs === "declined" || st === "declined";
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const normalizeStockNo = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : value;
};
const normalizeDistributionItem = (item) => ({
  stock_no: normalizeStockNo(item?.stock_no ?? item?.stockNo ?? null),
  returnId: item?.returnId || item?.return_id || item?.returnID || "",
  classification: item?.classification ?? "",
  project: item?.project ?? null,
  itemName: item?.itemName || item?.item_name || item?.description || "",
  unitofmeasure: item?.unitofmeasure || item?.unit || "",
  quantity: num(item?.quantity),
  cost: num(item?.cost ?? item?.unit_cost ?? item?.unitCost),
});

const normalizedValue = (value) => String(value || "").trim().toLowerCase();
const requestUserValues = (req) =>
  [req?.user?._id, req?.user?.id, req?.user?.username, req?.user?.email]
    .filter(Boolean)
    .map(normalizedValue);
const requestUserMatches = (req, ...values) => {
  const actorValues = requestUserValues(req);
  return values.filter(Boolean).some((value) => actorValues.includes(normalizedValue(value)));
};
const hasAnyRole = (req, roles) => roles.includes(normalizeRole(getRoleFromReq(req)));
const canUseDirectDistribution = (req) =>
  hasAnyRole(req, [
    "super admin",
    "superadmin",
    "inventory admin",
    "inventoryadmin",
    "regional director",
  ]);
const canPerformConfiguredAction = (req, configuredId, fallbackRoles = []) => {
  if (isSuperAdmin(req)) return true;
  if (configuredId) return requestUserMatches(req, configuredId);
  return hasAnyRole(req, fallbackRoles);
};
const isDistributionRequester = (req, distribution) =>
  requestUserMatches(
    req,
    distribution?.requested_by_id,
    distribution?.requested_by
  );
const isDistributionRecipient = (req, distribution) =>
  requestUserMatches(
    req,
    distribution?.distributedto_is,
    distribution?.distributedto
  );

const distributionStageActor = (req, distribution, settings) => {
  const stage = normalizedValue(distribution?.requeststatus);
  const risSettings = settings?.document_signatories?.ris || {};
  if (stage === "for checking") {
    return canPerformConfiguredAction(req, risSettings.checker_id, [
      "inventory admin",
      "inventoryadmin",
    ]);
  }
  if (stage === "for approval") {
    return canPerformConfiguredAction(req, risSettings.approver_id, ["afd"]);
  }
  if (stage === "approved") return isSuperAdmin(req) || isDistributionRecipient(req, distribution);
  return false;
};

const validateNormalDistributionUpdate = ({ req, before, updateData, settings }) => {
  const current = normalizedValue(before?.requeststatus);
  const next = normalizedValue(updateData?.requeststatus ?? before?.requeststatus);
  const nextStatus = normalizedValue(updateData?.status ?? before?.status);
  const requestStatusChanged = next !== current;
  const statusChanged = nextStatus !== normalizedValue(before?.status);
  const workflowFields = [
    "date_checked",
    "date_approved",
    "date_released",
    "date_received",
  ];
  const changesWorkflowDate = workflowFields.some((key) => key in updateData);

  if (!requestStatusChanged && !statusChanged && !changesWorkflowDate) {
    if (
      ("items" in updateData || "remarks" in updateData || "purpose" in updateData) &&
      current === "for checking"
    ) {
      if (!distributionStageActor(req, before, settings)) {
        const error = new Error("Access denied. Only the RIS checker can edit this request.");
        error.statusCode = 403;
        throw error;
      }
      return;
    }
    const error = new Error("No permitted RIS workflow change was supplied.");
    error.statusCode = 400;
    throw error;
  }

  if (next === "cancelled" && nextStatus === "cancelled") {
    if (current !== "for checking" || !isDistributionRequester(req, before)) {
      const error = new Error("Only the requestor can cancel an RIS while it is For checking.");
      error.statusCode = 403;
      throw error;
    }
    return;
  }

  if (next === "declined" && nextStatus === "declined") {
    if (!distributionStageActor(req, before, settings)) {
      const error = new Error("Access denied. Only the current RIS action owner can decline it.");
      error.statusCode = 403;
      throw error;
    }
    return;
  }

  const allowed =
    (current === "for checking" && next === "for approval" && nextStatus === "pending") ||
    (current === "for approval" && next === "approved" && nextStatus === "pending") ||
    (current === "approved" && next === "received" && nextStatus === "transferred");
  if (!allowed) {
    const error = new Error(`Invalid RIS transition from '${before?.requeststatus || "—"}' to '${updateData?.requeststatus || "—"}'.`);
    error.statusCode = 409;
    throw error;
  }
  const permittedDate =
    current === "for checking"
      ? "date_checked"
      : current === "for approval"
      ? "date_approved"
      : "date_received";
  const invalidDate = workflowFields.some(
    (key) => key in updateData && key !== permittedDate
  );
  if (invalidDate) {
    const error = new Error("The supplied RIS workflow date does not match the current stage.");
    error.statusCode = 400;
    throw error;
  }
  if (!distributionStageActor(req, before, settings)) {
    const error = new Error("Access denied. You are not the assigned actor for this RIS stage.");
    error.statusCode = 403;
    throw error;
  }
  if (settings?.enable_signed_upload !== false && !before?.signed_file?.url) {
    const error = new Error("A signed RIS is required before completing this action.");
    error.statusCode = 400;
    throw error;
  }
};

const getDistributionLimitSettings = async () => {
  const settings = await SystemSettings.findOne({ key: "global" }).lean();
  const defaultLimit = Number(settings?.distribution_request_limit_default ?? 5);
  const perRole = settings?.distribution_request_limit_by_role || {};
  return {
    defaultLimit: Number.isFinite(defaultLimit) && defaultLimit > 0 ? defaultLimit : 5,
    perRole: typeof perRole === "object" && perRole ? perRole : {},
  };
};

const resolvePendingLimitForRole = (role, limitSettings) => {
  const roleKey = normalizeRole(role);
  const perRole = limitSettings?.perRole || {};
  const raw = perRole?.[roleKey] ?? perRole?.[role] ?? null;
  const parsed = Number(raw);
  if (Number.isFinite(parsed)) {
    if (parsed === -1) return Infinity;
    if (parsed > 0) return Math.floor(parsed);
  }
  if (roleKey === "super admin" || roleKey === "superadmin" || roleKey === "inventory admin") {
    return Infinity;
  }
  return limitSettings?.defaultLimit ?? 5;
};

const applySupplyAdjustments = async ({
  distribution,
  items,
  mode,
  actor,
  session,
  historyStatus,
  historyRequestStatus,
  historyRemarks,
}) => {
  if (!Array.isArray(items) || items.length === 0) return;

  const sign = mode === "apply" ? -1 : 1;
  const distSign = -sign;

  for (const item of items) {
    const rid = item?.returnId || item?.return_id || item?.returnID;
    if (!rid) continue;

    const qty = num(item?.quantity);
    if (!qty) continue;

    const supply = await InventoryOfficeSupply.findById(rid).session(session);
    if (!supply) {
      throw new Error(`Supply item not found for returnId ${rid}`);
    }

    const unitCost = num(
      item?.cost ??
        supply.balance_unit_cost ??
        supply.stock_unit_cost ??
        supply.purchase_unit_cost ??
        0
    );
    const totalCost = qty * unitCost;

    const baseStockQty = num(supply.stock_qty);
    const baseStockTotal = num(supply.stock_total_cost);
    const baseDistQty = num(supply.distribution_qty);
    const baseDistTotal = num(supply.distribution_total_cost);
    const baseBalanceQty = num(supply.balance_qty);
    const baseBalanceTotal = num(supply.balance_total_cost);

    if (mode === "apply" && qty > baseBalanceQty) {
      throw new Error(
        `Insufficient stock for ${supply.itemName || rid}. Available ${baseBalanceQty}, requested ${qty}.`
      );
    }

    let stock_qty = baseStockQty + sign * qty;
    let stock_total_cost = baseStockTotal + sign * totalCost;
    let distribution_qty = baseDistQty + distSign * qty;
    let distribution_total_cost = baseDistTotal + distSign * totalCost;
    let balance_qty = baseBalanceQty + sign * qty;
    let balance_total_cost = baseBalanceTotal + sign * totalCost;

    stock_qty = Math.max(0, stock_qty);
    stock_total_cost = Math.max(0, stock_total_cost);
    distribution_qty = Math.max(0, distribution_qty);
    distribution_total_cost = Math.max(0, distribution_total_cost);
    balance_qty = Math.max(0, balance_qty);
    balance_total_cost = Math.max(0, balance_total_cost);

    const history = Array.isArray(supply.history) ? [...supply.history] : [];
    history.push({
      name: actor || "System",
      history_qty: qty,
      unit_cost: unitCost,
      date: new Date().toISOString(),
      station: distribution?.office || "Office Supplies",
      status: historyStatus || (mode === "apply" ? "Distributed" : "Distribution Reverted"),
      requeststatus:
        historyRequestStatus || (mode === "apply" ? "Transferred" : "Declined"),
      reference: distribution?.RIS_no || null,
      document_type: "RIS",
      movement_type: mode === "apply" ? "issue" : "receipt",
      remarks:
        historyRemarks ||
        distribution?.remarks ||
        `${mode === "apply" ? "Issued" : "Returned"} via RIS ${
          distribution?.RIS_no || "-"
        }`,
    });

    supply.stock_qty = stock_qty;
    supply.stock_unit_cost = stock_qty > 0 ? stock_total_cost / stock_qty : 0;
    supply.stock_total_cost = stock_total_cost;
    supply.distribution_qty = distribution_qty;
    supply.distribution_unit_cost =
      distribution_qty > 0 ? distribution_total_cost / distribution_qty : 0;
    supply.distribution_total_cost = distribution_total_cost;
    supply.balance_qty = balance_qty;
    supply.balance_unit_cost = balance_qty > 0 ? balance_total_cost / balance_qty : 0;
    supply.balance_total_cost = balance_total_cost;
    supply.disposed_qty = supply.disposed_qty || 0;
    supply.status = balance_qty <= 0 ? "Out of stock" : "Instock";
    supply.history = history;

    await supply.save({ session });
  }
};

const isSupplyDisposalApproved = (doc) => {
  if (!isSupplyDisposal(doc)) return false;
  const rs = String(doc?.requeststatus || "").toLowerCase().trim();
  const st = String(doc?.status || "").toLowerCase().trim();
  return rs === "approved" || rs === "received" || st === "disposed";
};

const applySupplyDisposalAdjustments = async ({ distribution, items, actor, session }) => {
  if (!Array.isArray(items) || items.length === 0) return;

  for (const item of items) {
    const rid = item?.returnId || item?.return_id || item?.returnID;
    if (!rid) continue;

    const qty = num(item?.quantity);
    if (!qty) continue;

    const supply = await InventoryOfficeSupply.findById(rid).session(session);
    if (!supply) {
      throw new Error(`Supply item not found for returnId ${rid}`);
    }

    const unitCost = num(
      item?.cost ??
        supply.balance_unit_cost ??
        supply.stock_unit_cost ??
        supply.purchase_unit_cost ??
        0
    );
    const totalCost = qty * unitCost;

    const baseStockQty = num(supply.stock_qty);
    const baseStockTotal = num(supply.stock_total_cost);
    const baseBalanceQty = num(supply.balance_qty);
    const baseBalanceTotal = num(supply.balance_total_cost);
    const baseDisposedQty = num(supply.disposed_qty);

    if (qty > baseBalanceQty) {
      throw new Error(
        `Insufficient stock for ${supply.itemName || rid}. Available ${baseBalanceQty}, requested ${qty}.`
      );
    }

    let stock_qty = baseStockQty - qty;
    let stock_total_cost = baseStockTotal - totalCost;
    let balance_qty = baseBalanceQty - qty;
    let balance_total_cost = baseBalanceTotal - totalCost;
    let disposed_qty = baseDisposedQty + qty;

    stock_qty = Math.max(0, stock_qty);
    stock_total_cost = Math.max(0, stock_total_cost);
    balance_qty = Math.max(0, balance_qty);
    balance_total_cost = Math.max(0, balance_total_cost);

    const history = Array.isArray(supply.history) ? [...supply.history] : [];
    history.push({
      name: actor || "System",
      history_qty: qty,
      unit_cost: unitCost,
      date: new Date().toISOString(),
      station: distribution?.office || "Office Supplies",
      status: "Dispose",
      requeststatus: "Approved",
      reference: distribution?.RIS_no || null,
      document_type: "SDR",
      movement_type: "issue",
      remarks:
        distribution?.disposal_reason ||
        distribution?.remarks ||
        `Disposed via SDR ${distribution?.RIS_no || "-"}`,
    });

    supply.stock_qty = stock_qty;
    supply.stock_unit_cost = stock_qty > 0 ? stock_total_cost / stock_qty : 0;
    supply.stock_total_cost = stock_total_cost;
    supply.balance_qty = balance_qty;
    supply.balance_unit_cost = balance_qty > 0 ? balance_total_cost / balance_qty : 0;
    supply.balance_total_cost = balance_total_cost;
    supply.disposed_qty = disposed_qty;
    supply.status = balance_qty <= 0 ? "Out of stock" : "Instock";
    supply.history = history;

    await supply.save({ session });
  }
};

const buildDistributionStatusFilter = (status) => {
  if (!status) return {};
  const raw = String(status).trim().toLowerCase();
  if (!raw) return {};

  if (raw === "pending") {
    return {
      $or: [
        { status: /^(pending|for checking|for approval)$/i },
        { requeststatus: /^(pending|for checking|for approval)$/i },
      ],
    };
  }

  if (raw === "approved") {
    return {
      $or: [
        { status: /^(approved|for release)$/i },
        { requeststatus: /^(approved|for release)$/i },
      ],
    };
  }

  if (raw === "transferred") {
    return {
      $or: [
        { status: /^(transferred|received)$/i },
        { requeststatus: /^(transferred|received)$/i },
      ],
    };
  }

  if (raw === "declined") {
    return {
      $or: [{ status: /^declined$/i }, { requeststatus: /^declined$/i }],
    };
  }

  if (raw === "out of stock") {
    return { status: /^out[\\s-]*of[\\s-]*stock$/i };
  }

  return buildStatusFilter(status);
};

const buildDistributionAttentionFilter = () => {
  const rsEmpty = {
    $or: [
      { requeststatus: { $exists: false } },
      { requeststatus: null },
      { requeststatus: "" },
    ],
  };

  const allowedRequestStatus = {
    requeststatus: {
      $regex:
        /^(for[\s-]*checking|for[\s-]*release|approved|to[\s-]*receive|for[\s-]*approval)/i,
    },
  };

  const notDisposed = {
    status: { $nin: [/^disposed$/i] },
  };

  const notFinalRequestStatus = {
    requeststatus: { $nin: [/^received$/i, /^declined$/i] },
  };

  return {
    $and: [
      notFinalRequestStatus,
      notDisposed,
      {
        $or: [
          allowedRequestStatus,
          {
            $and: [rsEmpty, { status: { $regex: /^for[\s-]*disposal$/i } }],
          },
          {
            $and: [
              rsEmpty,
              { status: { $regex: /^(pending|approved)$/i } },
              {
                $or: [
                  { request_type: { $exists: false } },
                  { request_type: null },
                  { request_type: { $ne: "disposal" } },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
};

/* ---------------- controller methods ---------------- */

/** Create new distribution record (RIS_no assigned automatically by model hook) */
export const createDistribution = async (req, res) => {
  const actor = actorFromReq(req);
  const requestType = String(req?.body?.request_type || "distribution")
    .toLowerCase()
    .trim();
  const isDisposal = requestType === "disposal";

  if (!isDisposal) {
    const requestedStage = normalizedValue(req?.body?.requeststatus);
    const directDistribution = requestedStage === "for approval";
    if (directDistribution && !canUseDirectDistribution(req)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Your role cannot bypass RIS checking.",
      });
    }
    req.body.status = "Pending";
    req.body.requeststatus = directDistribution ? "For Approval" : "For checking";
  }

  try {
    if (!Array.isArray(req.body.items) || req.body.items.length === 0) {
      await safeCreateLog({
        userId: actor,
        action: "Distribution - Create (invalid: no items)",
        status: "error",
        time: nowISO(),
      });

      return res.status(400).json({
        success: false,
        message: "At least one item is required.",
      });
    }

    const requesterId =
      req?.user?._id || req?.user?.id || req?.user?.userId || req?.headers?.["x-user-id"];
    const requesterName =
      req?.user?.username || req?.user?.email || req?.user?.name || req?.headers?.["x-user-email"];

    if (requesterId) {
      const limitSettings = await getDistributionLimitSettings();
      const pendingLimit = resolvePendingLimitForRole(req?.user?.role, limitSettings);

      if (Number.isFinite(pendingLimit)) {
        const pendingCount = await Distribute.countDocuments({
          requested_by_id: String(requesterId),
          $or: [
            { requeststatus: /^(pending|for checking|for approval|approved|for release|for issuance)$/i },
            { status: /^(pending|for checking|for approval|approved|for release|for issuance)$/i },
          ],
        });

        if (pendingCount >= pendingLimit) {
          return res.status(429).json({
            success: false,
            message: "Too many pending requests. Please wait for approvals.",
          });
        }
      }
    }

    const returnIds = Array.from(
      new Set(
        (req.body.items || [])
          .map((item) => item?.returnId || item?.return_id || item?.returnID)
          .filter(Boolean)
      )
    );
    const activeStatusRegex =
      /^(pending|for checking|for approval|approved|for release|for issuance)$/i;
    const reservedAgg =
      returnIds.length > 0
        ? await Distribute.aggregate([
            {
              $match: {
                request_type: { $ne: "disposal" },
                "items.returnId": { $in: returnIds },
                $or: [
                  { requeststatus: { $regex: activeStatusRegex } },
                  { status: { $regex: activeStatusRegex } },
                ],
              },
            },
            { $unwind: "$items" },
            { $match: { "items.returnId": { $in: returnIds } } },
            { $group: { _id: "$items.returnId", qty: { $sum: "$items.quantity" } } },
          ])
        : [];
    const reservedById = reservedAgg.reduce((acc, row) => {
      acc[row._id] = num(row?.qty);
      return acc;
    }, {});

    for (const item of req.body.items) {
      const rid = item?.returnId || item?.return_id || item?.returnID;
      if (!rid) {
        return res.status(400).json({
          success: false,
          message: "Invalid distribution item. Missing returnId.",
        });
      }
      const supply = await InventoryOfficeSupply.findById(rid);
      if (!supply) {
        return res.status(404).json({
          success: false,
          message: `Supply item not found for returnId ${rid}.`,
        });
      }
      const qty = num(item?.quantity);
      if (!qty || qty <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid quantity in distribution items.",
        });
      }
      const availableQty = num(supply.balance_qty ?? supply.stock_qty);
      const reservedQty = num(reservedById[rid]);
      const effectiveAvailable = Math.max(0, availableQty - reservedQty);
      if (qty > effectiveAvailable) {
        return res.status(409).json({
          success: false,
          message: `Not enough stock for ${supply.itemName || "item"}. ${reservedQty > 0 ? `Pending requests already reserved ${reservedQty}. ` : ""}Available now: ${effectiveAvailable}.`,
        });
      }
    }

    const session = await mongoose.startSession();
    let savedDistribution = null;
    try {
      await withDbRetry(() => session.withTransaction(async () => {
        // Touch each supply in a stable order. Concurrent creations for the same
        // stock must then serialize and re-read reservations before saving.
        for (const rid of [...returnIds].sort()) {
          await InventoryOfficeSupply.updateOne(
            { _id: rid },
            { $inc: { __v: 1 } },
            { session }
          );
        }

        const finalReservedAgg = returnIds.length
          ? await Distribute.aggregate([
              {
                $match: {
                  request_type: { $ne: "disposal" },
                  "items.returnId": { $in: returnIds },
                  $or: [
                    { requeststatus: { $regex: activeStatusRegex } },
                    { status: { $regex: activeStatusRegex } },
                  ],
                },
              },
              { $unwind: "$items" },
              { $match: { "items.returnId": { $in: returnIds } } },
              { $group: { _id: "$items.returnId", qty: { $sum: "$items.quantity" } } },
            ]).session(session)
          : [];
        const finalReservedById = finalReservedAgg.reduce((acc, row) => {
          acc[row._id] = num(row?.qty);
          return acc;
        }, {});

        const canonicalItems = [];
        for (const rawItem of req.body.items) {
          const item = normalizeDistributionItem(rawItem);
          const supply = await InventoryOfficeSupply.findById(item.returnId).session(session);
          if (!supply) {
            const error = new Error(`Supply item not found for returnId ${item.returnId}.`);
            error.statusCode = 404;
            throw error;
          }
          const available = num(supply.balance_qty ?? supply.stock_qty);
          const reserved = isDisposal ? 0 : num(finalReservedById[item.returnId]);
          if (item.quantity > Math.max(0, available - reserved)) {
            const error = new Error(
              `Not enough stock for ${supply.itemName || "item"}. Available now: ${Math.max(0, available - reserved)}.`
            );
            error.statusCode = 409;
            throw error;
          }
          canonicalItems.push({
            ...item,
            classification: supply.classification || item.classification,
            project: supply.project ?? item.project,
            itemName: supply.itemName || item.itemName,
            unitofmeasure: supply.unitofmeasure || item.unitofmeasure,
            cost: num(
              supply.balance_unit_cost ??
                supply.stock_unit_cost ??
                supply.purchase_unit_cost ??
                item.cost
            ),
          });
        }

        const newDistribution = new Distribute({
          ...req.body,
          items: canonicalItems,
          request_type: requestType,
          ...(isDisposal
            ? { status: "For Disposal", requeststatus: "For Approval" }
            : {}),
          requested_by: requesterName || null,
          requested_by_id: requesterId ? String(requesterId) : null,
        });
        await newDistribution.save({ session });
        newDistribution.history = [
          {
            name: req?.user?.username || req?.user?.email || actor || "System",
            from: newDistribution?.createdAt?.toISOString?.() || nowISO(),
            to: nowISO(),
            reason: "Distribution request created.",
            remarks: newDistribution?.remarks || "",
            changes: [],
            doc_type: resolveDocType(newDistribution),
            signed_file: newDistribution?.signed_file || null,
            doc_snapshot: buildHistorySnapshot(newDistribution),
          },
        ];
        await newDistribution.save({ session });
        savedDistribution = newDistribution;
      }));
    } finally {
      await session.endSession();
    }

    await safeCreateLog({
      userId: actor,
      action: isDisposal
        ? `Supply Disposal - Create (SDR:${savedDistribution.RIS_no || "NA"}) ` +
          `by:${savedDistribution.requested_by || actor || "—"} ` +
          `${summarizeItems(savedDistribution.items)}`
        : `Distribution - Create (RIS:${savedDistribution.RIS_no || "NA"}) ` +
          `to:${savedDistribution.distributedto || "—"} office:${savedDistribution.office || "—"} ` +
          `${summarizeItems(savedDistribution.items)}`,
      status: "success",
      time: nowISO(),
    });

    return res.status(200).json({
      success: true,
      message: "Distribution record created successfully!",
      data: savedDistribution, // includes string RIS_no like "2025-1122-0001"
    });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message || "Failed to create distribution.",
      });
    }
    if (error?.code === 11000 && error?.keyPattern?.RIS_no) {
      await safeCreateLog({
        userId: actor,
        action: "Distribution - Create (RIS conflict)",
        status: "error",
        time: nowISO(),
      });

      return res.status(409).json({
        success: false,
        message: "RIS number conflict. Please retry.",
      });
    }

    console.error("createDistribution error:", error);

    await safeCreateLog({
      userId: actor,
      action: "Distribution - Create",
      status: "error",
      time: nowISO(),
    });

    return res.status(500).json({
      success: false,
      message: "Internal server error!",
    });
  }
};

/** Get all distribution records (newest first) */
export const getAllDistributions = async (req, res) => {
  try {
    const { page, limit, skip, hasPaging } = parsePagination(req, {
      page: 1,
      limit: 20,
    });

    const role = normalizeRole(req?.user?.role);
    const requesterId =
      req?.user?._id || req?.user?.id || req?.user?.userId || req?.headers?.["x-user-id"];
    const requesterName =
      req?.user?.username || req?.user?.email || req?.user?.name || req?.headers?.["x-user-email"];

    const status = req.query?.status;
    const requeststatus = req.query?.requeststatus;
    const search = req.query?.search;
    const requestTypeRaw = req.query?.request_type || req.query?.requestType;
    const view = String(req.query?.view || "").toLowerCase().trim();
    const recipientId = req.query?.recipientId || req.query?.distributedto_is;
    const recipientName = req.query?.recipientName || req.query?.distributedto;

    const normalizedRequestType = String(requestTypeRaw || "").toLowerCase().trim();
    const requestTypeCandidate =
      normalizedRequestType ||
      (view === "disposals" ? "disposal" : view === "distributions" ? "distribution" : "");
    const requestType =
      requestTypeCandidate === "distribution" || requestTypeCandidate === "disposal"
        ? requestTypeCandidate
        : "";

    const requestTypeFilter =
      requestType === "distribution"
        ? {
            $or: [
              { request_type: "distribution" },
              { request_type: { $exists: false } },
              { request_type: null },
            ],
          }
        : requestType
        ? { request_type: requestType }
        : null;

    const filter = {
      ...(status ? buildDistributionStatusFilter(status) : {}),
      ...(requeststatus
        ? {
            requeststatus: new RegExp(
              `^${String(requeststatus)
                .trim()
                .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
                .replace(/\s+/g, "[\\s-]*")}$`,
              "i"
            ),
          }
        : {}),
      ...(requestTypeFilter || {}),
      ...(recipientId ? { distributedto_is: String(recipientId) } : {}),
      ...(recipientName ? { distributedto: String(recipientName) } : {}),
      ...buildSearchFilter(search, [
        "RIS_no",
        "ris_no",
        "distributedto",
        "office",
        "status",
        "requeststatus",
        "items.itemName",
        "items.classification",
      ]),
    };

    const canViewAll =
      (await hasAccessTag(req?.user?.role, "stocks.distribution")) ||
      (await hasAccessTag(req?.user?.role, "stocks.request_queue"));

    if (!canViewAll) {
      if (requesterId) {
        filter.distributedto_is = String(requesterId);
      } else if (requesterName) {
        filter.distributedto = String(requesterName);
      } else {
        return res.status(403).json({ success: false, message: "Access denied" });
      }
    }

    if (!hasPaging) {
      const distributions = await Distribute.find(filter).sort({ createdAt: -1 });
      return res.status(200).json(distributions);
    }

    const [data, total] = await Promise.all([
      Distribute.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Distribute.countDocuments(filter),
    ]);

    return res.status(200).json({ data, total, page, limit });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error("getAllDistributions error:", error);

    await safeCreateLog({
      userId: actorFromReq(req),
      action: "Distribution - List",
      status: "error",
      time: nowISO(),
    });

    return res.status(500).json({
      success: false,
      message: "Internal server error!",
    });
  }
};

/** Get single distribution */
export const getDistribution = async (req, res) => {
  const id = req.params.id;

  try {
    const distribution = await Distribute.findById(id);

    if (!distribution) {
      await safeCreateLog({
        userId: actorFromReq(req),
        action: `Distribution - View (not found: ${id})`,
        status: "error",
        time: nowISO(),
      });

      return res.status(404).json({
        success: false,
        message: "Distribution record not found!",
      });
    }

    await clearExpiredPrevSignedFile(distribution);

    // Usually "view" logs get noisy; keep success logging OFF by default.
    return res.status(200).json({
      success: true,
      message: "Successful!",
      data: distribution,
    });
  } catch (error) {
    console.error("getDistribution error:", error);

    await safeCreateLog({
      userId: actorFromReq(req),
      action: `Distribution - View (${id})`,
      status: "error",
      time: nowISO(),
    });

    return res.status(500).json({
      success: false,
      message: "Internal server error!",
    });
  }
};

/** Update distribution (RIS_no is immutable) */
export const updateDistribution = async (req, res) => {
  const id = req.params.id;
  const actor = actorFromReq(req);
  const updateData = { ...req.body };
  [
    "history",
    "signed_file",
    "signed_file_prev",
    "signed_file_prev_expires_at",
    "requested_by",
    "requested_by_id",
    "request_type",
    "distributedto",
    "distributedto_is",
    "office",
    "date_requested",
    "itemId",
    "createdAt",
    "updatedAt",
  ].forEach((field) => delete updateData[field]);

  let before = null;
  let updatedDistribution = null;
  let changes = [];

  const session = await mongoose.startSession();
  try {
    await withDbRetry(() => session.withTransaction(async () => {
      if ("RIS_no" in updateData) {
        // RIS_no is immutable; strip it out
        delete updateData.RIS_no;
      }

      before = await Distribute.findById(id).session(session);
      if (!before) {
        throw new Error("NOT_FOUND");
      }

      const role = normalizeRole(req?.user?.role);
      const isSupplyDisposalRequest = isSupplyDisposal(before);
      const settings = await SystemSettings.findOne({ key: "global" }).lean().session(session);
      if (!isSupplyDisposalRequest) {
        if ("purpose" in updateData && !String(updateData.purpose || "").trim()) {
          const error = new Error("Purpose is required for an RIS.");
          error.statusCode = 400;
          throw error;
        }
        validateNormalDistributionUpdate({ req, before, updateData, settings });
        const currentStage = normalizedValue(before?.requeststatus);
        const nextStage = normalizedValue(updateData?.requeststatus ?? before?.requeststatus);
        const actionTime = new Date();
        if (currentStage === "for checking" && nextStage === "for approval") {
          updateData.date_checked = actionTime;
        } else if (currentStage === "for approval" && nextStage === "approved") {
          updateData.date_approved = actionTime;
        } else if (currentStage === "approved" && nextStage === "received") {
          updateData.date_released = actionTime;
          updateData.date_received = actionTime;
        }
      }
      const wantsDisposalApproval =
        isSupplyDisposalRequest &&
        (String(updateData?.requeststatus || "").toLowerCase().trim() === "approved" ||
          String(updateData?.status || "").toLowerCase().trim() === "disposed");
      if (
        wantsDisposalApproval &&
        role !== "afd" &&
        role !== "super admin" &&
        role !== "superadmin"
      ) {
        const err = new Error("Access denied. Only AFD can approve supply disposals.");
        err.statusCode = 403;
        throw err;
      }
      if (wantsDisposalApproval && !before?.signed_file?.url) {
        const err = new Error(
          "Signed SDR is required before approving a supply disposal."
        );
        err.statusCode = 400;
        throw err;
      }

      const version = req.body?.__v;
      if (version !== undefined && Number(before.__v) !== Number(version)) {
        const conflict = new Error("VERSION_CONFLICT");
        conflict.statusCode = 409;
        throw conflict;
      }

      if ("__v" in updateData) delete updateData.__v;

      if ("items" in updateData) {
        if (!isSupplyDisposalRequest && !distributionStageActor(req, before, settings)) {
          const err = new Error(
            "Access denied. Only the assigned RIS checker can edit items."
          );
          err.statusCode = 403;
          throw err;
        }

        if (!Array.isArray(updateData.items) || updateData.items.length === 0) {
          const err = new Error("At least one item is required.");
          err.statusCode = 400;
          throw err;
        }

        updateData.items = updateData.items.map((item) => normalizeDistributionItem(item));

        const currentStatus = String(before.requeststatus || "").toLowerCase();
        if (currentStatus !== "for checking") {
          const err = new Error("Items can only be edited while status is 'For checking'.");
          err.statusCode = 400;
          throw err;
        }

        const editReturnIds = Array.from(new Set(updateData.items.map((item) => item.returnId)));
        const reservedAgg = await Distribute.aggregate([
          {
            $match: {
              _id: { $ne: before._id },
              request_type: { $ne: "disposal" },
              "items.returnId": { $in: editReturnIds },
              $or: [
                { requeststatus: /^(pending|for checking|for approval|approved|for release|for issuance)$/i },
                { status: /^(pending|for checking|for approval|approved|for release|for issuance)$/i },
              ],
            },
          },
          { $unwind: "$items" },
          { $match: { "items.returnId": { $in: editReturnIds } } },
          { $group: { _id: "$items.returnId", qty: { $sum: "$items.quantity" } } },
        ]).session(session);
        const reservedById = reservedAgg.reduce((acc, row) => {
          acc[row._id] = num(row?.qty);
          return acc;
        }, {});

        for (const item of updateData.items) {
          const rid = item?.returnId || item?.return_id || item?.returnID;
          const qty = num(item?.quantity);
          if (!rid || qty < 1) {
            const err = new Error("Invalid item payload. Quantity must be at least 1.");
            err.statusCode = 400;
            throw err;
          }

          const supply = await InventoryOfficeSupply.findById(rid).session(session);
          if (!supply) {
            const err = new Error(`Supply item not found for returnId ${rid}.`);
            err.statusCode = 404;
            throw err;
          }

          const available = Math.max(0, num(supply.balance_qty) - num(reservedById[rid]));
          if (qty > available) {
            const err = new Error(
              `Insufficient stock for ${supply.itemName || "item"}. Available ${available}, requested ${qty}.`
            );
            err.statusCode = 409;
            throw err;
          }
          item.classification = supply.classification || item.classification;
          item.project = supply.project ?? item.project;
          item.itemName = supply.itemName || item.itemName;
          item.unitofmeasure = supply.unitofmeasure || item.unitofmeasure;
          item.cost = num(
            supply.balance_unit_cost ??
              supply.stock_unit_cost ??
              supply.purchase_unit_cost ??
              item.cost
          );
        }
      }

      updatedDistribution = await Distribute.findOneAndUpdate(
        { _id: id, ...(version !== undefined ? { __v: Number(version) } : {}) },
        {
          $set: updateData,
          $inc: { __v: 1 },
        },
        { new: true, session }
      );

      if (!updatedDistribution) {
        throw new Error("NOT_FOUND");
      }

      const wasTransferred = isTransferredLike(before);
      const isNowTransferred = isTransferredLike(updatedDistribution);
      const isNowDeclined = isDeclinedLike(updatedDistribution);
      const wasDisposalApproved = isSupplyDisposalApproved(before);
      const isNowDisposalApproved = isSupplyDisposalApproved(updatedDistribution);

      if (!wasTransferred && isNowTransferred) {
        await applySupplyAdjustments({
          distribution: updatedDistribution,
          items: updatedDistribution.items,
          mode: "apply",
          actor,
          session,
        });
      }

      if (wasTransferred && isNowDeclined) {
        await applySupplyAdjustments({
          distribution: updatedDistribution,
          items: updatedDistribution.items,
          mode: "revert",
          actor,
          session,
        });
      }

      if (!wasDisposalApproved && isNowDisposalApproved) {
        await applySupplyDisposalAdjustments({
          distribution: updatedDistribution,
          items: updatedDistribution.items,
          actor,
          session,
        });
      }

      changes = [
        diffField(before, updatedDistribution, "status", "status"),
        diffField(before, updatedDistribution, "requeststatus", "requeststatus"),
        diffField(before, updatedDistribution, "remarks", "remarks"),
        diffField(before, updatedDistribution, "purpose", "purpose"),
        diffField(before, updatedDistribution, "distributedto", "distributedto"),
        diffField(before, updatedDistribution, "office", "office"),
        diffField(before, updatedDistribution, "distributedto_is", "distributedto_is"),
        diffDate(before, updatedDistribution, "date_checked", "date_checked"),
        diffDate(before, updatedDistribution, "date_requested", "date_requested"),
        diffDate(before, updatedDistribution, "date_approved", "date_approved"),
        diffDate(before, updatedDistribution, "date_released", "date_released"),
        diffDate(before, updatedDistribution, "date_received", "date_received"),
      ].filter(Boolean);
      const beforeItems = JSON.stringify(before?.items || []);
      const afterItems = JSON.stringify(updatedDistribution?.items || []);
      if (beforeItems !== afterItems) changes.push("items updated");

      const history = Array.isArray(updatedDistribution.history)
        ? [...updatedDistribution.history]
        : [];
      const actorLabel = req?.user?.username || req?.user?.email || actor || "System";
      const appendSnapshot = (source, reason, entryChanges = []) => {
        const snapshot = buildHistorySnapshot(source);
        const lastSnapshot = history[history.length - 1]?.doc_snapshot;
        if (lastSnapshot && snapshotSignature(lastSnapshot) === snapshotSignature(snapshot)) return;
        history.push({
          name: actorLabel,
          from: before?.updatedAt?.toISOString?.() || nowISO(),
          to: nowISO(),
          reason,
          remarks: source?.remarks || "",
          changes: entryChanges,
          doc_type: resolveDocType(source),
          signed_file: source?.signed_file || null,
          doc_snapshot: snapshot,
        });
      };
      appendSnapshot(before, "State before distribution update.");
      appendSnapshot(
        updatedDistribution,
        isSupplyDisposal(updatedDistribution)
          ? "Supply disposal request updated."
          : "Supply transfer request updated.",
        changes
      );
      await Distribute.updateOne({ _id: id }, { $set: { history } }, { session });
      updatedDistribution.history = history;
    }));

    // Keep signed_file across approvals/releases so signatories can sign the same document.

    // Build change summary (good for tracing approvals/releases/receipts)
    const actionBase =
      `Distribution - Update (RIS:${updatedDistribution.RIS_no || "NA"}) ` +
      `to:${updatedDistribution.distributedto || "—"} office:${updatedDistribution.office || "—"}`;

    const action =
      changes.length > 0 ? `${actionBase} | ${changes.join(" | ")}` : actionBase;

    await safeCreateLog({
      userId: actor,
      action,
      status: "success",
      time: nowISO(),
    });

    return res.status(200).json({
      success: true,
      message: "Distribution record updated successfully!",
      data: updatedDistribution,
    });
  } catch (error) {
    if (error?.message === "NOT_FOUND") {
      await safeCreateLog({
        userId: actor,
        action: `Distribution - Update (not found: ${id})`,
        status: "error",
        time: nowISO(),
      });
      return res.status(404).json({
        success: false,
        message: "Distribution record not found!",
      });
    }

    if (error?.message === "VERSION_CONFLICT") {
      return res.status(409).json({
        success: false,
        message: "Version conflict. Please refresh and try again.",
      });
    }

    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message || "Update failed.",
      });
    }

    console.error("updateDistribution error:", error);

    await safeCreateLog({
      userId: actor,
      action: `Distribution - Update (${id})`,
      status: "error",
      time: nowISO(),
    });

    return res.status(500).json({
      success: false,
      message: "Internal server error!",
    });
  } finally {
    session.endSession();
  }
};

/** Upload/replace signed file for distribution */
export const uploadSignedDistributionFile = async (req, res) => {
  const actor = actorFromReq(req);
  const id = req.params.id;

  if (!req.file) {
    return res.status(400).json({ success: false, message: "File is required." });
  }

  try {
    const distribution = await Distribute.findById(id);
    if (!distribution) {
      await removeSignedFile(req.file.filename);
      return res.status(404).json({ success: false, message: "Record not found." });
    }

    const settings = await SystemSettings.findOne({ key: "global" }).lean();
    const uploadAllowed = isSupplyDisposal(distribution)
      ? normalizedValue(distribution.requeststatus) === "for approval" &&
        (isSuperAdmin(req) || hasAnyRole(req, ["afd"]))
      : distributionStageActor(req, distribution, settings);
    if (!uploadAllowed) {
      await removeSignedFile(req.file.filename);
      return res.status(403).json({
        success: false,
        message: "Access denied. Only the current RIS action owner can upload its signed file.",
      });
    }

    if (distribution?.signed_file_prev?.stored_name) {
      await removeSignedFileIfUnreferenced(
        distribution.signed_file_prev.stored_name,
        distribution.history
      );
      distribution.signed_file_prev = null;
      distribution.signed_file_prev_expires_at = null;
    }

    if (distribution?.signed_file?.stored_name) {
      distribution.signed_file_prev = { ...distribution.signed_file };
      distribution.signed_file_prev_expires_at = signedPrevExpiryDate();
    } else {
      distribution.signed_file_prev = null;
      distribution.signed_file_prev_expires_at = null;
    }

    distribution.signed_file = {
      url: signedFileUrl(req.file.filename),
      filename: req.file.originalname,
      stored_name: req.file.filename,
      uploaded_by: actor,
      uploaded_at: new Date(),
    };

    await distribution.save();

    const uploadHistory = Array.isArray(distribution.history)
      ? [...distribution.history]
      : [];
    uploadHistory.push({
      name: req?.user?.username || req?.user?.email || actor || "System",
      from: distribution?.updatedAt?.toISOString?.() || nowISO(),
      to: nowISO(),
      reason: "Signed file uploaded.",
      remarks: distribution?.remarks || "",
      changes: [],
      doc_type: resolveDocType(distribution),
      signed_file: distribution.signed_file,
      doc_snapshot: buildHistorySnapshot(distribution),
    });
    distribution.history = uploadHistory;
    await distribution.save();

    await safeCreateLog({
      userId: actor,
      action: `Distribution - Signed File Uploaded (RIS:${distribution.RIS_no || "NA"})`,
      status: "success",
      time: nowISO(),
    });

    // Return the complete saved record so the client receives the latest __v
    // after the signed-file history entry has been appended.
    return res.status(200).json({
      success: true,
      data: distribution.signed_file,
      distribution,
    });
  } catch (error) {
    await safeCreateLog({
      userId: actor,
      action: `Distribution - Signed File Upload (${id})`,
      status: "error",
      time: nowISO(),
    });
    return res.status(500).json({ success: false, message: "Failed to upload file." });
  }
};

/** Revert signed file for distribution (superadmin only) */
export const revertSignedDistributionFile = async (req, res) => {
  const actor = actorFromReq(req);
  const id = req.params.id;

  if (!isSuperAdmin(req)) {
    return res.status(403).json({ success: false, message: "Access denied." });
  }

  try {
    const distribution = await Distribute.findById(id);
    if (!distribution) {
      return res.status(404).json({ success: false, message: "Record not found." });
    }

    if (!distribution?.signed_file_prev?.stored_name) {
      return res.status(404).json({ success: false, message: "No previous signed file found." });
    }

    if (isExpiredDate(distribution.signed_file_prev_expires_at)) {
      await removeSignedFileIfUnreferenced(
        distribution.signed_file_prev.stored_name,
        distribution.history
      );
      distribution.signed_file_prev = null;
      distribution.signed_file_prev_expires_at = null;
      await distribution.save();
      return res
        .status(410)
        .json({ success: false, message: "Previous signed file has expired." });
    }

    if (distribution?.signed_file?.stored_name) {
      await removeSignedFileIfUnreferenced(
        distribution.signed_file.stored_name,
        distribution.history
      );
    }

    distribution.signed_file = { ...distribution.signed_file_prev };
    distribution.signed_file_prev = null;
    distribution.signed_file_prev_expires_at = null;
    await distribution.save();

    await safeCreateLog({
      userId: actor,
      action: `Distribution - Signed File Reverted (RIS:${distribution.RIS_no || "NA"})`,
      status: "success",
      time: nowISO(),
    });

    return res.status(200).json({ success: true, data: distribution.signed_file });
  } catch (error) {
    await safeCreateLog({
      userId: actor,
      action: `Distribution - Signed File Revert (${id})`,
      status: "error",
      time: nowISO(),
    });
    return res.status(500).json({ success: false, message: "Failed to revert file." });
  }
};

/** Revert a supply transfer to its previous recorded state (superadmin only). */
export const revertDistributionState = async (req, res) => {
  const actor = actorFromReq(req);
  const id = req.params.id;

  if (!isSuperAdmin(req)) {
    return res.status(403).json({ success: false, message: "Access denied." });
  }

  const session = await mongoose.startSession();
  let updatedDistribution = null;
  let signedFilesToRemove = new Set();
  let nextHistory = [];

  try {
    await withDbRetry(() =>
      session.withTransaction(async () => {
        const existing = await Distribute.findById(id).session(session);
        if (!existing) {
          const error = new Error("Distribution record not found.");
          error.statusCode = 404;
          throw error;
        }
        if (isSupplyDisposal(existing)) {
          const error = new Error(
            "State revert is currently available for supply transfers only."
          );
          error.statusCode = 400;
          throw error;
        }

        const expectedVersionRaw = req.body?.__v;
        const expectedVersion = Number(expectedVersionRaw);
        if (
          expectedVersionRaw === null ||
          expectedVersionRaw === undefined ||
          !Number.isInteger(expectedVersion) ||
          expectedVersion !== Number(existing.__v)
        ) {
          const error = new Error("Version conflict. Please refresh and try again.");
          error.statusCode = 409;
          throw error;
        }

        const previousState = resolvePreviousSnapshot(existing);
        if (!previousState) {
          const error = new Error("No previous state found.");
          error.statusCode = 404;
          throw error;
        }
        const { snapshot, historyIndex } = previousState;
        const previousSignedStored = snapshot?.signed_file?.stored_name || null;
        if (previousSignedStored && !(await signedFileExists(previousSignedStored))) {
          const error = new Error(
            "The signed file for the previous state is no longer available."
          );
          error.statusCode = 410;
          throw error;
        }

        const before = existing.toObject();
        const updates = {
          ...sanitizeRevertSnapshot(snapshot),
          signed_file_prev: null,
          signed_file_prev_expires_at: null,
        };
        const restored = { ...before, ...updates };

        const wasTransferred = isTransferredLike(before);
        const willBeTransferred = isTransferredLike(restored);
        const beforeItemsSignature = JSON.stringify(before?.items || []);
        const restoredItemsSignature = JSON.stringify(restored?.items || []);

        if (wasTransferred && (!willBeTransferred || beforeItemsSignature !== restoredItemsSignature)) {
          await applySupplyAdjustments({
            distribution: before,
            items: before.items,
            mode: "revert",
            actor,
            session,
            historyStatus: "Distribution State Reverted",
            historyRequestStatus: restored?.requeststatus || "Approved",
            historyRemarks: `Stock restored because RIS ${before?.RIS_no || "-"} was reverted.`,
          });
        }
        if (willBeTransferred && (!wasTransferred || beforeItemsSignature !== restoredItemsSignature)) {
          await applySupplyAdjustments({
            distribution: restored,
            items: restored.items,
            mode: "apply",
            actor,
            session,
            historyStatus: "Distribution State Restored",
            historyRequestStatus: restored?.requeststatus || "Received",
            historyRemarks: `Stock reapplied from historical RIS ${restored?.RIS_no || before?.RIS_no || "-"}.`,
          });
        }

        const changes = [
          diffField(before, restored, "status", "status"),
          diffField(before, restored, "requeststatus", "requeststatus"),
          diffDate(before, restored, "date_checked", "date_checked"),
          diffDate(before, restored, "date_approved", "date_approved"),
          diffDate(before, restored, "date_received", "date_received"),
        ].filter(Boolean);
        const now = nowISO();
        const historyEntry = {
          name: req?.user?.username || req?.user?.email || actor || "System",
          from: before?.updatedAt?.toISOString?.() || now,
          to: now,
          reason: "Reverted to previous state",
          remarks: restored?.remarks || "",
          changes,
          doc_type: resolveDocType(restored),
          signed_file: restored?.signed_file || null,
          doc_snapshot: buildHistorySnapshot(restored),
          revert_to_history_index: historyIndex,
        };

        nextHistory = Array.isArray(existing.history)
          ? [...existing.history, historyEntry]
          : [historyEntry];
        signedFilesToRemove = new Set(
          [
            existing?.signed_file?.stored_name,
            existing?.signed_file_prev?.stored_name,
          ].filter(
            (storedName) => storedName && storedName !== previousSignedStored
          )
        );

        updatedDistribution = await Distribute.findOneAndUpdate(
          { _id: id, __v: expectedVersion },
          {
            $set: { ...updates, history: nextHistory },
            $inc: { __v: 1 },
          },
          { new: true, session }
        );
        if (!updatedDistribution) {
          const error = new Error("Version conflict. Please refresh and try again.");
          error.statusCode = 409;
          throw error;
        }
      })
    );

    for (const storedName of signedFilesToRemove) {
      await removeSignedFileIfUnreferenced(storedName, nextHistory);
    }

    await safeCreateLog({
      userId: actor,
      action: `Distribution - Revert State (RIS:${updatedDistribution?.RIS_no || "NA"})`,
      status: "success",
      time: nowISO(),
    });

    return res.status(200).json({ success: true, data: updatedDistribution });
  } catch (error) {
    await safeCreateLog({
      userId: actor,
      action: `Distribution - Revert State (${id})`,
      status: "error",
      time: nowISO(),
    });
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message || "Failed to revert supply transfer.",
      });
    }
    console.error("revertDistributionState error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to revert supply transfer.",
    });
  } finally {
    await session.endSession();
  }
};

/** Delete distribution */
export const deleteDistribution = async (req, res) => {
  const id = req.params.id;
  const actor = actorFromReq(req);

  try {
    const existing = await Distribute.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Distribution record not found!",
      });
    }
    if (isTransferredLike(existing) || isSupplyDisposalApproved(existing)) {
      return res.status(409).json({
        success: false,
        message:
          "Completed RIS/SDR records cannot be deleted. Revert the state first to preserve inventory and audit history.",
      });
    }
    const deletedDistribution = await Distribute.findByIdAndDelete(id);

    if (!deletedDistribution) {
      await safeCreateLog({
        userId: actor,
        action: `Distribution - Delete (not found: ${id})`,
        status: "error",
        time: nowISO(),
      });

      return res.status(404).json({
        success: false,
        message: "Distribution record not found!",
      });
    }

    await safeCreateLog({
      userId: actor,
      action:
        `Distribution - Delete (RIS:${existing?.RIS_no || deletedDistribution.RIS_no || "NA"}) ` +
        `to:${existing?.distributedto || deletedDistribution.distributedto || "—"} ` +
        `office:${existing?.office || deletedDistribution.office || "—"} ` +
        `${summarizeItems(existing?.items || deletedDistribution.items)}`,
      status: "success",
      time: nowISO(),
    });

    const storedFiles = new Set(
      [
        existing?.signed_file?.stored_name,
        existing?.signed_file_prev?.stored_name,
        ...(existing?.history || []).map((entry) => entry?.signed_file?.stored_name),
      ].filter(Boolean)
    );
    for (const storedName of storedFiles) {
      await removeSignedFile(storedName);
    }

    return res.status(200).json({
      success: true,
      message: "Distribution record deleted successfully!",
      data: deletedDistribution,
    });
  } catch (error) {
    console.error("deleteDistribution error:", error);

    await safeCreateLog({
      userId: actor,
      action: `Distribution - Delete (${id})`,
      status: "error",
      time: nowISO(),
    });

    return res.status(500).json({
      success: false,
      message: "Internal server error!",
    });
  }
};

/** Count distributions */
export const getNumberOfDistributions = async (req, res) => {
  try {
    const status = req.query?.status;
    const requeststatus = req.query?.requeststatus;
    const search = req.query?.search;
    const requestTypeRaw = req.query?.request_type || req.query?.requestType;
    const view = String(req.query?.view || "").toLowerCase().trim();
    const recipientId = req.query?.recipientId || req.query?.distributedto_is;
    const recipientName = req.query?.recipientName || req.query?.distributedto;
    const attentionOnly =
      String(req.query?.attentionOnly || req.query?.attention || "")
        .toLowerCase()
        .trim() === "true" ||
      String(req.query?.attentionOnly || req.query?.attention || "")
        .toLowerCase()
        .trim() === "1";

    const normalizedRequestType = String(requestTypeRaw || "").toLowerCase().trim();
    const requestTypeCandidate =
      normalizedRequestType ||
      (view === "disposals" ? "disposal" : view === "distributions" ? "distribution" : "");
    const requestType =
      requestTypeCandidate === "distribution" || requestTypeCandidate === "disposal"
        ? requestTypeCandidate
        : "";

    const requestTypeFilter =
      requestType === "distribution"
        ? {
            $or: [
              { request_type: "distribution" },
              { request_type: { $exists: false } },
              { request_type: null },
            ],
          }
        : requestType
        ? { request_type: requestType }
        : null;

    const filter = {
      ...(status ? buildDistributionStatusFilter(status) : {}),
      ...(requeststatus
        ? {
            requeststatus: new RegExp(
              `^${String(requeststatus)
                .trim()
                .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
                .replace(/\s+/g, "[\\s-]*")}$`,
              "i"
            ),
          }
        : {}),
      ...(requestTypeFilter || {}),
      ...(recipientId ? { distributedto_is: String(recipientId) } : {}),
      ...(recipientName ? { distributedto: String(recipientName) } : {}),
      ...buildSearchFilter(search, [
        "RIS_no",
        "ris_no",
        "distributedto",
        "office",
        "status",
        "requeststatus",
        "items.itemName",
        "items.classification",
      ]),
    };

    const canViewAll =
      (await hasAccessTag(req?.user?.role, "stocks.distribution")) ||
      (await hasAccessTag(req?.user?.role, "stocks.request_queue"));

    if (!canViewAll) {
      const requesterId =
        req?.user?._id ||
        req?.user?.id ||
        req?.user?.userId ||
        req?.headers?.["x-user-id"];
      const requesterName =
        req?.user?.username ||
        req?.user?.email ||
        req?.user?.name ||
        req?.headers?.["x-user-email"];

      if (requesterId) {
        filter.distributedto_is = String(requesterId);
      } else if (requesterName) {
        filter.distributedto = String(requesterName);
      } else {
        return res.status(403).json({ success: false, message: "Access denied" });
      }
    }

    const finalFilter = attentionOnly
      ? { $and: [filter, buildDistributionAttentionFilter()] }
      : filter;

    const count = await Distribute.countDocuments(finalFilter);
    return res.status(200).json({
      success: true,
      message: "Successful!",
      data: count,
    });
  } catch (error) {
    console.error("getNumberOfDistributions error:", error);

    await safeCreateLog({
      userId: actorFromReq(req),
      action: "Distribution - Count",
      status: "error",
      time: nowISO(),
    });

    return res.status(500).json({
      success: false,
      message: "Internal server error!",
    });
  }
};
