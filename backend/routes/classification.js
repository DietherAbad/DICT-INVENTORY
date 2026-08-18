import express from 'express';
import {
   createClassification,
   getAllClassifications,
   getClassification,
   updateClassification,
   deleteClassification,
   getNumberOfClassifications,
} from '../Controllers/classificationController.js';
import { requireAccess } from "../utils/rbac.js";
import { validateBody, schemas } from "../utils/validators.js";
import { createWriteLimiter, isAdminRole } from "../utils/rateLimit.js";

const writeLimiter = createWriteLimiter({
  windowMs: 5 * 60 * 1000,
  max: 40,
  skip: (req) => isAdminRole(req?.user?.role),
});

const router = express.Router();

// Routes for Classification
router.post(
  '/',
  requireAccess("settings.core"),
  writeLimiter,
  validateBody(schemas.classificationCreate),
  createClassification
); // Create a new classification
router.get('/', requireAccess("settings.core"), getAllClassifications); // Get all classifications
router.get('/:id', requireAccess("settings.core"), getClassification); // Get a single classification by ID
router.put(
  '/:id',
  requireAccess("settings.core"),
  writeLimiter,
  validateBody(schemas.classificationUpdate),
  updateClassification
); // Update a classification by ID
router.delete('/:id', requireAccess("settings.core"), writeLimiter, deleteClassification); // Delete a classification by ID
router.get('/count', requireAccess("settings.core"), getNumberOfClassifications); // Get the number of all classifications

export default router;
