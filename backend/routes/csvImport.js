import express from "express";
import multer from "multer";
import { requireAccess } from "../utils/rbac.js";
import { validateCsvImport, importCsvData } from "../Controllers/csvImportController.js";

const router = express.Router();

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post(
  "/validate",
  requireAccess("settings.csv_import"),
  csvUpload.single("file"),
  validateCsvImport
);

router.post(
  "/import",
  requireAccess("settings.csv_import"),
  csvUpload.single("file"),
  importCsvData
);

export default router;
