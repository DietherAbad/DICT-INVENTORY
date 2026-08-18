import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { createLog } from "./logsController.js";

const execFileAsync = promisify(execFile);
const BACKUP_PREFIX = "mongo_";
const BACKUP_EXTENSION = ".gz";

const actorFromReq = (req) =>
  req?.user?.email ||
  req?.user?.username ||
  req?.user?.id ||
  req?.user?._id ||
  req?.headers?.["x-user-email"] ||
  req?.headers?.["x-user-id"] ||
  "NA";

const safeCreateLog = async (logData) => {
  try {
    await createLog(logData);
  } catch (err) {
    console.error("LOGGING_ERROR:", err?.message || err);
  }
};

const resolveBackupDir = () =>
  process.env.BACKUP_DIR
    ? path.resolve(process.env.BACKUP_DIR)
    : path.join(process.cwd(), "backups");

const ensureBackupDir = async () => {
  const dir = resolveBackupDir();
  await fs.promises.mkdir(dir, { recursive: true });
  return dir;
};

const resolveScript = (filename) => {
  const direct = path.join(process.cwd(), "scripts", filename);
  if (fs.existsSync(direct)) return direct;
  return path.join(process.cwd(), "backend", "scripts", filename);
};

const isSafeBackupName = (name) => {
  if (typeof name !== "string") return false;
  if (!name.startsWith(BACKUP_PREFIX) || !name.endsWith(BACKUP_EXTENSION)) return false;
  return /^[a-z0-9._-]+$/i.test(name);
};

const sanitizeBackupName = (name) => {
  if (!name) return null;
  const base = path.basename(name);
  if (base !== name) return null;
  if (!isSafeBackupName(base)) return null;
  return base;
};

const listBackupsOnDisk = async (dir) => {
  const entries = await fs.promises.readdir(dir);
  const backups = await Promise.all(
    entries
      .filter(isSafeBackupName)
      .map(async (name) => {
        const stat = await fs.promises.stat(path.join(dir, name));
        return {
          name,
          size: stat.size,
          createdAt: stat.mtime,
        };
      })
  );
  backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return backups;
};

const parseBackupOutput = (output) => {
  if (!output) return null;
  const match = output.match(/Backup written to (.+)$/m);
  return match?.[1]?.trim() || null;
};

export const listBackups = async (_req, res) => {
  try {
    const dir = await ensureBackupDir();
    const backups = await listBackupsOnDisk(dir);
    const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS || 14);
    return res.status(200).json({ success: true, data: backups, retentionDays });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to list backups." });
  }
};

export const createBackup = async (req, res) => {
  const actor = actorFromReq(req);
  if (!process.env.MONGO_URI) {
    return res.status(500).json({ success: false, message: "MONGO_URI not configured." });
  }

  try {
    const dir = await ensureBackupDir();
    const script = resolveScript("backup_mongo.sh");
    if (!fs.existsSync(script)) {
      return res.status(500).json({ success: false, message: "Backup script missing." });
    }

    const { stdout } = await execFileAsync("bash", [script], {
      env: {
        ...process.env,
        MONGO_URI: process.env.MONGO_URI,
        BACKUP_DIR: dir,
      },
      timeout: 15 * 60 * 1000,
    });

    let backupPath = parseBackupOutput(stdout);
    let backupName = backupPath ? path.basename(backupPath) : null;
    if (!backupName || !isSafeBackupName(backupName)) {
      const backups = await listBackupsOnDisk(dir);
      backupName = backups?.[0]?.name || null;
      backupPath = backupName ? path.join(dir, backupName) : null;
    }

    const stat = backupPath ? await fs.promises.stat(backupPath).catch(() => null) : null;
    await safeCreateLog({
      userId: actor,
      action: "Database Backup - Create",
      status: "success",
      time: new Date().toISOString(),
    });

    return res.status(201).json({
      success: true,
      message: "Backup created.",
      backup: backupName
        ? {
            name: backupName,
            size: stat?.size || null,
            createdAt: stat?.mtime || null,
          }
        : null,
    });
  } catch (err) {
    console.error("BACKUP_CREATE_ERROR:", err?.stderr || err?.message || err);
    await safeCreateLog({
      userId: actor,
      action: "Database Backup - Create",
      status: "error",
      time: new Date().toISOString(),
    });
    const detail =
      (typeof err?.stderr === "string" && err.stderr.trim()) ||
      (typeof err?.message === "string" && err.message.trim()) ||
      "";
    const message = detail ? `Failed to create backup: ${detail}` : "Failed to create backup.";
    return res.status(500).json({ success: false, message });
  }
};

export const downloadBackup = async (req, res) => {
  try {
    const dir = await ensureBackupDir();
    const safeName = sanitizeBackupName(req.params?.filename);
    if (!safeName) {
      return res.status(400).json({ success: false, message: "Invalid backup file." });
    }
    const fullPath = path.join(dir, safeName);
    await fs.promises.access(fullPath);
    return res.download(fullPath, safeName);
  } catch (err) {
    return res.status(404).json({ success: false, message: "Backup file not found." });
  }
};

export const restoreBackup = async (req, res) => {
  const actor = actorFromReq(req);
  if (!process.env.MONGO_URI) {
    return res.status(500).json({ success: false, message: "MONGO_URI not configured." });
  }

  try {
    const dir = await ensureBackupDir();
    const script = resolveScript("restore_mongo.sh");
    if (!fs.existsSync(script)) {
      return res.status(500).json({ success: false, message: "Restore script missing." });
    }

    let archivePath = null;
    let archiveName = null;

    if (req.file?.path) {
      archivePath = req.file.path;
      archiveName = path.basename(req.file.filename || req.file.path);
    } else {
      const safeName = sanitizeBackupName(req.body?.filename);
      if (!safeName) {
        return res
          .status(400)
          .json({ success: false, message: "Backup filename is required." });
      }
      archiveName = safeName;
      archivePath = path.join(dir, safeName);
    }

    await fs.promises.access(archivePath);
    await execFileAsync("bash", [script, archivePath], {
      env: {
        ...process.env,
        MONGO_URI: process.env.MONGO_URI,
      },
      timeout: 30 * 60 * 1000,
    });

    await safeCreateLog({
      userId: actor,
      action: "Database Backup - Restore",
      status: "success",
      time: new Date().toISOString(),
    });

    return res.status(200).json({
      success: true,
      message: `Restore completed from ${archiveName}.`,
    });
  } catch (err) {
    console.error("BACKUP_RESTORE_ERROR:", err?.stderr || err?.message || err);
    await safeCreateLog({
      userId: actor,
      action: "Database Backup - Restore",
      status: "error",
      time: new Date().toISOString(),
    });
    const detail =
      (typeof err?.stderr === "string" && err.stderr.trim()) ||
      (typeof err?.message === "string" && err.message.trim()) ||
      "";
    const message = detail ? `Failed to restore backup: ${detail}` : "Failed to restore backup.";
    return res.status(500).json({ success: false, message });
  }
};
