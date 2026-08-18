import express from "express";
import { requireAccess } from "../utils/rbac.js";
import {
  getProjects,
  createProject,
  updateProject,
} from "../Controllers/projectController.js";

const router = express.Router();

router.get("/", getProjects);

router.post("/", requireAccess("settings.projects"), createProject);

router.patch("/:id", requireAccess("settings.projects"), updateProject);

export default router;
