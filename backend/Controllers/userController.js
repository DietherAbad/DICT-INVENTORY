// Controllers/userController.js
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { createLog } from "./logsController.js";
import { buildSearchFilter, parsePagination } from "../utils/pagination.js";

/**
 * Utility: validate password strength (mirrors your Register.jsx rules)
 * - 8+ chars
 * - contains uppercase letter
 * - contains number
 * - contains special character
 */
const isStrongPassword = (pw = '') => {
  const hasLen = pw.length >= 8;
  const hasUpper = /[A-Z]/.test(pw);
  const hasNumber = /\d/.test(pw);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pw);
  return hasLen && hasUpper && hasNumber && hasSpecial;
};

const nowISO = () => new Date().toISOString();

const actorFromReq = (req) =>
  req?.user?.email ||
  req?.user?.username ||
  req?.user?.id ||
  req?.user?._id ||
  req?.body?.actor ||
  req?.headers?.["x-user-email"] ||
  req?.headers?.["x-user-id"] ||
  "NA";

const safeCreateLog = async (logData) => {
  try {
    await createLog(logData);
  } catch (e) {
    console.error("LOGGING_ERROR:", e?.message || e);
  }
};

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const SINGLE_OCCUPANT_ROLES = [
  "Inventory Admin",
  "Regional Director",
  "Assistant Regional Director",
  "AFD",
  "Accountant",
  "TOD",
  "Cagayan Provincial Officer",
  "Isabela Provincial Officer",
  "Batanes Provincial Officer",
  "Nueva Vizcaya Provincial Officer",
  "Quirino Provincial Officer",
];

const isSingleOccupantRole = (role) =>
  typeof role === "string" && SINGLE_OCCUPANT_ROLES.includes(role);

const isSuperAdminRole = (role) => {
  const key = String(role || "").trim().toLowerCase();
  return key === "super admin" || key === "superadmin" || key === "admin";
};

// Create new User (admin-side create)
// If a password is provided here, we will hash it before saving.
export const createUser = async (req, res) => {
  try {
    const payload = { ...req.body };

    if (typeof payload.username === "string") {
      payload.username = payload.username.trim();
    }
    if (typeof payload.email === "string") {
      payload.email = payload.email.trim();
    }

    const username = String(payload.username || "");
    const email = String(payload.email || "");

    const existing = await User.findOne({
      email: new RegExp(`^${escapeRegex(email)}$`, "i"),
    })
      .select("username email")
      .lean();

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Email already exists.",
      });
    }

    if (payload.password) {
      if (!isStrongPassword(payload.password)) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              'Password must be 8+ chars and include an uppercase letter, a number, and a special character.',
          });
      }
      const salt = bcrypt.genSaltSync(10);
      payload.password = bcrypt.hashSync(payload.password, salt);
    }

    const newUser = new User(payload);
    const savedUser = await newUser.save();

    // do NOT return hashed password
    const { password, ...safe } = savedUser.toObject();

    await safeCreateLog({
      userId: actorFromReq(req),
      action: `User - Create (${safe.username || safe.email || safe._id})`,
      status: "success",
      time: nowISO(),
    });

    res.status(200).json({
      success: true,
      message: 'Successfully created',
      data: safe,
    });
  } catch (error) {
    await safeCreateLog({
      userId: actorFromReq(req),
      action: "User - Create",
      status: "error",
      time: nowISO(),
    });
    res
      .status(500)
      .json({ success: false, message: 'Failed to create. Try again!' });
  }
};

/**
 * Update User (supports profile updates AND password change via PUT /users/:id)
 *
 * Conventions supported:
 * 1) Regular profile updates (username, email, position, designation, project, role)
 * 2) Password change by sending:
 *    - currentPassword: string (required)
 *    - password: string (this is the NEW password)
 *
 * If 'password' is present in the body, we will:
 *   - require 'currentPassword'
 *   - verify it via bcrypt.compare
 *   - validate new password strength (same rules as Register.jsx)
 *   - hash the new password and store it
 *
 * Other fields will be whitelisted and updated via $set.
 */
export const updateUser = async (req, res) => {
  const id = req.params.id;

  try {
    // Fetch the existing user first (needed for password compare)
    const existing = await User.findById(id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }

    const {
      username,
      email,
      position,
      designation,
      project,
      role,
      active,
      password, // NEW password (optional)
      currentPassword, // required if password is provided
      adminReset, // optional flag to bypass current password for admin reset
    } = req.body;

    const updateFields = {};

    // Whitelist non-password fields
    if (typeof username === 'string') updateFields.username = username.trim();
    if (typeof email === 'string') updateFields.email = email.trim();
    if (typeof position === 'string') updateFields.position = position;
    if (typeof designation === 'string') updateFields.designation = designation;
    if (typeof project === 'string') updateFields.project = project;
    if (typeof role === 'string') updateFields.role = role;
    if (typeof active === "boolean") updateFields.active = active;

    if (updateFields.email) {
      const existingEmail = await User.findOne({
        email: new RegExp(`^${escapeRegex(updateFields.email)}$`, "i"),
        _id: { $ne: id },
      })
        .select("_id")
        .lean();
      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message: "Email already exists.",
        });
      }
    }

    // Handle password change if 'password' is provided
    if (typeof password === 'string' && password.length) {
      const isAdminReset = adminReset === true || adminReset === 'true';
      if (!isAdminReset) {
        if (!currentPassword) {
          return res.status(400).json({
            success: false,
            message: 'Current password is required to set a new password.',
          });
        }

        const ok = await bcrypt.compare(currentPassword, existing.password || '');
        if (!ok) {
          return res.status(401).json({
            success: false,
            message: 'Current password is incorrect.',
          });
        }
      }

      if (!isStrongPassword(password)) {
        return res.status(400).json({
          success: false,
          message:
            'Password must be 8+ chars and include an uppercase letter, a number, and a special character.',
        });
      }

      const salt = bcrypt.genSaltSync(10);
      updateFields.password = bcrypt.hashSync(password, salt);
    }

    const version = req.body?.__v;
    if (version !== undefined && Number(existing.__v) !== Number(version)) {
      return res.status(409).json({
        success: false,
        message: "Version conflict. Please refresh and try again.",
      });
    }

    // Enforce single-occupant roles on the server.
    if (typeof role === "string" && role && role !== existing.role && isSingleOccupantRole(role)) {
      await User.updateMany({ role, _id: { $ne: id } }, { $set: { role: "employee" } });
    }

    // Perform update
    const updatedUser = await User.findOneAndUpdate(
      { _id: id, ...(version !== undefined ? { __v: Number(version) } : {}) },
      {
        $set: updateFields,
        $inc: { __v: 1 },
      },
      { new: true }
    );

    // Safety: do not return hashed password
    const { password: pw, ...safe } = updatedUser.toObject();

    const changes = [];
    if (typeof username === "string" && username !== existing.username) {
      changes.push(`username: "${existing.username || ""}" → "${username}"`);
    }
    if (typeof email === "string" && email !== existing.email) {
      changes.push(`email: "${existing.email || ""}" → "${email}"`);
    }
    if (typeof position === "string" && position !== existing.position) {
      changes.push(`position: "${existing.position || ""}" → "${position}"`);
    }
    if (typeof designation === "string" && designation !== existing.designation) {
      changes.push(`designation: "${existing.designation || ""}" → "${designation}"`);
    }
    if (typeof project === "string" && project !== existing.project) {
      changes.push(`project: "${existing.project || ""}" → "${project}"`);
    }
    if (typeof role === "string" && role !== existing.role) {
      changes.push(`role: "${existing.role || ""}" → "${role}"`);
    }
    if (typeof active === "boolean" && active !== existing.active) {
      changes.push(`active: ${existing.active ? "true" : "false"} → ${active}`);
    }
    if (typeof password === "string" && password.length) {
      changes.push("password: updated");
    }

    const baseLabel = safe.username || safe.email || safe._id;
    let action = `User - Update (${baseLabel})`;
    if (changes.length) action += ` | ${changes.join(" | ")}`;

    await safeCreateLog({
      userId: actorFromReq(req),
      action,
      status: "success",
      time: nowISO(),
    });

    res.status(200).json({
      success: true,
      message: 'Successfully updated',
      data: safe,
    });
  } catch (error) {
    await safeCreateLog({
      userId: actorFromReq(req),
      action: `User - Update (${id})`,
      status: "error",
      time: nowISO(),
    });
    res.status(500).json({ success: false, message: 'Failed to update' });
  }
};

export const forceLogoutUser = async (req, res) => {
  const id = req.params.id;

  try {
    if (!isSuperAdminRole(req?.user?.role)) {
      return res.status(403).json({
        success: false,
        message: "Only Super Admin can force logout a user.",
      });
    }

    const actorId = String(req?.user?.id || req?.user?._id || "");
    if (actorId && String(id) === actorId) {
      return res.status(400).json({
        success: false,
        message: "Use regular logout for your own session.",
      });
    }

    const target = await User.findById(id);
    if (!target) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const currentVersion = Number(target.session_version || 0);
    const nextVersion = Number.isFinite(currentVersion) ? currentVersion + 1 : 1;
    target.session_version = nextVersion;
    await target.save();

    await safeCreateLog({
      userId: actorFromReq(req),
      action: `User - Force Logout (${target.username || target.email || id})`,
      status: "success",
      time: nowISO(),
    });

    return res.status(200).json({
      success: true,
      message: `${target.username || "User"} was logged out from active sessions.`,
      data: {
        _id: target._id,
        session_version: target.session_version,
      },
    });
  } catch (error) {
    await safeCreateLog({
      userId: actorFromReq(req),
      action: `User - Force Logout (${id})`,
      status: "error",
      time: nowISO(),
    });
    return res.status(500).json({
      success: false,
      message: "Failed to force logout user.",
    });
  }
};

// Lightweight directory for display-only use (no sensitive fields)
export const getUserDirectory = async (_req, res) => {
  try {
    const users = await User.find(
      {},
      { username: 1, position: 1, role: 1, email: 1, active: 1 }
    )
      .sort({ username: 1 })
      .lean();
    res.status(200).json(users || []);
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load users." });
  }
};

// Delete User
export const deleteUser = async (req, res) => {
  const id = req.params.id;

  try {
    const existing = await User.findById(id).lean();
    await User.findByIdAndDelete(id);
    const label = existing?.username || existing?.email || id;

    await safeCreateLog({
      userId: actorFromReq(req),
      action: `User - Delete (${label})`,
      status: "success",
      time: nowISO(),
    });
    res.status(200).json({ success: true, message: 'Successfully deleted' });
  } catch (error) {
    await safeCreateLog({
      userId: actorFromReq(req),
      action: `User - Delete (${id})`,
      status: "error",
      time: nowISO(),
    });
    res.status(500).json({ success: false, message: 'Failed to delete' });
  }
};

// Get single User
export const getSingleUser = async (req, res) => {
  const id = req.params.id;

  try {
    const user = await User.findById(id).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'Not Found' });
    }
    // strip password
    const { password, ...safe } = user;
    res.status(200).json(safe);
  } catch (error) {
    res.status(404).json({ success: false, message: 'Not Found' });
  }
};

// Get all Users
export const getAllUser = async (req, res) => {
  try {
    const { page, limit, skip, hasPaging } = parsePagination(req, { page: 1, limit: 20 });
    const search = req.query?.search;
    const role = req.query?.role;
    const assignment = req.query?.assignment;
    const activeParam = req.query?.active;
    const sortRaw = req.query?.sort;

    const sort = (() => {
      if (!sortRaw) return { username: 1 };
      const [field, dir] = String(sortRaw).split(":");
      const allowed = ["username", "email", "role", "position", "project", "active", "createdAt"];
      if (!allowed.includes(field)) return { username: 1 };
      return { [field]: dir === "desc" ? -1 : 1 };
    })();

    const filter = {
      ...(role && role !== "all" ? { role } : {}),
      ...buildSearchFilter(search, [
        "username",
        "email",
        "role",
        "position",
        "designation",
        "project",
      ]),
    };

    if (search && /^[0-9a-fA-F]{24}$/.test(String(search).trim())) {
      filter._id = String(search).trim();
    }

    if (typeof activeParam === "string" && activeParam.length) {
      const raw = activeParam.toLowerCase().trim();
      if (["true", "1", "active"].includes(raw)) filter.active = { $ne: false };
      if (["false", "0", "inactive"].includes(raw)) filter.active = false;
    }

    if (assignment === "assigned") {
      filter.role = { $exists: true, $ne: "" };
    } else if (assignment === "unassigned") {
      filter.$or = [{ role: { $exists: false } }, { role: "" }];
    }

    if (!hasPaging) {
      const users = await User.find(filter).select("-password").sort(sort).lean();
      return res.status(200).json(users);
    }

    const [data, total, activeCount, inactiveCount] = await Promise.all([
      User.find(filter).select("-password").sort(sort).skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
      User.countDocuments({ ...filter, active: { $ne: false } }),
      User.countDocuments({ ...filter, active: false }),
    ]);

    res.status(200).json({
      data,
      total,
      activeCount,
      inactiveCount,
      page,
      limit,
    });
  } catch (error) {
    res.status(404).json({ success: false, message: 'Not Found' });
  }
};
