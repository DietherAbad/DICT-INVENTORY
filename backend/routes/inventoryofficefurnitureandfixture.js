import express from 'express';
import { requireAccess } from "../utils/rbac.js";
import { validateBody, schemas } from "../utils/validators.js";
import { createWriteLimiter, isAdminRole } from "../utils/rateLimit.js";

const writeLimiter = createWriteLimiter({
  windowMs: 5 * 60 * 1000,
  max: 60,
  skip: (req) => isAdminRole(req?.user?.role),
});
import {
  getAllInventory,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  getInventoryItemById,
  getPublicInventoryItem,
  uploadSignedInventoryFile,
  revertSignedInventoryFile,
  revertInventoryState,
  uploadFurnitureThumbnail,
} from "../Controllers/inventoryofficefurnitureandfixtureController.js";
import { signedUpload } from "../utils/upload.js";
import { createThumbnailUpload } from "../utils/thumbnailUpload.js";

const router = express.Router();

// Route to get all inventory items
router.get('/inventory', requireAccess("stocks.office_furniture"), getAllInventory);
router.get('/inventory/:id', requireAccess("details.office_furniture"), getInventoryItemById);
router.get('/public/:id', getPublicInventoryItem);

// Route to create a new inventory item
router.post(
  '/inventory',
  requireAccess("stocks.entry"),
  writeLimiter,
  validateBody(schemas.inventoryPayload),
  createInventoryItem
);

// Route to update an existing inventory item
router.put(
  '/inventory/:id',
  requireAccess("details.office_furniture"),
  writeLimiter,
  validateBody(schemas.inventoryPayload),
  updateInventoryItem
);
router.post(
  "/inventory/:id/signed-file",
  requireAccess("details.office_furniture"),
  writeLimiter,
  signedUpload.single("file"),
  uploadSignedInventoryFile
);
router.post(
  "/inventory/:id/thumbnail",
  requireAccess("stocks.entry"),
  writeLimiter,
  createThumbnailUpload("officefurniture").single("thumbnail"),
  uploadFurnitureThumbnail
);
router.post(
  "/inventory/:id/signed-file/revert",
  requireAccess("details.office_furniture"),
  writeLimiter,
  revertSignedInventoryFile
);
router.post(
  "/inventory/:id/revert-state",
  requireAccess("details.office_furniture"),
  writeLimiter,
  revertInventoryState
);

// Route to delete an existing inventory item
router.delete('/inventory/:id', requireAccess("stocks.entry"), writeLimiter, deleteInventoryItem);

export default router;
