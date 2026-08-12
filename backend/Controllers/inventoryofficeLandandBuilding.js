import InventoryOfficeLandandBuilding from "../models/InventoryOfficeLandandBuilding.js";
import { buildSearchFilter, buildStatusFilter, parsePagination } from "../utils/pagination.js";
import { createLog } from "./logsController.js";
import { removeSignedFile, signedFileUrl } from "../utils/upload.js";
import { removeThumbnailFile, thumbnailFileUrl } from "../utils/thumbnailUpload.js";

// Method to get all inventory land and building items
const nowISO = () => new Date().toISOString();
const SIGNED_PREV_TTL_DAYS = 7;
const signedPrevExpiryDate = () =>
   new Date(Date.now() + SIGNED_PREV_TTL_DAYS * 24 * 60 * 60 * 1000);
const isExpiredDate = (dateLike) =>
   !!dateLike && new Date(dateLike).getTime() <= Date.now();

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

const clearExpiredPrevSignedFile = async (doc) => {
   if (!doc?.signed_file_prev?.stored_name) return false;
   if (!isExpiredDate(doc.signed_file_prev_expires_at)) return false;
   await removeSignedFile(doc.signed_file_prev.stored_name);
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
      s === "for return to inventory"
   );
};
const rotateSignedFile = async (doc) => {
   if (!doc?.signed_file?.url && !doc?.signed_file?.stored_name) return doc;
   if (doc?.signed_file_prev?.stored_name) {
      await removeSignedFile(doc.signed_file_prev.stored_name);
   }
   await InventoryOfficeLandandBuilding.updateOne(
      { _id: doc._id },
      {
         $set: {
            signed_file_prev: doc.signed_file,
            signed_file_prev_expires_at: signedPrevExpiryDate(),
            signed_file: null,
         },
      }
   );
   return InventoryOfficeLandandBuilding.findById(doc._id);
};

export const getAllInventory = async (req, res) => {
   try {
      const { page, limit, skip, hasPaging } = parsePagination(req, {
         page: 1,
         limit: 20,
      });
      const status = req.query?.status;
      const search = req.query?.search;

      const filter = {
         ...(status ? buildStatusFilter(status) : {}),
         ...buildSearchFilter(search, [
            "property_no",
            "itemName",
            "classification",
            "project",
            "unitofmeasure",
            "status",
         ]),
      };

      if (!hasPaging) {
         const inventoryItems = await InventoryOfficeLandandBuilding.find(filter);
         await Promise.all(
            inventoryItems.map((item) => clearExpiredPrevSignedFile(item).catch(() => null))
         );
         return res.status(200).json(inventoryItems);
      }

      const [data, total] = await Promise.all([
         InventoryOfficeLandandBuilding.find(filter)
            .sort({ _id: -1 })
            .skip(skip)
            .limit(limit),
         InventoryOfficeLandandBuilding.countDocuments(filter),
      ]);

      await Promise.all(data.map((item) => clearExpiredPrevSignedFile(item).catch(() => null)));

      return res.status(200).json({ data, total, page, limit });
   } catch (error) {
      console.error('Error fetching inventory:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
};

// Method to create a new inventory land and building item
export const createInventoryItem = async (req, res) => {
   try {
      const maxIdItem = await InventoryOfficeLandandBuilding.findOne({}, {}, { sort: { 'id': -1 } });

      let newId = 1;

      if (maxIdItem) {
         newId = maxIdItem.id + 1;
      }

      const newItem = await InventoryOfficeLandandBuilding.create({ ...req.body, id: newId });
      res.status(201).json(newItem);
   } catch (error) {
      console.error('Error creating inventory item:', error);
      res.status(400).json({ error: 'Invalid data provided' });
   }
};

// Method to update an existing inventory land and building item
export const updateInventoryItem = async (req, res) => {
   const itemId = req.params.id;
   try {
      const before = await InventoryOfficeLandandBuilding.findById(itemId);
      if (!before) {
         return res.status(404).json({ error: 'Inventory item not found' });
      }

      const version = req.body?.__v;
      if (version !== undefined && Number(before.__v) !== Number(version)) {
         return res.status(409).json({
            success: false,
            message: "Version conflict. Please refresh and try again.",
         });
      }

      const updateData = { ...req.body };
      if ("__v" in updateData) delete updateData.__v;

      const updatedItem = await InventoryOfficeLandandBuilding.findOneAndUpdate(
         { _id: itemId, ...(version !== undefined ? { __v: Number(version) } : {}) },
         {
            $set: updateData,
            $inc: { __v: 1 },
         },
         { new: true }
      );
      if (!updatedItem) {
         return res.status(404).json({ error: 'Inventory item not found' });
      }

      const beforeStatus = (before.status || "").toString();
      const afterStatus = (updatedItem?.status || "").toString();
      const beforeReqStatus = (before.requeststatus || "").toString();
      const afterReqStatus = (updatedItem?.requeststatus || "").toString();

      const statusChanged = beforeStatus !== afterStatus;
      const reqStatusChanged = beforeReqStatus !== afterReqStatus;
      const shouldRotateSigned =
         statusChanged && shouldRotateSignedOnStatus(afterStatus);
      if (shouldRotateSigned) {
         updatedItem = await rotateSignedFile(updatedItem);
      }

      const changes = diffFromPayload(before, updatedItem, req.body);
      const baseLabel = updatedItem?.itemName || updatedItem?.description || updatedItem?._id;
      let action = `Land & Building - Update (${baseLabel})`;
      if (changes.length) action += ` | ${changes.join(" | ")}`;

      await safeCreateLog({
         userId: actorFromReq(req),
         action,
         status: "success",
         time: nowISO(),
      });

      res.status(200).json(updatedItem);
   } catch (error) {
      console.error('Error updating inventory item:', error);
      await safeCreateLog({
         userId: actorFromReq(req),
         action: `Land & Building - Update (${itemId})`,
         status: "error",
         time: nowISO(),
      });
      res.status(400).json({ error: 'Invalid data provided' });
   }
};

// Method to delete an inventory land and building item
export const deleteInventoryItem = async (req, res) => {
   const itemId = req.params.id;
   try {
      const existing = await InventoryOfficeLandandBuilding.findById(itemId);
      const deletedItem = await InventoryOfficeLandandBuilding.findByIdAndDelete(itemId);
      if (!deletedItem) {
         return res.status(404).json({ error: 'Inventory item not found' });
      }
      if (existing?.thumbnail?.stored_name) {
         await removeThumbnailFile(existing.thumbnail.stored_name, "officeland");
      }
      res.status(200).json({ message: 'Inventory item deleted successfully' });
   } catch (error) {
      console.error('Error deleting inventory item:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
};

export const uploadLandBuildingThumbnail = async (req, res) => {
   const itemId = req.params.id;
   const actor = actorFromReq(req);

   try {
      if (!req.file) {
         return res.status(400).json({ success: false, message: "Thumbnail file is required." });
      }

      const existing = await InventoryOfficeLandandBuilding.findById(itemId);
      if (!existing) {
         await removeThumbnailFile(req.file.filename, "officeland");
         return res.status(404).json({ success: false, message: "Inventory item not found" });
      }

      if (existing?.thumbnail?.stored_name) {
         await removeThumbnailFile(existing.thumbnail.stored_name, "officeland");
      }

      existing.thumbnail = {
         url: thumbnailFileUrl(req.file.filename, "officeland"),
         filename: req.file.originalname,
         stored_name: req.file.filename,
         size: req.file.size,
         uploaded_by: actor,
         uploaded_at: new Date(),
      };

      await existing.save();

      return res.status(200).json({ success: true, data: existing.thumbnail });
   } catch (error) {
      console.error("Thumbnail upload error:", error);
      if (req.file?.filename) {
         await removeThumbnailFile(req.file.filename, "officeland");
      }
      return res.status(500).json({ success: false, message: "Failed to upload thumbnail." });
   }
};

export const uploadSignedInventoryFile = async (req, res) => {
   const itemId = req.params.id;
   const actor = actorFromReq(req);

   if (!req.file) {
      return res.status(400).json({ success: false, message: "File is required." });
   }

   try {
      const existing = await InventoryOfficeLandandBuilding.findById(itemId);
      if (!existing) {
         await removeSignedFile(req.file.filename);
         return res.status(404).json({ success: false, message: "Inventory item not found" });
      }

      if (existing?.signed_file_prev?.stored_name) {
         await removeSignedFile(existing.signed_file_prev.stored_name);
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

      await safeCreateLog({
         userId: actor,
         action: `Office Land/Building - Signed File Uploaded (${itemId})`,
         status: "success",
         time: nowISO(),
      });

      res.status(200).json({ success: true, data: existing.signed_file });
   } catch (error) {
      await safeCreateLog({
         userId: actor,
         action: `Office Land/Building - Signed File Upload (${itemId})`,
         status: "error",
         time: nowISO(),
      });
      res.status(500).json({ success: false, message: "Failed to upload file." });
   }
};
