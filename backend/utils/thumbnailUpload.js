import fs from "fs";
import path from "path";
import multer from "multer";
import { thumbnailUploadsRoot } from "./uploadPaths.js";

const sanitizeName = (name) => name.replace(/[^\w.\-]/g, "_");

const ensureDir = (subdir) => {
  const target = thumbnailUploadsRoot(subdir);
  fs.mkdirSync(target, { recursive: true });
  return target;
};

export const createThumbnailUpload = (subdir, maxBytes = 2 * 1024 * 1024) => {
  const uploadRoot = ensureDir(subdir);
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadRoot),
    filename: (_req, file, cb) => {
      const ts = Date.now();
      const safe = sanitizeName(file.originalname || "thumbnail");
      cb(null, `${ts}-${safe}`);
    },
  });

  const fileFilter = (_req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
    cb(ok ? null : new Error("Invalid file type"), ok);
  };

  return multer({
    storage,
    limits: { fileSize: maxBytes },
    fileFilter,
  });
};

export const thumbnailFileUrl = (filename, subdir = "supplies") =>
  `/uploads/thumbnails/${subdir}/${filename}`;

export const removeThumbnailFile = async (storedName, subdir = "supplies") => {
  if (!storedName) return;
  const uploadRoot = ensureDir(subdir);
  const fullPath = path.join(uploadRoot, storedName);
  try {
    await fs.promises.unlink(fullPath);
  } catch (err) {
    if (err?.code !== "ENOENT") {
      console.error("THUMBNAIL_DELETE_ERROR:", err?.message || err);
    }
  }
};

export const supplyThumbnailUpload = createThumbnailUpload("supplies");
