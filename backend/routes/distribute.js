import express from 'express';
import {
  createDistribution,
  getAllDistributions,
  getDistribution,
  updateDistribution,
  deleteDistribution,
  getNumberOfDistributions,
  uploadSignedDistributionFile,
  revertSignedDistributionFile,
  revertDistributionState,
} from '../Controllers/distributeController.js';
import { validateBody, schemas } from "../utils/validators.js";
import { createWriteLimiter, isAdminRole } from "../utils/rateLimit.js";

const writeLimiter = createWriteLimiter({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: "Too many distribution changes. Please slow down.",
  skip: (req) => isAdminRole(req?.user?.role),
});
import { signedUpload } from "../utils/upload.js";
import { requireAccess, requireAnyAccess, requireAuth } from "../utils/rbac.js";

const router = express.Router();

// Routes for Distribution
router.post(
  '/distributions',
  requireAnyAccess(["stocks.distribution", "stocks.distribution.request"]),
  writeLimiter,
  validateBody(schemas.distributionCreate),
  createDistribution
); // Create a new distribution record
router.get('/distributions', requireAuth, getAllDistributions); // Get all distribution records
router.get('/distributions/count', requireAuth, getNumberOfDistributions); // Get the number of all distribution records
router.get('/distributions/:id', requireAccess("details.checkform"), getDistribution); // Get a single distribution record by ID
router.put(
  '/distributions/:id',
  requireAccess("details.checkform"),
  writeLimiter,
  validateBody(schemas.distributionUpdate),
  updateDistribution
); // Update a distribution record by ID
router.post(
  "/distributions/:id/signed-file",
  requireAccess("details.checkform"),
  writeLimiter,
  signedUpload.single("file"),
  uploadSignedDistributionFile
);
router.post(
  "/distributions/:id/signed-file/revert",
  requireAccess("details.checkform"),
  writeLimiter,
  revertSignedDistributionFile
);
router.post(
  "/distributions/:id/revert-state",
  requireAccess("details.checkform"),
  writeLimiter,
  revertDistributionState
);
router.delete(
  '/distributions/:id',
  requireAccess("stocks.distribution"),
  writeLimiter,
  deleteDistribution
); // Delete a distribution record by ID

export default router;
