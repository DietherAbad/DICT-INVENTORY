import express from 'express'
import { login, register, loginadmin, googleLogin } from '../Controllers/authController.js'
import { createRateLimiter, authKey } from '../utils/rateLimit.js'
import { validateBody, schemas } from "../utils/validators.js";
import { requireAccess } from "../utils/rbac.js";
// import bcrypt from 'bcryptjs'
// import jwt from 'jsonwebtoken'

const router = express.Router()

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts. Please wait and try again.",
  keyGenerator: authKey,
});

const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Too many registration attempts. Please try again later.",
  keyGenerator: authKey,
});

router.post(
  '/register',
  requireAccess("users.manage"),
  registerLimiter,
  validateBody(schemas.authRegister),
  register
)
router.post('/login', authLimiter, validateBody(schemas.authLogin), login)
router.post('/loginadmin', authLimiter, validateBody(schemas.authLogin), loginadmin)
router.post('/google', authLimiter, validateBody(schemas.authGoogle), googleLogin)



export default router
