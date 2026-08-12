import GatePass from "../models/GatePass.js";
import Counter from "../models/Counter.js";
import InventoryOfficeEquipment from "../models/InventoryOfficeEquipment.js";
import InventoryOfficeICTEquipment from "../models/InventoryOfficeICTEquipment.js";
import InventoryOfficeFurnitureandFixture from "../models/InventoryOfficeFurnitureandFixture.js";
import InventoryOfficeMotorandVehicle from "../models/InventoryOfficeMotorandVehicle.js";
import InventoryGovnetEquipment from "../models/InventoryGovnetEquipment.js";
import InventoryFreewifi from "../models/InventoryFreewifi.js";

const MODEL_MAP = {
  inventoryofficeequipment: InventoryOfficeEquipment,
  inventoryofficeICTequipment: InventoryOfficeICTEquipment,
  inventoryofficefurnitureandfixture: InventoryOfficeFurnitureandFixture,
  inventoryofficemotorandvehicle: InventoryOfficeMotorandVehicle,
  inventorygovnetequipment: InventoryGovnetEquipment,
  inventoryFreewifi: InventoryFreewifi,
  inventoryfreewifiequipment: InventoryFreewifi,
};

const OPEN_STATUSES = ["Draft", "For Approval", "For Release", "Released", "Out"];

const APPROVER_ROLES = new Set([
  "Super Admin",
  "Inventory Admin",
  "Regional Director",
  "Assistant Regional Director",
  "AFD",
  "AFD Special Access",
]);

const RELEASER_ROLES = new Set([
  "Super Admin",
  "Inventory Admin",
  "AFD",
  "AFD Special Access",
]);

function getModel(collection) {
  return MODEL_MAP[collection] || null;
}

function usernameOf(req) {
  return req.user?.username || req.user?.email || "unknown";
}

function roleOf(req) {
  return String(req.user?.role || "").trim();
}

function pushHistory(doc, action, by, note = "") {
  doc.history = doc.history || [];
  doc.history.push({ action, by, at: new Date(), note });
}

async function nextDocNumber(prefix, counterId) {
  const year = new Date().getFullYear();
  const counter = await Counter.findByIdAndUpdate(
    `${counterId}.${year}`,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  const seq = String(counter.seq).padStart(4, "0");
  return `${prefix}-${year}-${seq}`;
}

async function loadItem(collection, inventoryId) {
  const Model = getModel(collection);
  if (!Model) {
    const err = new Error(`Unknown inventory collection: ${collection}`);
    err.status = 400;
    throw err;
  }
  const item = await Model.findById(inventoryId);
  if (!item) {
    const err = new Error("Equipment not found");
    err.status = 404;
    throw err;
  }
  return { Model, item };
}

function canTakeOutside(item, username) {
  if (item.active_gatepass_id || item.outside_use) return false;
  const st = String(item.status || "").trim();
  if (st === "In Stock" && !item.issued_to) return { ok: true, source: "in_stock" };
  if (st === "Issued" && item.issued_to === username) {
    return { ok: true, source: "my_inventory" };
  }
  if (st === "Transferred" && item.transfered_to === username) {
    return { ok: true, source: "my_inventory" };
  }
  return { ok: false, source: null };
}

async function markItemOutside(collection, inventoryId, gatepassId, issueTo) {
  const Model = getModel(collection);
  if (!Model) return;
  const update = {
    outside_use: true,
    active_gatepass_id: String(gatepassId),
  };
  if (issueTo) {
    update.status = "Issued";
    update.issued_to = issueTo;
    update.date_issued = new Date();
  }
  await Model.findByIdAndUpdate(inventoryId, { $set: update }, { strict: false });
}

async function clearItemOutside(collection, inventoryId) {
  const Model = getModel(collection);
  if (!Model) return;
  await Model.findByIdAndUpdate(
    inventoryId,
    { $set: { outside_use: false, active_gatepass_id: null } },
    { strict: false }
  );
}

export const listGatePasses = async (_req, res) => {
  try {
    const rows = await GatePass.find().sort({ createdAt: -1 }).lean();
    return res.status(200).json(rows);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to list gatepasses" });
  }
};

export const getGatePass = async (req, res) => {
  try {
    const doc = await GatePass.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Gatepass not found" });
    return res.status(200).json(doc);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to get gatepass" });
  }
};

export const createGatePass = async (req, res) => {
  try {
    const purpose = String(req.body.purpose || "").trim();
    if (!purpose) return res.status(400).json({ message: "Purpose is required" });

    const requester = req.body.requester || usernameOf(req);
    const doc = await GatePass.create({
      requester,
      requester_id: req.user?._id ? String(req.user._id) : null,
      office: req.body.office || req.user?.position || "",
      fund_cluster: req.body.fund_cluster || "FREE WIFI",
      purpose,
      destination: req.body.destination || "",
      requeststatus: "Draft",
      date_requested: req.body.date_requested
        ? new Date(req.body.date_requested)
        : new Date(),
      items: [],
      history: [
        { action: "created", by: usernameOf(req), at: new Date(), note: "" },
      ],
    });
    return res.status(201).json(doc);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to create gatepass" });
  }
};

export const updateGatePass = async (req, res) => {
  try {
    const doc = await GatePass.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Gatepass not found" });
    if (doc.requeststatus !== "Draft") {
      return res.status(400).json({ message: "Only Draft gatepasses can be edited" });
    }
    if (req.body.purpose != null) doc.purpose = String(req.body.purpose).trim();
    if (req.body.fund_cluster != null) doc.fund_cluster = req.body.fund_cluster;
    if (req.body.destination != null) doc.destination = req.body.destination;
    if (req.body.office != null) doc.office = req.body.office;
    await doc.save();
    return res.status(200).json(doc);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to update gatepass" });
  }
};

export const addGatePassItem = async (req, res) => {
  try {
    const doc = await GatePass.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Gatepass not found" });
    if (doc.requeststatus !== "Draft") {
      return res.status(400).json({ message: "Items can only be added while Draft" });
    }

    const collection = req.body.collection;
    const inventoryId = req.body.inventoryId || req.body._id;
    if (!collection || !inventoryId) {
      return res.status(400).json({ message: "collection and inventoryId are required" });
    }
    if (doc.items.some((i) => String(i.inventoryId) === String(inventoryId))) {
      return res.status(400).json({ message: "Item already on this gatepass" });
    }

    const open = await GatePass.findOne({
      _id: { $ne: doc._id },
      requeststatus: { $in: OPEN_STATUSES },
      "items.inventoryId": String(inventoryId),
    }).lean();
    if (open) {
      return res.status(400).json({ message: "Item already on an open gatepass" });
    }

    const { item } = await loadItem(collection, inventoryId);
    const check = canTakeOutside(item, doc.requester);
    if (!check.ok) {
      return res.status(400).json({ message: "Item is not available for outside use" });
    }

    doc.items.push({
      inventoryId: String(item._id),
      collection,
      itemName: req.body.itemName || item.itemName || "",
      classification: req.body.classification || item.classification || "",
      qty: req.body.qty ?? item.qty ?? 1,
      unitofmeasure: req.body.unitofmeasure || item.unitofmeasure || "pc",
      property_no: req.body.property_no || item.property_no || "",
      serial_no: req.body.serial_no || item.serial_no || "",
      unit_cost: req.body.unit_cost ?? item.unit_cost ?? 0,
      source: check.source,
      prior_status: item.status || null,
      prior_issued_to: item.issued_to || null,
      scanned_by: usernameOf(req),
    });
    pushHistory(doc, "item_added", usernameOf(req), item.itemName || inventoryId);
    await doc.save();
    return res.status(200).json(doc);
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({ message: error.message || "Failed to add item" });
  }
};

export const removeGatePassItem = async (req, res) => {
  try {
    const doc = await GatePass.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Gatepass not found" });
    if (doc.requeststatus !== "Draft") {
      return res.status(400).json({ message: "Items can only be removed while Draft" });
    }
    const before = doc.items.length;
    doc.items = doc.items.filter(
      (i) => String(i.inventoryId) !== String(req.params.inventoryId)
    );
    if (doc.items.length === before) {
      return res.status(404).json({ message: "Item not found on gatepass" });
    }
    pushHistory(doc, "item_removed", usernameOf(req), req.params.inventoryId);
    await doc.save();
    return res.status(200).json(doc);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to remove item" });
  }
};

export const submitGatePass = async (req, res) => {
  try {
    const doc = await GatePass.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Gatepass not found" });
    if (doc.requeststatus !== "Draft") {
      return res.status(400).json({ message: "Only Draft can be submitted" });
    }
    if (!doc.items.length) {
      return res.status(400).json({ message: "Add at least one item before submit" });
    }
    doc.requeststatus = "For Approval";
    doc.date_requested = doc.date_requested || new Date();
    pushHistory(doc, "submitted", usernameOf(req));
    await doc.save();
    return res.status(200).json(doc);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to submit" });
  }
};

export const approveGatePass = async (req, res) => {
  try {
    if (!APPROVER_ROLES.has(roleOf(req))) {
      return res.status(403).json({ message: "Not allowed to approve" });
    }
    const doc = await GatePass.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Gatepass not found" });
    if (doc.requeststatus !== "For Approval") {
      return res.status(400).json({ message: "Gatepass is not For Approval" });
    }
    doc.requeststatus = "For Release";
    doc.approved_by = req.body.approved_by || usernameOf(req);
    doc.date_approved = new Date();
    pushHistory(doc, "approved", doc.approved_by);
    await doc.save();
    return res.status(200).json(doc);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to approve" });
  }
};

export const releaseGatePass = async (req, res) => {
  try {
    if (!RELEASER_ROLES.has(roleOf(req))) {
      return res.status(403).json({ message: "Not allowed to release" });
    }
    const doc = await GatePass.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Gatepass not found" });
    if (doc.requeststatus !== "For Release") {
      return res.status(400).json({ message: "Gatepass is not For Release" });
    }

    if (!doc.gatepass_no) doc.gatepass_no = await nextDocNumber("GP", "gatepass.GP");
    if (!doc.ics_no) doc.ics_no = await nextDocNumber("ICS", "gatepass.ICS");
    if (!doc.par_no) doc.par_no = await nextDocNumber("PAR", "gatepass.PAR");

    for (const it of doc.items) {
      const issueTo = it.source === "in_stock" ? doc.requester : null;
      await markItemOutside(it.collection, it.inventoryId, doc._id, issueTo);
    }

    doc.requeststatus = "Released";
    doc.released_by = req.body.released_by || usernameOf(req);
    doc.date_released = new Date();
    pushHistory(doc, "released", doc.released_by);
    await doc.save();
    return res.status(200).json(doc);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to release" });
  }
};

export const guardGatePass = async (req, res) => {
  try {
    const doc = await GatePass.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Gatepass not found" });
    if (doc.requeststatus !== "Released") {
      return res.status(400).json({ message: "Gatepass must be Released first" });
    }
    const guard = String(req.body.guard_on_duty || "").trim();
    if (!guard) return res.status(400).json({ message: "guard_on_duty is required" });
    doc.requeststatus = "Out";
    doc.guard_on_duty = guard;
    doc.date_out = new Date();
    pushHistory(doc, "out", usernameOf(req), guard);
    await doc.save();
    return res.status(200).json(doc);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to confirm out" });
  }
};

export const returnGatePass = async (req, res) => {
  try {
    const doc = await GatePass.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Gatepass not found" });
    if (!["Released", "Out"].includes(doc.requeststatus)) {
      return res.status(400).json({ message: "Gatepass is not out for return" });
    }
    for (const it of doc.items) {
      await clearItemOutside(it.collection, it.inventoryId);
    }
    doc.requeststatus = "Returned";
    doc.date_returned = new Date();
    pushHistory(doc, "returned", usernameOf(req));
    await doc.save();
    return res.status(200).json(doc);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to return" });
  }
};

export const declineGatePass = async (req, res) => {
  try {
    const doc = await GatePass.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Gatepass not found" });
    if (["Out", "Returned"].includes(doc.requeststatus)) {
      return res.status(400).json({ message: "Cannot decline after equipment is out/returned" });
    }
    if (["Released", "Out"].includes(doc.requeststatus)) {
      for (const it of doc.items) {
        await clearItemOutside(it.collection, it.inventoryId);
      }
    }
    doc.requeststatus = "Declined";
    doc.declined_by = req.body.declined_by || usernameOf(req);
    pushHistory(doc, "declined", doc.declined_by);
    await doc.save();
    return res.status(200).json(doc);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to decline" });
  }
};
