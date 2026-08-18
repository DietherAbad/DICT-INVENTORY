import fs from "fs";
import path from "path";
import multer from "multer";
import { signedUploadsRoot } from "./uploadPaths.js";

const uploadRoot = signedUploadsRoot;
fs.mkdirSync(uploadRoot, { recursive: true });

const sanitizeName = (name) => name.replace(/[^\w.\-]/g, "_");

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadRoot),
  filename: (_, file, cb) => {
    const ts = Date.now();
    const safe = sanitizeName(file.originalname || "signed-file");
    cb(null, `${ts}-${safe}`);
  },
});

const fileFilter = (_, file, cb) => {
  const ok = [
    "application/pdf",
    "image/png",
    "image/jpeg",
  ].includes(file.mimetype);
  cb(ok ? null : new Error("Invalid file type"), ok);
};

export const signedUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter,
});

export const signedFileUrl = (filename) => `/uploads/signed/${filename}`;

export const signedFileExists = async (storedName) => {
  if (!storedName) return false;
  try {
    await fs.promises.access(path.join(uploadRoot, storedName), fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

export const isSignedFileReferencedInHistory = (history, storedName) => {
  if (!storedName || !Array.isArray(history)) return false;
  return history.some(
    (entry) =>
      entry?.signed_file?.stored_name === storedName ||
      entry?.doc_snapshot?.signed_file?.stored_name === storedName
  );
};

export const removeSignedFileIfUnreferenced = async (storedName, history) => {
  if (!storedName || isSignedFileReferencedInHistory(history, storedName)) return false;
  await removeSignedFile(storedName);
  return true;
};

export const removeSignedFile = async (storedName) => {
  if (!storedName) return;
  const fullPath = path.join(uploadRoot, storedName);
  try {
    await fs.promises.unlink(fullPath);
  } catch (err) {
    if (err?.code !== "ENOENT") {
      console.error("SIGNED_FILE_DELETE_ERROR:", err?.message || err);
    }
  }
};
