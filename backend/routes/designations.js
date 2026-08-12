import express from "express";
import { requireAccess } from "../utils/rbac.js";
import {
  getDesignations,
  createDesignation,
  updateDesignation,
} from "../Controllers/designationController.js";

const router = express.Router();

router.get("/", getDesignations);
router.post("/", requireAccess("settings.designations"), createDesignation);
router.patch("/:id", requireAccess("settings.designations"), updateDesignation);

export default router;
