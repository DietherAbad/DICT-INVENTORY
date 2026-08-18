import InventoryGovnetSupply from "../models/InventoryGovnetSupply.js";
import { buildSearchFilter, buildStatusFilter, parsePagination } from "../utils/pagination.js";
import { createLog } from "./logsController.js";
import { removeThumbnailFile, thumbnailFileUrl } from "../utils/thumbnailUpload.js";

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
// Method to get all inventory office supplies
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
            "itemName",
            "classification",
            "project",
            "unitofmeasure",
            "status",
         ]),
      };

      if (!hasPaging) {
         const inventoryItems = await InventoryGovnetSupply.find(filter);
         return res.status(200).json(inventoryItems);
      }

      const [data, total] = await Promise.all([
         InventoryGovnetSupply.find(filter)
            .sort({ _id: -1 })
            .skip(skip)
            .limit(limit),
         InventoryGovnetSupply.countDocuments(filter),
      ]);

      return res.status(200).json({ data, total, page, limit });
   } catch (error) {
      console.error('Error fetching inventory:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
};

// Method to create a new inventory item
export const createInventoryItem = async (req, res) => {
   try {
      const maxIdItem = await InventoryGovnetSupply.findOne({}, {}, { sort: { 'id': -1 } });
      const maxStockNoItem = await InventoryGovnetSupply.findOne({}, {}, { sort: { 'stock_no': -1 } });

      let newId = 1;
      let newStockNo = 1;

      if (maxIdItem) {
         newId = maxIdItem.id + 1;
      }

      if (maxStockNoItem) {
         newStockNo = maxStockNoItem.stock_no + 1;
      }

      const newItem = await InventoryGovnetSupply.create({ ...req.body, id: newId, stock_no: newStockNo });

      await safeCreateLog({
         userId: actorFromReq(req),
         action: `Govnet Supply - Create (${newItem?.itemName || newItem?.description || newItem?._id})`,
         status: "success",
         time: nowISO(),
      });

      res.status(201).json(newItem);
   } catch (error) {
      console.error('Error creating inventory item:', error);
      await safeCreateLog({
         userId: actorFromReq(req),
         action: "Govnet Supply - Create",
         status: "error",
         time: nowISO(),
      });
      res.status(400).json({ error: 'Invalid data provided' });
   }
};

// Method to update an existing inventory item
export const updateInventoryItem = async (req, res) => {
   const itemId = req.params.id;
   try {
      const before = await InventoryGovnetSupply.findById(itemId);
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

      const updatedItem = await InventoryGovnetSupply.findOneAndUpdate(
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

      const changes = diffFromPayload(before, updatedItem, req.body);
      const baseLabel = updatedItem?.itemName || updatedItem?.description || updatedItem?._id;
      let action = `Govnet Supply - Update (${baseLabel})`;
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
         action: `Govnet Supply - Update (${itemId})`,
         status: "error",
         time: nowISO(),
      });
      res.status(400).json({ error: 'Invalid data provided' });
   }
};

// Method to delete an inventory item
export const deleteInventoryItem = async (req, res) => {
   const itemId = req.params.id;
   try {
      const existing = await InventoryGovnetSupply.findById(itemId);
      const deletedItem = await InventoryGovnetSupply.findByIdAndDelete(itemId);
      if (!deletedItem) {
         await safeCreateLog({
            userId: actorFromReq(req),
            action: `Govnet Supply - Delete (Not Found: ${itemId})`,
            status: "error",
            time: nowISO(),
         });
         return res.status(404).json({ error: 'Inventory item not found' });
      }
      if (existing?.thumbnail?.stored_name) {
         await removeThumbnailFile(existing.thumbnail.stored_name, "govnetsupply");
      }
      await safeCreateLog({
         userId: actorFromReq(req),
         action: `Govnet Supply - Delete (${deletedItem?.itemName || deletedItem?.description || deletedItem?._id})`,
         status: "success",
         time: nowISO(),
      });
      res.status(200).json({ message: 'Inventory item deleted successfully' });
   } catch (error) {
      console.error('Error deleting inventory item:', error);
      await safeCreateLog({
         userId: actorFromReq(req),
         action: `Govnet Supply - Delete (${itemId})`,
         status: "error",
         time: nowISO(),
      });
      res.status(500).json({ error: 'Internal server error' });
   }
};

export const uploadGovnetSupplyThumbnail = async (req, res) => {
   const itemId = req.params.id;
   const actor = actorFromReq(req);

   try {
      if (!req.file) {
         return res.status(400).json({ success: false, message: "Thumbnail file is required." });
      }

      const existing = await InventoryGovnetSupply.findById(itemId);
      if (!existing) {
         await removeThumbnailFile(req.file.filename, "govnetsupply");
         return res.status(404).json({ success: false, message: "Inventory item not found" });
      }

      if (existing?.thumbnail?.stored_name) {
         await removeThumbnailFile(existing.thumbnail.stored_name, "govnetsupply");
      }

      existing.thumbnail = {
         url: thumbnailFileUrl(req.file.filename, "govnetsupply"),
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
         await removeThumbnailFile(req.file.filename, "govnetsupply");
      }
      return res.status(500).json({ success: false, message: "Failed to upload thumbnail." });
   }
};

// Method to get a single inventory item by ID
export const getInventoryItemById = async (req, res) => {
   const itemId = req.params.id;
   try {
      const inventoryItem = await InventoryGovnetSupply.findById(itemId);
      if (!inventoryItem) {
         return res.status(404).json({ error: 'Inventory item not found' });
      }
      res.status(200).json(inventoryItem);
   } catch (error) {
      console.error('Error fetching inventory item:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
};
