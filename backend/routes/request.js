import express from "express";
import {
  getEmployeeAssetLookup,
  getPropertyRequests,
} from "../Controllers/requestController.js";
import { requireAccess, requireAuth } from "../utils/rbac.js";

const router = express.Router();

router.get("/property", requireAuth, getPropertyRequests);
router.get(
  "/employee-assets",
  requireAccess("inventory.employee_lookup"),
  getEmployeeAssetLookup
);

export default router;
