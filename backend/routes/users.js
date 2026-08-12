import express from 'express'
import { deleteUser, forceLogoutUser, getAllUser, getSingleUser, updateUser, getUserDirectory } from '../Controllers/userController.js'

import { requireAccess, requireAnyAccess, requireRole, requireSelfOrAccess } from "../utils/rbac.js";
import { validateBody, schemas } from "../utils/validators.js";
import { createWriteLimiter, isAdminRole } from "../utils/rateLimit.js";

const writeLimiter = createWriteLimiter({
  windowMs: 5 * 60 * 1000,
  max: 40,
  skip: (req) => isAdminRole(req?.user?.role),
});

const router = express.Router()

// Lightweight directory (read-only)
router.get(
  '/directory',
  requireAnyAccess(["users.read", "settings.core", "settings.signatories"]),
  getUserDirectory
)

//Update user
router.put('/:id', requireSelfOrAccess("users.manage"), writeLimiter, validateBody(schemas.userUpdate), updateUser)

//Delete user
router.delete('/:id', requireAccess("users.manage"), writeLimiter, deleteUser)

// Force logout user (Super Admin only)
router.post(
  "/:id/force-logout",
  requireAccess("users.manage"),
  requireRole(["Super Admin"]),
  writeLimiter,
  forceLogoutUser
)

//Get single user
router.get('/:id', requireSelfOrAccess("users.manage"), getSingleUser)

//Get all user
router.get('/', requireAccess("users.manage"), getAllUser)


export default router
