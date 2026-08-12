import InventoryOfficeSupply from "../models/InventoryOfficeSupply.js";
import InventoryOfficeEquipment from "../models/InventoryOfficeEquipment.js";
import InventoryOfficeFurnitureandFixture from "../models/InventoryOfficeFurnitureandFixture.js";
import InventoryOfficeICTEquipment from "../models/InventoryOfficeICTEquipment.js";
import Distribute from "../models/Distribute.js";
import User from "../models/User.js";
import { hasAccessTag } from "../utils/rbac.js";

const norm = (value) => String(value || "").trim().toLowerCase();

const normalizePropertyStatus = (statusRaw) => {
  const s = norm(statusRaw);
  if (["instock", "in stock", "in-stock"].includes(s)) return "In stock";
  if (s === "issued") return "Issued";
  if (s === "transferred" || s === "trasferred") return "Transferred";
  if (s === "for transfer" || s === "for-transfer") return "For transfer";
  if (s === "pending") return "Pending";
  if (s === "for disposal" || s === "for-disposal") return "For disposal";
  if (s === "disposed") return "Disposed";
  return statusRaw ? String(statusRaw).trim() : "Unknown";
};

const normalizeRequestStatus = (raw) => {
  const s = norm(raw);
  if (!s) return "";
  if (s === "for approval") return "For Approval";
  if (s === "for release") return "For Release";
  if (s === "for issuance") return "For Issuance";
  if (s === "for checking") return "For checking";
  if (s === "issued") return "Issued";
  if (s === "transferred" || s === "trasferred") return "Transferred";
  if (s === "to receive") return "To receive";
  if (s === "received") return "Received";
  if (s === "approved") return "Approved";
  if (s === "released") return "Released";
  return raw ? String(raw).trim() : "";
};

const fmtDate = (val) => {
  if (!val) return "—";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const cleanLabel = (v, fallback = "—") => {
  if (v === undefined || v === null) return fallback;
  if (typeof v === "number") return v;
  const s = String(v).trim();
  return s ? s : fallback;
};

const activityTime = (it) => {
  const raw =
    it?.date_requested ||
    it?.date_issued ||
    it?.date_released ||
    it?.date_received ||
    it?.updatedAt ||
    it?.createdAt ||
    it?._id?.getTimestamp?.();
  const d = raw ? new Date(raw) : null;
  return d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
};

const isTerminalStatus = (requestStatus, itemStatus) => {
  const rs = norm(requestStatus);
  const st = norm(itemStatus);
  return (
    ["received", "transferred", "issued", "declined"].includes(rs) ||
    ["received", "transferred", "trasferred", "issued", "disposed", "declined"].includes(st)
  );
};

const distributionBelongsToUser = (dist, identifier) => {
  if (!dist || !identifier) return false;
  return (
    dist.distributedto === identifier ||
    dist.distributed_to === identifier ||
    dist.distributedto_is === identifier ||
    dist.distributed_to_is === identifier ||
    dist.requested_by === identifier ||
    dist.requested_by_id === identifier
  );
};

const getPropertyHolder = (item) => {
  if (!item) return "";
  const direct =
    item.current_holder ||
    item.current_holder_is ||
    item.currentHolder ||
    item.currentHolderId ||
    "";
  if (direct) return String(direct).trim();

  const st = normalizePropertyStatus(item.status);
  if (st === "In stock") return String(item.stored_to_is || item.stored_to || "").trim();
  if (st === "Issued") return String(item.issued_to_is || item.issued_to || "").trim();
  if (st === "For transfer")
    return String(item.issued_to_is || item.issued_to || "").trim();
  if (st === "Transferred")
    return String(
      item.transfered_to_is ||
        item.transferred_to_is ||
        item.transfered_to ||
        item.transferred_to ||
        ""
    ).trim();
  return String(item.issued_to_is || item.issued_to || "").trim();
};

const belongsToUser = (item, identifier) => {
  if (!identifier) return false;
  const requestorFields = [
    item?.requested_by,
    item?.requested_by_id,
    item?.requestedby,
    item?.requestedby_id,
    item?.requestor,
    item?.requestor_id,
    item?.requester,
    item?.requester_id,
  ];
  if (requestorFields.some((value) => String(value || "").trim() === identifier)) {
    return true;
  }
  if (item?.distributedto !== undefined || item?.distributed_to !== undefined) {
    return distributionBelongsToUser(item, identifier);
  }
  const holder = getPropertyHolder(item);
  return holder === identifier;
};

const buildOwnDistributionClauses = (identifiers = []) =>
  identifiers.flatMap((id) => [
    { distributedto: id },
    { distributed_to: id },
    { distributedto_is: id },
    { distributed_to_is: id },
    { requested_by: id },
    { requested_by_id: id },
  ]);

const buildOwnPropertyClauses = (identifiers = []) =>
  identifiers.flatMap((id) => [
    { requested_by: id },
    { requested_by_id: id },
    { requestedby: id },
    { requestedby_id: id },
    { requestor: id },
    { requestor_id: id },
    { requester: id },
    { requester_id: id },
    { current_holder: id },
    { current_holder_is: id },
    { currentHolder: id },
    { currentHolderId: id },
    { issued_to: id },
    { issued_to_is: id },
    { transfered_to: id },
    { transfered_to_is: id },
    { transferred_to: id },
    { transferred_to_is: id },
    { stored_to: id },
    { stored_to_is: id },
  ]);

const mergeOrClauses = (...groups) => {
  const clauses = groups.flat().filter(Boolean);
  return clauses.length ? { $or: clauses } : null;
};

const resolveUserDisplay = (raw, usersById = {}) => {
  if (!raw) return "";
  const val = String(raw).trim();
  if (!val) return "";
  if (!/^[a-f\d]{24}$/i.test(val)) return val;
  const u = usersById[val];
  return (u?.username || u?.email || "").trim();
};

const whoRequested = (it, usersById) => {
  const candidates = [
    it.requested_name,
    it.requester_name,
    it.requestor_name,
    it.requestedBy,
    it.requested_by,
    it.requestedby,
    it.requestor,
    it.requester,
    it.requested_by_id,
    it.requestor_id,
    it.requester_id,
    it.issued_by,
    it.issued_by_id,
    it.issued_to,
    it.issued_to_id,
  ];
  for (const c of candidates) {
    const resolved = resolveUserDisplay(c, usersById);
    if (resolved) return resolved;
  }
  return "";
};

const baseLine = (it) => {
  if (Array.isArray(it.items) && it.items.length) {
    const first = it.items[0];
    const quantity = first.quantity ?? it.quantity ?? it.qty ?? 1;
    return {
      itemName: cleanLabel(first.itemName || it.itemName || it.description, "Item"),
      classification: cleanLabel(first.classification || it.classification, "—"),
      quantity,
      unit: cleanLabel(first.unitofmeasure || first.unit || it.unitofmeasure || it.unit, ""),
    };
  }

  return {
    itemName: cleanLabel(it.itemName || it.description || it.property_no || it.stock_no, "Item"),
    classification: cleanLabel(it.classification || it.supplyType || it.category, "—"),
    quantity: it.qty ?? it.quantity ?? 1,
    unit: cleanLabel(it.unitofmeasure || it.unit, ""),
  };
};

const buildSupplySummary = async () => {
  const [summary] = await InventoryOfficeSupply.aggregate([
    {
      $project: {
        stock_qty: { $ifNull: ["$stock_qty", 0] },
        disposed_qty: { $ifNull: ["$disposed_qty", 0] },
        lowstock_threshold: { $ifNull: ["$lowstock_threshold", 10] },
      },
    },
    {
      $group: {
        _id: null,
        inStock: { $sum: { $cond: [{ $gt: ["$stock_qty", 0] }, 1, 0] } },
        outOfStock: { $sum: { $cond: [{ $lte: ["$stock_qty", 0] }, 1, 0] } },
        low: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gt: ["$stock_qty", 0] },
                  { $lte: ["$stock_qty", "$lowstock_threshold"] },
                ],
              },
              1,
              0,
            ],
          },
        },
        disposed: { $sum: "$disposed_qty" },
      },
    },
  ]);

  return (
    summary || {
      inStock: 0,
      outOfStock: 0,
      low: 0,
      disposed: 0,
    }
  );
};

const buildPropertySummary = async (Model) => {
  const [summary] = await Model.aggregate([
    {
      $project: {
        statusNorm: { $toLower: { $ifNull: ["$status", ""] } },
        requestNorm: { $toLower: { $ifNull: ["$requeststatus", ""] } },
      },
    },
    {
      $group: {
        _id: null,
        inStock: {
          $sum: {
            $cond: [{ $in: ["$statusNorm", ["instock", "in stock", "in-stock"]] }, 1, 0],
          },
        },
        issued: { $sum: { $cond: [{ $eq: ["$statusNorm", "issued"] }, 1, 0] } },
        transferred: {
          $sum: {
            $cond: [{ $in: ["$statusNorm", ["transferred", "trasferred"]] }, 1, 0],
          },
        },
        forTransfer: {
          $sum: {
            $cond: [{ $in: ["$statusNorm", ["for transfer", "for-transfer"]] }, 1, 0],
          },
        },
        forApproval: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ["$statusNorm", ["for transfer", "for-transfer"]] },
                  { $eq: ["$requestNorm", "for approval"] },
                ],
              },
              1,
              0,
            ],
          },
        },
        forIssuance: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ["$statusNorm", ["for transfer", "for-transfer"]] },
                  { $in: ["$requestNorm", ["for release", "for issuance"]] },
                ],
              },
              1,
              0,
            ],
          },
        },
        issuedTransfer: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ["$statusNorm", ["for transfer", "for-transfer"]] },
                  { $in: ["$requestNorm", ["issued", "released"]] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  return (
    summary || {
      inStock: 0,
      issued: 0,
      transferred: 0,
      forTransfer: 0,
      forApproval: 0,
      forIssuance: 0,
      issuedTransfer: 0,
    }
  );
};

const countMySupplies = async (identifiers) => {
  if (!identifiers.length) return 0;

  const matchOr = identifiers.flatMap((id) => [
    { distributedto: id },
    { distributed_to: id },
    { distributedto_is: id },
    { distributed_to_is: id },
  ]);

  const result = await Distribute.aggregate([
    {
      $match: {
        $and: [
          { $or: matchOr },
          { request_type: { $ne: "disposal" } },
          {
            $or: [
              { requeststatus: /^(approved|received)$/i },
              { status: /^transferred$/i },
            ],
          },
        ],
      },
    },
    {
      $project: {
        items: {
          $cond: [
            { $gt: [{ $size: { $ifNull: ["$items", []] } }, 0] },
            "$items",
            [
              {
                returnId: "$returnId",
                itemName: "$itemName",
                classification: "$classification",
              },
            ],
          ],
        },
      },
    },
    { $unwind: "$items" },
    {
      $addFields: {
        key: {
          $ifNull: [
            "$items.returnId",
            {
              $concat: [
                { $ifNull: ["$items.itemName", ""] },
                "|",
                { $ifNull: ["$items.classification", ""] },
              ],
            },
          ],
        },
      },
    },
    { $match: { key: { $ne: "|" } } },
    { $group: { _id: "$key" } },
    { $count: "count" },
  ]);

  return result?.[0]?.count || 0;
};

const countMyProperties = async (Model, identifiers) => {
  if (!identifiers.length) return 0;

  const matchOr = identifiers.flatMap((id) => [
    { current_holder: id },
    { current_holder_is: id },
    { currentHolder: id },
    { currentHolderId: id },
    { issued_to: id },
    { issued_to_is: id },
    { transfered_to: id },
    { transfered_to_is: id },
    { transferred_to: id },
    { transferred_to_is: id },
    { stored_to: id },
    { stored_to_is: id },
  ]);

  return Model.countDocuments({
    $and: [
      { $or: matchOr },
      {
        $or: [
          { status: /^(issued|transferred|for transfer)$/i },
          { requeststatus: /^to receive$/i },
        ],
      },
    ],
  });
};

export const getOfficeDashboard = async (req, res) => {
  try {
    const role = req?.user?.role || req?.user?._role || "";
    const username = req?.user?.username || req?.user?.email || "";
    const userId = req?.user?._id || req?.user?.id || "";
    const identifiers = [username, userId].filter(Boolean);

    const [
      canViewSupplies,
      canViewEquipment,
      canViewFurniture,
      canViewIct,
      canViewDistributions,
      canViewRequests,
      canViewUsersDirectory,
    ] = await Promise.all([
      hasAccessTag(role, "stocks.office_supplies"),
      hasAccessTag(role, "stocks.office_equipment"),
      hasAccessTag(role, "stocks.office_furniture"),
      hasAccessTag(role, "stocks.office_ict"),
      hasAccessTag(role, "stocks.distribution"),
      hasAccessTag(role, "stocks.request_queue"),
      hasAccessTag(role, "users.manage"),
    ]);

    const roleLower = String(role || "").toLowerCase();
    const isSuperAdmin = roleLower === "super admin" || roleLower === "superadmin";
    const isRD = role === "Regional Director";
    const isAFD = role === "AFD";
    const isInvAdmin = role === "Inventory Admin";
    const isPrivileged = isRD || isSuperAdmin;

    const [supplySummary, equipmentSummary, furnitureSummary, ictSummary] = await Promise.all([
      canViewSupplies ? buildSupplySummary() : null,
      canViewEquipment ? buildPropertySummary(InventoryOfficeEquipment) : null,
      canViewFurniture ? buildPropertySummary(InventoryOfficeFurnitureandFixture) : null,
      canViewIct ? buildPropertySummary(InventoryOfficeICTEquipment) : null,
    ]);

    const [mySupplies, myEquipment, myFurniture, myIct] = await Promise.all([
      countMySupplies(identifiers),
      countMyProperties(InventoryOfficeEquipment, identifiers),
      countMyProperties(InventoryOfficeFurnitureandFixture, identifiers),
      countMyProperties(InventoryOfficeICTEquipment, identifiers),
    ]);

    const totals = {
      supplies: mySupplies,
      equipment: myEquipment,
      furniture: myFurniture,
      ict: myIct,
    };

    const detail = {
      supplies:
        supplySummary || { inStock: 0, outOfStock: 0, low: 0, disposed: 0 },
      equipment:
        equipmentSummary || {
          inStock: 0,
          issued: 0,
          transferred: 0,
          forTransfer: 0,
          forApproval: 0,
          forIssuance: 0,
          issuedTransfer: 0,
        },
      furniture:
        furnitureSummary || {
          inStock: 0,
          issued: 0,
          transferred: 0,
          forTransfer: 0,
          forApproval: 0,
          forIssuance: 0,
          issuedTransfer: 0,
        },
      ict:
        ictSummary || {
          inStock: 0,
          issued: 0,
          transferred: 0,
          forTransfer: 0,
          forApproval: 0,
          forIssuance: 0,
          issuedTransfer: 0,
        },
    };

    const notifications = [];
    const shouldShowNotifications = canViewRequests || canViewDistributions || identifiers.length > 0;

    if (shouldShowNotifications) {
      const usersById = canViewUsersDirectory
        ? (await User.find({}).select("username email").lean()).reduce((acc, u) => {
            if (u && u._id) acc[u._id.toString()] = u;
            return acc;
          }, {})
        : {};

      const ownDistributionClauses = buildOwnDistributionClauses(identifiers);
      let distActionClauses = [];
      if (isAFD) {
        distActionClauses = [{ requeststatus: /for approval/i }];
      } else if (isInvAdmin) {
        distActionClauses = [{ requeststatus: /for checking/i }];
      } else if (isPrivileged) {
        distActionClauses = [
          { status: /pending/i },
          { status: /for transfer/i },
          { requeststatus: /for approval/i },
          { requeststatus: /for release/i },
          { requeststatus: /for checking/i },
          { requeststatus: /for issuance/i },
        ];
      }
      const distFilter = mergeOrClauses(distActionClauses, ownDistributionClauses);

      const canFetchDistDocs =
        canViewDistributions ||
        canViewRequests ||
        isAFD ||
        isInvAdmin ||
        isPrivileged ||
        identifiers.length > 0;
      const distDocs = canFetchDistDocs && distFilter
        ? await Distribute.find(distFilter)
            .sort({ createdAt: -1 })
            .limit(50)
            .lean()
        : [];

      const ownPropertyClauses = buildOwnPropertyClauses(identifiers);
      let propertyActionClauses = [];
      if (isAFD) {
        propertyActionClauses = [{ requeststatus: /for approval/i }];
      } else if (isInvAdmin) {
        propertyActionClauses = [{ requeststatus: /for release|for issuance/i }];
      } else if (isPrivileged) {
        propertyActionClauses = [
          { status: /pending/i },
          { status: /for transfer/i },
          { requeststatus: /for approval/i },
          { requeststatus: /for release/i },
          { requeststatus: /for checking/i },
          { requeststatus: /for issuance/i },
        ];
      }
      const propertyFilter = mergeOrClauses(propertyActionClauses, ownPropertyClauses);

      const fetchProps = async (Model) =>
        propertyFilter
          ? Model.find(propertyFilter)
              .sort({ date_requested: -1, updatedAt: -1, _id: -1 })
              .limit(50)
              .lean()
          : [];

      const [equipDocs, furnDocs, ictDocs] = await Promise.all([
        canViewEquipment || identifiers.length ? fetchProps(InventoryOfficeEquipment) : [],
        canViewFurniture || identifiers.length ? fetchProps(InventoryOfficeFurnitureandFixture) : [],
        canViewIct || identifiers.length ? fetchProps(InventoryOfficeICTEquipment) : [],
      ]);

      const allWatch = [
        ...distDocs,
        ...equipDocs,
        ...furnDocs,
        ...ictDocs,
      ].sort((a, b) => activityTime(b) - activityTime(a));

      const relevant = allWatch.filter((it) => {
        const rs = normalizeRequestStatus(it?.requeststatus || "");
        const st = normalizePropertyStatus(it?.status || "");
        const isOwn = identifiers.some((id) => belongsToUser(it, id));
        if (isOwn && !isTerminalStatus(it?.requeststatus, it?.status)) return true;
        if (isPrivileged) {
          return (
            st === "Pending" ||
            st === "For transfer" ||
            ["For Approval", "For Release", "For checking", "For Issuance"].includes(rs)
          );
        }
        if (isAFD) return rs === "For Approval";
        if (isInvAdmin) {
          if (it.items) return rs === "For checking";
          return rs === "For Release" || rs === "For Issuance";
        }
        if (isTerminalStatus(it?.requeststatus, it?.status)) return false;
        return (
          belongsToUser(it, username) ||
          belongsToUser(it, userId)
        );
      });

      const notifyItems = relevant.map((it) => {
        const st = normalizePropertyStatus(it?.status ?? "");
        const rs = normalizeRequestStatus(it?.requeststatus ?? "");
        const dist = Array.isArray(it.items);
        const line = baseLine(it);
        const requester = whoRequested(it, usersById);
        const recipient =
          resolveUserDisplay(
            it.distributedto ||
              it.distributed_to ||
              it.distributedto_is ||
              it.distributed_to_is ||
              it.transfered_to ||
              it.transferred_to ||
              it.issued_to ||
              it.stored_to ||
              "",
            usersById
          ) || cleanLabel(it.office || it.stored_to || "", "");

        let tone = "";
        let nextAction = "";
        const actionable =
          (isAFD && rs === "For Approval") ||
          (isInvAdmin && (dist ? rs === "For checking" : rs === "For Release" || rs === "For Issuance")) ||
          (isPrivileged && rs && !["Issued", "Transferred", "Received"].includes(rs));

        if (isAFD && rs === "For Approval") {
          tone = "needs your AFD approval";
          nextAction = "Review & approve";
        } else if (isInvAdmin && (dist ? rs === "For checking" : rs === "For Release" || rs === "For Issuance")) {
          tone = dist ? "needs your checking" : "needs your issuance";
          nextAction = dist ? "Check quantities" : "Prepare release";
        } else if (isPrivileged) {
          if (rs) {
            tone = `is moving (stage: ${rs})`;
            nextAction = "Review status";
          } else {
            tone = `status updated to ${st || "—"}`;
            nextAction = "Review details";
          }
        } else {
          tone = `update: ${rs || st || "—"}`;
          nextAction = "Track progress";
        }

        const qtyPart = line.unit
          ? `qty ${cleanLabel(line.quantity, 1)} ${cleanLabel(line.unit, "")}`
          : `qty ${cleanLabel(line.quantity, 1)}`;

        const whoPart = requester ? ` • requested by ${requester}` : "";
        const when =
          fmtDate(
            it.date_requested ||
              it.date_issued ||
              it.date_released ||
              it.date_received ||
              it.updatedAt ||
              it.createdAt
          ) || "—";

        const kind = dist ? "Supply" : "Property";
        const title = `${kind}: ${cleanLabel(line.itemName, "Item")}`;
        const summary = `${cleanLabel(line.classification, "—")} • ${qtyPart}${whoPart}`;
        const link = it._id
          ? dist || rs
            ? `/checkform/${it._id}`
            : `/checkitem/${it._id}`
          : "/request";

        const cta =
          (isAFD && rs === "For Approval") || (isInvAdmin && (dist ? rs === "For checking" : rs))
            ? "Review"
            : "View";

        const priority =
          (isAFD && rs === "For Approval") || (isInvAdmin && (dist ? rs === "For checking" : rs))
            ? "high"
            : rs
            ? "medium"
            : "low";

        const meta = [
          { label: "Status", value: rs || st || "—" },
          { label: "When", value: when },
        ];
        if (recipient) meta.splice(1, 0, { label: dist ? "To" : "Holder", value: recipient });
        if (requester) meta.push({ label: "By", value: requester });

        return {
          title,
          summary,
          meta,
          link,
          cta,
          badge: tone || "Update",
          nextAction,
          priority,
          actionable,
        };
      });

      notifications.push(
        ...(notifyItems.slice(0, 50).length
          ? notifyItems.slice(0, 50)
          : [
              {
                msg:
                  isPrivileged || isAFD || isInvAdmin
                    ? "No items currently need your action."
                    : "No recent updates on your items.",
                link: "/officedashboard",
                cta: "Refresh",
              },
            ])
      );
    }

    return res.status(200).json({ totals, detail, notifications });
  } catch (error) {
    console.error("Office dashboard error:", error);
    return res.status(500).json({ success: false, message: "Failed to load dashboard." });
  }
};
