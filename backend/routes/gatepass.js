import express from "express";
import { requireAuth } from "../utils/rbac.js";
import {
  listGatePasses,
  getGatePass,
  createGatePass,
  updateGatePass,
  addGatePassItem,
  removeGatePassItem,
  submitGatePass,
  approveGatePass,
  releaseGatePass,
  guardGatePass,
  returnGatePass,
  declineGatePass,
} from "../Controllers/gatepassController.js";

const router = express.Router();

router.get("/", requireAuth, listGatePasses);
router.post("/", requireAuth, createGatePass);
router.get("/:id", requireAuth, getGatePass);
router.put("/:id", requireAuth, updateGatePass);
router.post("/:id/items", requireAuth, addGatePassItem);
router.delete("/:id/items/:inventoryId", requireAuth, removeGatePassItem);
router.post("/:id/submit", requireAuth, submitGatePass);
router.post("/:id/approve", requireAuth, approveGatePass);
router.post("/:id/release", requireAuth, releaseGatePass);
router.post("/:id/guard", requireAuth, guardGatePass);
router.post("/:id/return", requireAuth, returnGatePass);
router.post("/:id/decline", requireAuth, declineGatePass);

export default router;
