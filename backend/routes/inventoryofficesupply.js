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
  uploadSupplyThumbnail,
  removeSupplyThumbnail,
} from "../Controllers/inventoryofficesupplyController.js";
import { supplyThumbnailUpload } from "../utils/thumbnailUpload.js";

 const router = express.Router();
// Route to get all inventory items
router.get('/inventory', requireAccess("stocks.office_supplies"), getAllInventory);
router.get('/inventory/:id', requireAccess("details.office_supplies"), getInventoryItemById);

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
  requireAccess("details.office_supplies"),
  writeLimiter,
  validateBody(schemas.inventoryPayload),
  updateInventoryItem
);

router.post(
  "/inventory/:id/thumbnail",
  requireAccess("stocks.entry"),
  writeLimiter,
  supplyThumbnailUpload.single("thumbnail"),
  uploadSupplyThumbnail
);
router.delete(
  "/inventory/:id/thumbnail",
  requireAccess("stocks.entry"),
  writeLimiter,
  removeSupplyThumbnail
);

// Route to delete an existing inventory item
router.delete('/inventory/:id', requireAccess("stocks.entry"), writeLimiter, deleteInventoryItem);

export default router;
