import express from 'express';
import {
  createMeasure,
  getAllMeasures,
  getMeasure,
  updateMeasure,
  deleteMeasure,
  getNumberOfMeasures,
} from '../Controllers/measureController.js';
import { requireAccess } from "../utils/rbac.js";
import { validateBody, schemas } from "../utils/validators.js";
import { createWriteLimiter, isAdminRole } from "../utils/rateLimit.js";

const writeLimiter = createWriteLimiter({
  windowMs: 5 * 60 * 1000,
  max: 40,
  skip: (req) => isAdminRole(req?.user?.role),
});

const measureRouter = express.Router();

// Create a new measure
measureRouter.post(
  '/',
  requireAccess("settings.core"),
  writeLimiter,
  validateBody(schemas.measureCreate),
  createMeasure
);

// Get all measures
measureRouter.get('/', requireAccess("settings.core"), getAllMeasures);

// Get a single measure by ID
measureRouter.get('/:id', requireAccess("settings.core"), getMeasure);

// Update a measure by ID
measureRouter.put(
  '/:id',
  requireAccess("settings.core"),
  writeLimiter,
  validateBody(schemas.measureUpdate),
  updateMeasure
);

// Delete a measure by ID
measureRouter.delete('/:id', requireAccess("settings.core"), writeLimiter, deleteMeasure);

// Get the number of all measures
measureRouter.get('/count', requireAccess("settings.core"), getNumberOfMeasures);

export default measureRouter;
