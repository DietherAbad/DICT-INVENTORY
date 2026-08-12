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

const normalizeDesignation = (name) =>
  String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

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

const ensureDefaults = async () => {
  const count = await Designation.countDocuments();
  if (count > 0) return;

  const toInsert = DEFAULT_DESIGNATIONS.map((name) => ({
    name,
    normalized: normalizeDesignation(name),
    active: true,
  }));
  if (toInsert.length) {
    await Designation.insertMany(toInsert, { ordered: true });
  }
};

export const getDesignations = async (req, res) => {
  try {
    await ensureDefaults();
    const activeOnly = String(req.query?.activeOnly || "").toLowerCase() === "1";
    const query = activeOnly ? { active: true } : {};
    const list = await Designation.find(query).sort({ name: 1 }).lean();
    return res.status(200).json(list);
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to load designations." });
  }
};

export const createDesignation = async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) {
      return res
        .status(400)
        .json({ success: false, message: "Designation name is required." });
    }
    const normalized = normalizeDesignation(name);
    const existing = await Designation.findOne({ normalized }).lean();
    if (existing) {
      return res.status(409).json({ success: false, message: "Designation already exists." });
    }
    const designation = await Designation.create({
      name,
      normalized,
      active: true,
    });
    await safeCreateLog({
      userId: actorFromReq(req),
      action: `Designation - Create (${name})`,
      status: "success",
      time: nowISO(),
    });
    return res.status(201).json(designation);
  } catch (err) {
    await safeCreateLog({
      userId: actorFromReq(req),
      action: "Designation - Create",
      status: "error",
      time: nowISO(),
    });
    return res.status(500).json({ success: false, message: "Failed to create designation." });
  }
};

export const updateDesignation = async (req, res) => {
  try {
    const id = req.params?.id;
    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Designation id is required." });
    }
    const updates = {};
    if ("active" in req.body) {
      updates.active = !!req.body.active;
    }
    if ("name" in req.body) {
      const name = String(req.body?.name || "").trim();
      if (!name) {
        return res
          .status(400)
          .json({ success: false, message: "Designation name is required." });
      }
      updates.name = name;
      updates.normalized = normalizeDesignation(name);
    }
    const designation = await Designation.findByIdAndUpdate(id, updates, {
      new: true,
    }).lean();
    if (!designation) {
      return res.status(404).json({ success: false, message: "Designation not found." });
    }
    await safeCreateLog({
      userId: actorFromReq(req),
      action: `Designation - Update (${designation.name})`,
      status: "success",
      time: nowISO(),
    });
    return res.status(200).json(designation);
  } catch (err) {
    await safeCreateLog({
      userId: actorFromReq(req),
      action: "Designation - Update",
      status: "error",
      time: nowISO(),
    });
    return res.status(500).json({ success: false, message: "Failed to update designation." });
  }
};
