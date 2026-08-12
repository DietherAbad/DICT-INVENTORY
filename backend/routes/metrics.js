import express from "express";
import { metricsRegistry } from "../utils/metrics.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const token = process.env.METRICS_TOKEN || "";
  if (token) {
    const authHeader = req.get("authorization") || "";
    const headerToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : "";
    const queryToken = req.query?.token;
    if (headerToken !== token && queryToken !== token) {
      return res.status(401).json({ message: "Unauthorized" });
    }
  }

  res.set("Content-Type", metricsRegistry.contentType);
  res.end(await metricsRegistry.metrics());
});

export default router;
