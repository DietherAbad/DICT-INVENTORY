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
  getInventoryItemById,
  uploadGovnetSupplyThumbnail,
} from "../Controllers/inventoryofficegovnetController.js";
import { createThumbnailUpload } from "../utils/thumbnailUpload.js";

 const router = express.Router();
// Route to get all inventory items
router.get('/inventory', requireAccess("stocks.govnet_supply"), getAllInventory);
router.get('/inventory/:id', requireAccess("stocks.govnet_supply"), getInventoryItemById);

// Route to create a new inventory item
router.post(
  '/inventory',
  requireAccess("stocks.govnet_supply"),
  writeLimiter,
  validateBody(schemas.inventoryPayload),
  createInventoryItem
);

// Route to update an existing inventory item
router.put(
  '/inventory/:id',
  requireAccess("stocks.govnet_supply"),
  writeLimiter,
  validateBody(schemas.inventoryPayload),
  updateInventoryItem
);
router.post(
  "/inventory/:id/thumbnail",
  requireAccess("stocks.govnet_supply"),
  writeLimiter,
  createThumbnailUpload("govnetsupply").single("thumbnail"),
  uploadGovnetSupplyThumbnail
);

// Route to delete an existing inventory item
router.delete('/inventory/:id', requireAccess("stocks.govnet_supply"), writeLimiter, deleteInventoryItem);

export default router;
