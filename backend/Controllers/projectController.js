import Project from "../models/Project.js";
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

const normalizeProjectName = (name) =>
  String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const normalizeFundCluster = (value) => {
  const raw = String(value || "").trim().toUpperCase();
  return raw === "AFD" ? "AFD" : "TOD";
};

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

const ensureDefaults = async () => {
  const existing = await Project.find().select("normalized").lean();
  const existingSet = new Set(existing.map((p) => p.normalized));
  const toInsert = DEFAULT_PROJECTS.filter(
    (name) => !existingSet.has(normalizeProjectName(name))
  ).map((name) => ({
    name,
    normalized: normalizeProjectName(name),
    active: true,
    fund_cluster: "TOD",
  }));
  if (toInsert.length) {
    await Project.insertMany(toInsert, { ordered: true });
  }
};

export const getProjects = async (req, res) => {
  try {
    await ensureDefaults();
    const activeOnly = String(req.query?.activeOnly || "").toLowerCase() === "1";
    const query = activeOnly ? { active: true } : {};
    const projects = await Project.find(query).sort({ name: 1 }).lean();
    const normalizedProjects = projects.map((p) => ({
      ...p,
      fund_cluster: p?.fund_cluster ? normalizeFundCluster(p.fund_cluster) : "TOD",
    }));
    return res.status(200).json(normalizedProjects);
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to load projects." });
  }
};

export const createProject = async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) {
      return res.status(400).json({ success: false, message: "Project name is required." });
    }
    const normalized = normalizeProjectName(name);
    const existing = await Project.findOne({ normalized }).lean();
    if (existing) {
      return res.status(409).json({ success: false, message: "Project already exists." });
    }
    const fund_cluster = normalizeFundCluster(req.body?.fund_cluster);
    const project = await Project.create({
      name,
      normalized,
      active: true,
      fund_cluster,
    });
    await safeCreateLog({
      userId: actorFromReq(req),
      action: `Project - Create (${name})`,
      status: "success",
      time: nowISO(),
    });
    return res.status(201).json(project);
  } catch (err) {
    await safeCreateLog({
      userId: actorFromReq(req),
      action: "Project - Create",
      status: "error",
      time: nowISO(),
    });
    return res.status(500).json({ success: false, message: "Failed to create project." });
  }
};

export const updateProject = async (req, res) => {
  try {
    const id = req.params?.id;
    if (!id) {
      return res.status(400).json({ success: false, message: "Project id is required." });
    }
    const updates = {};
    if ("active" in req.body) {
      updates.active = !!req.body.active;
    }
    if ("name" in req.body) {
      const name = String(req.body?.name || "").trim();
      if (!name) {
        return res.status(400).json({ success: false, message: "Project name is required." });
      }
      updates.name = name;
      updates.normalized = normalizeProjectName(name);
    }
    if ("fund_cluster" in req.body) {
      updates.fund_cluster = normalizeFundCluster(req.body?.fund_cluster);
    }
    const project = await Project.findByIdAndUpdate(id, updates, {
      new: true,
    }).lean();
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found." });
    }
    await safeCreateLog({
      userId: actorFromReq(req),
      action: `Project - Update (${project.name})`,
      status: "success",
      time: nowISO(),
    });
    return res.status(200).json(project);
  } catch (err) {
    await safeCreateLog({
      userId: actorFromReq(req),
      action: "Project - Update",
      status: "error",
      time: nowISO(),
    });
    return res.status(500).json({ success: false, message: "Failed to update project." });
  }
};
