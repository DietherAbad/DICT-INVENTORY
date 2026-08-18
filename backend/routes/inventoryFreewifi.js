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
  getInventoryItem, // Import the new controller function
  uploadFreewifiThumbnail,
} from "../Controllers/inventoryFreewifi.js";
import { createThumbnailUpload } from "../utils/thumbnailUpload.js";

const router = express.Router();

// Route to get all inventory items
router.get('/inventory', requireAccess("stocks.freewifi"), getAllInventory);

// Route to create a new inventory item
router.post(
  '/inventory',
  requireAccess("stocks.freewifi"),
  writeLimiter,
  validateBody(schemas.inventoryPayload),
  createInventoryItem
);

// Route to get a single inventory item by ID
router.get('/inventory/:id', requireAccess("stocks.freewifi"), getInventoryItem);

// Route to update an existing inventory item
router.put(
  '/inventory/:id',
  requireAccess("stocks.freewifi"),
  writeLimiter,
  validateBody(schemas.inventoryPayload),
  updateInventoryItem
);
router.post(
  "/inventory/:id/thumbnail",
  requireAccess("stocks.freewifi"),
  writeLimiter,
  createThumbnailUpload("freewifi").single("thumbnail"),
  uploadFreewifiThumbnail
);

// Route to delete an existing inventory item
router.delete('/inventory/:id', requireAccess("stocks.freewifi"), writeLimiter, deleteInventoryItem);

export default router;
