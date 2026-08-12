import express from "express";
import { getOfficeDashboard } from "../Controllers/dashboardController.js";
import { requireAccess } from "../utils/rbac.js";

const router = express.Router();

router.get("/office", requireAccess("dashboard.office"), getOfficeDashboard);

export default router;
