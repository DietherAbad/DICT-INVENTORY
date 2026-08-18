import express from "express";
import { getPublicItemByToken } from "../Controllers/publicController.js";

const router = express.Router();

router.get("/items/:token", getPublicItemByToken);

export default router;
