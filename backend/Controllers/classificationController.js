import Classification from './../models/Classification.js';
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

// create new classification
export const createClassification = async (req, res) => {
   try {
      const description = String(req.body?.description || "").trim();
      const designation = String(req.body?.designation || "").trim();
      if (description && designation) {
         const existing = await Classification.findOne({
            description: new RegExp(`^${escapeRegExp(description)}$`, "i"),
            designation: new RegExp(`^${escapeRegExp(designation)}$`, "i"),
         });
         if (existing) {
            return res.status(409).json({
               success: false,
               message: "Classification already exists for this designation.",
            });
         }
      }
      const newClassification = new Classification({
         ...req.body,
      });

      // Save the classification
      const savedClassification = await newClassification.save();

      await safeCreateLog({
         userId: actorFromReq(req),
         action: `Classification - Create (${savedClassification.description || savedClassification._id})`,
         status: "success",
         time: nowISO(),
      });

      res.status(200).json({
         success: true,
         message: "Classification created successfully!",
         data: savedClassification,
      });
   } catch (error) {
     console.error(error);
     await safeCreateLog({
        userId: actorFromReq(req),
        action: "Classification - Create",
        status: "error",
        time: nowISO(),
     });
      res.status(500).json({
         success: false,
         message: "Internal server error!",
      });
   }
};

// get all classifications
export const getAllClassifications = async (req, res) => {
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
         const classifications = await Classification.find(filter).sort(sort);
         return res.status(200).json(classifications);
      }

      const [data, total] = await Promise.all([
         Classification.find(filter).sort(sort).skip(skip).limit(limit),
         Classification.countDocuments(filter),
      ]);

      res.status(200).json({ data, total, page, limit });
   } catch (error) {
      res.status(500).json({
         success: false,
         message: "Internal server error!",
      });
   }
};

// get single classification
export const getClassification = async (req, res) => {
   const id = req.params.id;

   try {
      const classification = await Classification.findById(id);

      if (!classification) {
         return res.status(404).json({
            success: false,
            message: "Classification not found!",
         });
      }

      res.status(200).json({
         success: true,
         message: "Successful!",
         data: classification,
      });
   } catch (error) {
      res.status(500).json({
         success: false,
         message: "Internal server error!",
      });
   }
};

// update classification
export const updateClassification = async (req, res) => {
   const id = req.params.id;
   const updateData = req.body;

   try {
      const before = await Classification.findById(id);
      if (!before) {
         return res.status(404).json({
            success: false,
            message: "Classification not found!",
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
         const dup = await Classification.findOne({
            _id: { $ne: id },
            description: new RegExp(`^${escapeRegExp(nextDescription)}$`, "i"),
            designation: new RegExp(`^${escapeRegExp(nextDesignation)}$`, "i"),
         });
         if (dup) {
            return res.status(409).json({
               success: false,
               message: "Classification already exists for this designation.",
            });
         }
      }

      const updatedClassification = await Classification.findOneAndUpdate(
         { _id: id, ...(version !== undefined ? { __v: Number(version) } : {}) },
         {
            $set: updateData,
            $inc: { __v: 1 },
         },
         { new: true }
      );

      if (!updatedClassification) {
         return res.status(404).json({
            success: false,
            message: "Classification not found!",
         });
      }

      const changes = diffFromPayload(before, updatedClassification, updateData);
      const baseLabel = updatedClassification.description || updatedClassification._id;
      let action = `Classification - Update (${baseLabel})`;
      if (changes.length) action += ` | ${changes.join(" | ")}`;

      await safeCreateLog({
         userId: actorFromReq(req),
         action,
         status: "success",
         time: nowISO(),
      });

      res.status(200).json({
         success: true,
         message: "Classification updated successfully!",
         data: updatedClassification,
      });
   } catch (error) {
      await safeCreateLog({
         userId: actorFromReq(req),
         action: `Classification - Update (${id})`,
         status: "error",
         time: nowISO(),
      });
      res.status(500).json({
         success: false,
         message: "Internal server error!",
      });
   }
};

// delete classification (soft deactivate)
export const deleteClassification = async (req, res) => {
   const id = req.params.id;

   try {
      const classification = await Classification.findById(id);

      if (!classification) {
         await safeCreateLog({
            userId: actorFromReq(req),
            action: `Classification - Deactivate (Not Found: ${id})`,
            status: "error",
            time: nowISO(),
         });
         return res.status(404).json({
            success: false,
            message: "Classification not found!",
         });
      }

      classification.active = false;
      await classification.save();

      await safeCreateLog({
         userId: actorFromReq(req),
         action: `Classification - Deactivate (${classification.description || classification._id})`,
         status: "success",
         time: nowISO(),
      });

      res.status(200).json({
         success: true,
         message: "Classification deactivated successfully!",
         data: classification,
      });
   } catch (error) {
      await safeCreateLog({
         userId: actorFromReq(req),
         action: `Classification - Deactivate (${id})`,
         status: "error",
         time: nowISO(),
      });
      res.status(500).json({
         success: false,
         message: "Internal server error!",
      });
   }
};

// get number of all classifications
export const getNumberOfClassifications = async (req, res) => {
   try {
      const count = await Classification.countDocuments();

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
