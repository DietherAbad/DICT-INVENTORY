import path from "path";
import { fileURLToPath } from "url";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const uploadsRoot = path.join(backendRoot, "uploads");
export const signedUploadsRoot = path.join(uploadsRoot, "signed");
export const thumbnailUploadsRoot = (subdir) =>
  path.join(uploadsRoot, "thumbnails", subdir);
