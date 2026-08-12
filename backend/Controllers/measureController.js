import Measure from './../models/Measure.js';
import { createLog } from "./logsController.js";
import { buildSearchFilter, parsePagination } from "../utils/pagination.js";

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

const formatValue = (value) => {
  if (value === undefined) return "—";
  if (value === null) return "null";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const diffFromPayload = (before, after, payload) => {
  const keys = Object.keys(payload || {});
  const changes = [];
  keys.forEach((key) => {
    const b = before?.[key];
    const a = after?.[key];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      changes.push(`${key}: "${formatValue(b)}" → "${formatValue(a)}"`);
    }
  });
  return changes;
};

const escapeRegExp = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// create new measure
export const createMeasure = async (req, res) => {
   try {
      const description = String(req.body?.description || "").trim();
      const designation = String(req.body?.designation || "").trim();
      if (description && designation) {
         const existing = await Measure.findOne({
            description: new RegExp(`^${escapeRegExp(description)}$`, "i"),
            designation: new RegExp(`^${escapeRegExp(designation)}$`, "i"),
         });
         if (existing) {
            return res.status(409).json({
               success: false,
               message: "Measure already exists for this designation.",
            });
         }
      }
      const newMeasure = new Measure({
         ...req.body,
      });

      // Save the measure
      const savedMeasure = await newMeasure.save();

      await safeCreateLog({
         userId: actorFromReq(req),
         action: `Measure - Create (${savedMeasure.description || savedMeasure._id})`,
         status: "success",
         time: nowISO(),
      });

      res.status(200).json({
         success: true,
         message: "Measure created successfully!",
         data: savedMeasure,
      });
   } catch (error) {
      console.error(error);
      await safeCreateLog({
         userId: actorFromReq(req),
         action: "Measure - Create",
         status: "error",
         time: nowISO(),
      });
      res.status(500).json({
         success: false,
         message: "Internal server error!",
      });
   }
};

// get all measures
export const getAllMeasures = async (req, res) => {
   try {
      const { page, limit, skip, hasPaging } = parsePagination(req, {
         page: 1,
         limit: 20,
      });
      const search = req.query?.search;
      const designation = req.query?.designation;
      const activeRaw = req.query?.active;
      const active =
         activeRaw === "true" ? true : activeRaw === "false" ? false : undefined;
      const sortRaw = req.query?.sort;

      const sort = (() => {
         if (!sortRaw) return { description: 1 };
         const [field, dir] = String(sortRaw).split(":");
         const allowed = ["description", "designation", "active", "createdAt"];
         if (!allowed.includes(field)) return { description: 1 };
         return { [field]: dir === "desc" ? -1 : 1 };
      })();

      const filter = {
         ...(designation ? { designation } : {}),
         ...(active !== undefined ? { active } : {}),
         ...buildSearchFilter(search, ["description", "designation"]),
      };

      if (!hasPaging) {
         const measures = await Measure.find(filter).sort(sort);
         return res.status(200).json(measures);
      }

      const [data, total] = await Promise.all([
         Measure.find(filter).sort(sort).skip(skip).limit(limit),
         Measure.countDocuments(filter),
      ]);

      res.status(200).json({ data, total, page, limit });
   } catch (error) {
      res.status(500).json({
         success: false,
         message: "Internal server error!",
      });
   }
};

// get single measure
export const getMeasure = async (req, res) => {
   const id = req.params.id;

   try {
      const measure = await Measure.findById(id);

      if (!measure) {
         return res.status(404).json({
            success: false,
            message: "Measure not found!",
         });
      }

      res.status(200).json({
         success: true,
         message: "Successful!",
         data: measure,
      });
   } catch (error) {
      res.status(500).json({
         success: false,
         message: "Internal server error!",
      });
   }
};

// update measure
export const updateMeasure = async (req, res) => {
   const id = req.params.id;
   const updateData = req.body;

   try {
      const before = await Measure.findById(id);
      if (!before) {
         return res.status(404).json({
            success: false,
            message: "Measure not found!",
         });
      }

      const version = req.body?.__v;
      if (version !== undefined && Number(before.__v) !== Number(version)) {
         return res.status(409).json({
            success: false,
            message: "Version conflict. Please refresh and try again.",
         });
      }

      if ("__v" in updateData) delete updateData.__v;

      const nextDescription = String(updateData?.description ?? before?.description ?? "").trim();
      const nextDesignation = String(updateData?.designation ?? before?.designation ?? "").trim();
      if (nextDescription && nextDesignation) {
         const dup = await Measure.findOne({
            _id: { $ne: id },
            description: new RegExp(`^${escapeRegExp(nextDescription)}$`, "i"),
            designation: new RegExp(`^${escapeRegExp(nextDesignation)}$`, "i"),
         });
         if (dup) {
            return res.status(409).json({
               success: false,
               message: "Measure already exists for this designation.",
            });
         }
      }

      const updatedMeasure = await Measure.findOneAndUpdate(
         { _id: id, ...(version !== undefined ? { __v: Number(version) } : {}) },
         {
            $set: updateData,
            $inc: { __v: 1 },
         },
         { new: true }
      );

      if (!updatedMeasure) {
         return res.status(404).json({
            success: false,
            message: "Measure not found!",
         });
      }

      const changes = diffFromPayload(before, updatedMeasure, updateData);
      const baseLabel = updatedMeasure.description || updatedMeasure._id;
      let action = `Measure - Update (${baseLabel})`;
      if (changes.length) action += ` | ${changes.join(" | ")}`;

      await safeCreateLog({
         userId: actorFromReq(req),
         action,
         status: "success",
         time: nowISO(),
      });

      res.status(200).json({
         success: true,
         message: "Measure updated successfully!",
         data: updatedMeasure,
      });
   } catch (error) {
      await safeCreateLog({
         userId: actorFromReq(req),
         action: `Measure - Update (${id})`,
         status: "error",
         time: nowISO(),
      });
      res.status(500).json({
         success: false,
         message: "Internal server error!",
      });
   }
};

// delete measure (soft deactivate)
export const deleteMeasure = async (req, res) => {
   const id = req.params.id;

   try {
      const measure = await Measure.findById(id);

      if (!measure) {
         await safeCreateLog({
            userId: actorFromReq(req),
            action: `Measure - Deactivate (Not Found: ${id})`,
            status: "error",
            time: nowISO(),
         });
         return res.status(404).json({
            success: false,
            message: "Measure not found!",
         });
      }

      measure.active = false;
      await measure.save();

      await safeCreateLog({
         userId: actorFromReq(req),
         action: `Measure - Deactivate (${measure.description || measure._id})`,
         status: "success",
         time: nowISO(),
      });

      res.status(200).json({
         success: true,
         message: "Measure deactivated successfully!",
         data: measure,
      });
   } catch (error) {
      await safeCreateLog({
         userId: actorFromReq(req),
         action: `Measure - Deactivate (${id})`,
         status: "error",
         time: nowISO(),
      });
      res.status(500).json({
         success: false,
         message: "Internal server error!",
      });
   }
};

// get number of all measures
export const getNumberOfMeasures = async (req, res) => {
   try {
      const count = await Measure.countDocuments();

      res.status(200).json({
         success: true,
         message: "Successful!",
         data: count,
      });
   } catch (error) {
      res.status(500).json({
         success: false,
         message: "Internal server error!",
      });
   }
};
