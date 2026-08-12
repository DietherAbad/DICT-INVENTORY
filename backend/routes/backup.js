import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { requireAnyAccess } from "../utils/rbac.js";
import { createWriteLimiter, isAdminRole } from "../utils/rateLimit.js";
import {
  listBackups,
  createBackup,
  downloadBackup,
  restoreBackup,
} from "../Controllers/backupController.js";

const router = express.Router();

const backupDir = process.env.BACKUP_DIR
  ? path.resolve(process.env.BACKUP_DIR)
  : path.join(process.cwd(), "backups");
fs.mkdirSync(backupDir, { recursive: true });

const sanitizeName = (name) => name.replace(/[^\w.\-]/g, "_");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, backupDir),
  filename: (_req, file, cb) => {
    const ts = new Date().toISOString().replace(/[:.]/g, "");
    const base = sanitizeName(path.basename(file.originalname, path.extname(file.originalname)));
    cb(null, `mongo_upload_${ts}_${base || "backup"}.gz`);
  },
});

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const okMime = [
    "application/gzip",
    "application/x-gzip",
    "application/octet-stream",
  ].includes(file.mimetype);
  const ok = ext === ".gz" && (okMime || !file.mimetype);
  cb(ok ? null : new Error("Invalid backup file"), ok);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 1024 * 1024 * 1024 },
});

const writeLimiter = createWriteLimiter({
  windowMs: 10 * 60 * 1000,
  max: 10,
  skip: (req) => isAdminRole(req?.user?.role),
});

router.get("/", requireAnyAccess("settings.backup"), listBackups);
router.post("/create", requireAnyAccess("settings.backup"), writeLimiter, createBackup);
router.get(
  "/download/:filename",
  requireAnyAccess("settings.backup"),
  downloadBackup
);
router.post(
  "/restore",
  requireAnyAccess("settings.backup"),
  writeLimiter,
  upload.single("file"),
  restoreBackup
);

export default router;
