import express from 'express'
import { createLog, getAllLogs} from '../Controllers/logsController.js'
import { requireAccess } from "../utils/rbac.js";
import { validateBody, schemas } from "../utils/validators.js";
import { createWriteLimiter, isAdminRole } from "../utils/rateLimit.js";

const writeLimiter = createWriteLimiter({
  windowMs: 5 * 60 * 1000,
  max: 60,
  skip: (req) => isAdminRole(req?.user?.role),
});

const router = express.Router()
router.post(
  '/',
  requireAccess("settings.audit_logs"),
  writeLimiter,
  validateBody(schemas.logCreate),
  createLog
)
router.get('/', requireAccess("settings.audit_logs"), getAllLogs)
// router.get('/:id', verifyUser, getBooking)
// router.get('/', verifyAdmin, getAllBooking)

export default router
