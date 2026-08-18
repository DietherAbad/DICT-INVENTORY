import InventoryOfficeEquipment from "../models/InventoryOfficeEquipment.js";
import InventoryOfficeFurnitureandfixture from "../models/InventoryOfficeFurnitureandFixture.js";
import InventoryOfficeICTequipment from "../models/InventoryOfficeICTEquipment.js";
import InventoryOfficeMotorandVehicle from "../models/InventoryOfficeMotorandVehicle.js";
import Distribute from "../models/Distribute.js";
import User from "../models/User.js";
import { buildSearchFilter, buildStatusFilter, parsePagination } from "../utils/pagination.js";
import { hasAccessTag } from "../utils/rbac.js";

const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const getSortDate = (item) => {
  const candidates = [
    item?.date_received,
    item?.date_released,
    item?.date_approved,
    item?.date_checked,
    item?.date_requested,
    item?.date_issued,
    item?.updatedAt,
    item?.createdAt,
    item?.date,
  ];
  for (const val of candidates) {
    const parsed = parseDate(val);
    if (parsed) return parsed;
  }
  return null;
};

const buildRequestStatusFilter = (requeststatus) => {
  if (!requeststatus) return {};
  const raw = String(requeststatus).trim();
  if (!raw) return {};
  const normalized = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s-]*");
  return { requeststatus: new RegExp(`^${normalized}$`, "i") };
};

const buildRecipientFilter = (recipientId, recipientName) => {
  const or = [];
  if (recipientId) {
    or.push(
      { transfered_to_id: recipientId },
      { transferedto_id: recipientId },
      { transferred_to_id: recipientId },
      { transfered_to_is: recipientId },
      { transferedto_is: recipientId },
      { transferred_to_is: recipientId },
      { transfered_to: recipientId },
      { transferedto: recipientId },
      { transferred_to: recipientId },
      { issued_to_id: recipientId },
      { current_holder_id: recipientId }
    );
  }

  if (recipientName) {
    or.push(
      { transfered_to: recipientName },
      { transferedto: recipientName },
      { transferred_to: recipientName },
      { issued_to: recipientName },
      { current_holder: recipientName }
    );
  }

  return or.length ? { $or: or } : {};
};

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const exactValueCandidates = (values) =>
  values.flatMap((value) => {
    const text = String(value || "").trim();
    return text ? [text, new RegExp(`^${escapeRegex(text)}$`, "i")] : [];
  });

const buildEmployeePropertyLinkFilter = (identifiers) => {
  const candidates = exactValueCandidates(identifiers);
  const fields = [
    "issued_to",
    "issued_to_id",
    "issued_to_is",
    "current_holder",
    "current_holder_id",
    "current_holder_is",
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
  return { $or: fields.map((field) => ({ [field]: { $in: candidates } })) };
};

export const getEmployeeAssetLookup = async (req, res) => {
  try {
    const userId = String(req.query?.userId || "").trim();
    const query = String(req.query?.q || "").trim();

    if (!userId) {
      if (query.length < 2) return res.status(200).json({ users: [] });
      const pattern = new RegExp(escapeRegex(query), "i");
      const users = await User.find({
        active: { $ne: false },
        $or: [
          { username: pattern },
          { email: pattern },
          { position: pattern },
          { designation: pattern },
        ],
      })
        .select("username email position designation role active")
        .sort({ username: 1 })
        .limit(20)
        .lean();
      return res.status(200).json({ users });
    }

    const employee = await User.findById(userId)
      .select("username email position designation role active")
      .lean();
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found." });
    }

    const identifiers = [employee._id, employee.username, employee.email]
      .filter(Boolean)
      .map(String);
    const propertyFilter = buildEmployeePropertyLinkFilter(identifiers);
    const distributionCandidates = exactValueCandidates(identifiers);
    const supplyFilter = {
      $or: [
        { distributedto_is: { $in: distributionCandidates } },
        { distributed_to_is: { $in: distributionCandidates } },
        { distributedto: { $in: distributionCandidates } },
        { distributed_to: { $in: distributionCandidates } },
      ],
    };

    const propertyFields =
      "itemName classification property_no serial_no specifications asset_type asset_id qty unitofmeasure unit_cost total_cost project status date_acquired date_issued date_received current_holder current_holder_id issued_to issued_to_id thumbnail";
    const [equipment, furniture, ict, distributions] = await Promise.all([
      InventoryOfficeEquipment.find(propertyFilter).select(propertyFields).sort({ date_issued: -1 }).lean(),
      InventoryOfficeFurnitureandfixture.find(propertyFilter).select(propertyFields).sort({ date_issued: -1 }).lean(),
      InventoryOfficeICTequipment.find(propertyFilter).select(propertyFields).sort({ date_issued: -1 }).lean(),
      Distribute.find(supplyFilter)
        .select("RIS_no items office remarks status requeststatus date_requested date_received distributedto distributedto_is")
        .sort({ date_received: -1, date_requested: -1 })
        .lean(),
    ]);

    const decorateProperties = (records, category, detailPath) =>
      records.map((item) => ({ ...item, category, detailPath: `${detailPath}/${item._id}` }));
    const propertyAssets = [
      ...decorateProperties(equipment, "Office Equipment", "/checkitem"),
      ...decorateProperties(furniture, "Furniture & Fixtures", "/checkitemfurniture"),
      ...decorateProperties(ict, "ICT Equipment", "/checkitemict"),
    ];
    const supplies = distributions.flatMap((distribution) =>
      (Array.isArray(distribution.items) ? distribution.items : []).map((item) => ({
        _id: `${distribution._id}:${item._id || item.returnId || item.stock_no}`,
        distributionId: distribution._id,
        risNo: distribution.RIS_no,
        category: "Office Supply",
        itemName: item.itemName,
        classification: item.classification,
        stockNo: item.stock_no,
        quantity: Number(item.quantity || 0),
        unitofmeasure: item.unitofmeasure,
        totalCost: Number(item.cost || 0),
        office: distribution.office,
        remarks: distribution.remarks,
        dateReceived: distribution.date_received || distribution.date_requested,
        workflowStatus: distribution.requeststatus || distribution.status,
        detailPath: `/checkform/${distribution._id}`,
      }))
    );

    const propertyValue = propertyAssets.reduce(
      (sum, item) => sum + Number(item.total_cost ?? Number(item.unit_cost || 0) * Number(item.qty || 0)),
      0
    );
    const supplyValue = supplies.reduce((sum, item) => sum + Number(item.totalCost || 0), 0);

    return res.status(200).json({
      employee,
      propertyAssets,
      supplies,
      summary: {
        propertyItems: propertyAssets.length,
        supplyLines: supplies.length,
        supplyUnits: supplies.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        totalValue: propertyValue + supplyValue,
      },
    });
  } catch (error) {
    console.error("getEmployeeAssetLookup error:", error);
    return res.status(500).json({ success: false, message: "Unable to load employee assets." });
  }
};

const buildViewFilter = (view) => {
  if (!view) return {};
  const raw = String(view).trim().toLowerCase();
  if (!raw) return {};

  if (raw === "disposals") {
    return {
      $or: [
        { status: /^(for disposal|disposed)$/i },
        { requeststatus: /^for approval$/i },
      ],
    };
  }

  if (raw === "transfers") {
    return {
      $or: [
        { status: /^(for transfer|transferred)$/i },
        { requeststatus: /^(for approval|for release|to receive)$/i },
      ],
    };
  }

  if (raw === "returns") {
    return {
      $or: [
        { status: /^for return to inventory$/i },
        { status: /^return to inventory$/i },
        { requeststatus: /^(for approval|to receive)$/i },
      ],
    };
  }

  return {};
};

export const getPropertyRequests = async (req, res) => {
  try {
    const role = req?.user?.role;
    const requesterId =
      req?.user?._id || req?.user?.id || req?.user?.userId || req?.headers?.["x-user-id"];
    const requesterName =
      req?.user?.username || req?.user?.email || req?.user?.name || req?.headers?.["x-user-email"];
    const canViewAll = await hasAccessTag(role, "stocks.request_queue");

    const { page, limit, skip, hasPaging } = parsePagination(req, {
      page: 1,
      limit: 20,
    });

    const status = req.query?.status;
    const requeststatus = req.query?.requeststatus;
    const search = req.query?.search;
    const recipientId = req.query?.recipientId;
    const recipientName = req.query?.recipientName;
    const view = req.query?.view;

    const viewFilter = buildViewFilter(view);
    const filter = {
      ...(status ? buildStatusFilter(status) : {}),
      ...buildRequestStatusFilter(requeststatus),
      ...buildSearchFilter(search, [
        "property_no",
        "itemName",
        "classification",
        "project",
        "unitofmeasure",
        "status",
        "requeststatus",
        "issued_to",
        "current_holder",
        "transfered_to",
      ]),
      ...buildRecipientFilter(recipientId, recipientName),
    };

    if (!canViewAll) {
      const selfRecipientId = requesterId ? String(requesterId) : null;
      const selfRecipientName = requesterName ? String(requesterName) : null;
      if (!selfRecipientId && !selfRecipientName) {
        return res.status(403).json({ error: "Access denied" });
      }
      const selfFilter = buildRecipientFilter(selfRecipientId, selfRecipientName);
      filter.$and = filter.$and || [];
      filter.$and.push(selfFilter);
    }

    if (viewFilter.$or) {
      filter.$and = filter.$and || [];
      filter.$and.push(viewFilter);
    }

    const sort = {
      date_requested: -1,
      date_released: -1,
      date_approved: -1,
      date_received: -1,
      updatedAt: -1,
      createdAt: -1,
      _id: -1,
    };

    const take = page * limit;

    const decorate = (items, category) =>
      items.map((item) => ({
        ...(item?.toObject ? item.toObject() : item),
        category,
      }));

    if (!hasPaging) {
      const [eq, furn, ict, vehicle] = await Promise.all([
        InventoryOfficeEquipment.find(filter).sort(sort),
        InventoryOfficeFurnitureandfixture.find(filter).sort(sort),
        InventoryOfficeICTequipment.find(filter).sort(sort),
        InventoryOfficeMotorandVehicle.find(filter).sort(sort),
      ]);
      const data = [
        ...decorate(eq, "equipment"),
        ...decorate(furn, "furniture"),
        ...decorate(ict, "ict"),
        ...decorate(vehicle, "equipment"),
      ].sort((a, b) => {
        const da = getSortDate(a);
        const db = getSortDate(b);
        const av = da ? da.getTime() : 0;
        const bv = db ? db.getTime() : 0;
        return bv - av;
      });
      return res.status(200).json(data);
    }

    const [eq, furn, ict, vehicle, totalEq, totalFurn, totalIct, totalVeh] =
      await Promise.all([
        InventoryOfficeEquipment.find(filter).sort(sort).limit(take),
        InventoryOfficeFurnitureandfixture.find(filter).sort(sort).limit(take),
        InventoryOfficeICTequipment.find(filter).sort(sort).limit(take),
        InventoryOfficeMotorandVehicle.find(filter).sort(sort).limit(take),
        InventoryOfficeEquipment.countDocuments(filter),
        InventoryOfficeFurnitureandfixture.countDocuments(filter),
        InventoryOfficeICTequipment.countDocuments(filter),
        InventoryOfficeMotorandVehicle.countDocuments(filter),
      ]);

    const combined = [
      ...decorate(eq, "equipment"),
      ...decorate(furn, "furniture"),
      ...decorate(ict, "ict"),
      ...decorate(vehicle, "equipment"),
    ].sort((a, b) => {
      const da = getSortDate(a);
      const db = getSortDate(b);
      const av = da ? da.getTime() : 0;
      const bv = db ? db.getTime() : 0;
      return bv - av;
    });

    const data = combined.slice(skip, skip + limit);
    const total = totalEq + totalFurn + totalIct + totalVeh;

    return res.status(200).json({ data, total, page, limit });
  } catch (error) {
    console.error("getPropertyRequests error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
