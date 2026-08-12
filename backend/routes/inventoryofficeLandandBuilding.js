import express from 'express';
import { requireAccess } from "../utils/rbac.js";
import { validateBody, schemas } from "../utils/validators.js";
import { createWriteLimiter, isAdminRole } from "../utils/rateLimit.js";

const writeLimiter = createWriteLimiter({
  windowMs: 5 * 60 * 1000,
  max: 40,
  skip: (req) => isAdminRole(req?.user?.role),
});
import {
  getAllInventory,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  uploadSignedInventoryFile,
  uploadLandBuildingThumbnail,
} from "../Controllers/inventoryofficeLandandBuilding.js";
import { signedUpload } from "../utils/upload.js";
import { createThumbnailUpload } from "../utils/thumbnailUpload.js";

const router = express.Router();

// Route to get all inventory items
router.get('/inventory', requireAccess("stocks.office_land"), getAllInventory);

// Route to create a new inventory item
router.post(
  '/inventory',
  requireAccess("stocks.office_land"),
  writeLimiter,
  validateBody(schemas.inventoryPayload),
  createInventoryItem
);

// Route to update an existing inventory item
router.put(
  '/inventory/:id',
  requireAccess("stocks.office_land"),
  writeLimiter,
  validateBody(schemas.inventoryPayload),
  updateInventoryItem
);
router.post(
  "/inventory/:id/signed-file",
  requireAccess("stocks.office_land"),
  writeLimiter,
  signedUpload.single("file"),
  uploadSignedInventoryFile
);
router.post(
  "/inventory/:id/thumbnail",
  requireAccess("stocks.office_land"),
  writeLimiter,
  createThumbnailUpload("officeland").single("thumbnail"),
  uploadLandBuildingThumbnail
);

// Route to delete an existing inventory item
router.delete('/inventory/:id', requireAccess("stocks.office_land"), writeLimiter, deleteInventoryItem);

export default router;
