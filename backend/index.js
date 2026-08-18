import express  from "express";
import crypto from "crypto";
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import cors from 'cors'
import bodyParser from 'body-parser';
import cookieParser from "cookie-parser";
import * as Sentry from "@sentry/node";
import userRoute from './routes/users.js'
import authRoute from './routes/auth.js'
import logsRoute from './routes/logs.js'
import emailRoute from './routes/email.js'
import classificationRoute from './routes/classification.js'
import distributeRoute from './routes/distribute.js'
import measureRoute from './routes/measure.js'
import inventoryofficesupply from './routes/inventoryofficesupply.js'
import inventoryofficeequipment from './routes/inventoryofficeequipment.js'
import inventoryofficefurnitureandfixture from './routes/inventoryofficefurnitureandfixture.js'
import inventoryofficeICTequipment from './routes/inventoryofficeICTequipment.js'
import inventoryofficemotorandvehicle from './routes/inventoryofficeMotorandVehicle.js'
import inventoryofficeLandandBuilding from './routes/inventoryofficeLandandBuilding.js'
import inventorygovnetsupply from './routes/inventorygovnetsupply.js'
import inventoryFreewifi from './routes/inventoryFreewifi.js'
import inventorygovnetequipment from './routes/inventorygovnetequipment.js'
import requestRoute from "./routes/request.js";
import systemSettingsRoute from "./routes/systemSettings.js";
import dashboardRoute from "./routes/dashboard.js";
import healthRoute from "./routes/health.js";
import metricsRoute from "./routes/metrics.js";
import publicRoute from "./routes/public.js";
import csvImportRoute from "./routes/csvImport.js";
import projectsRoute from "./routes/projects.js";
import designationsRoute from "./routes/designations.js";
import backupRoute from "./routes/backup.js";
import gatepassRoute from "./routes/gatepass.js";
import { createRateLimiter } from "./utils/rateLimit.js";
import SystemSettings from "./models/SystemSettings.js";
import Distribute from "./models/Distribute.js";
import InventoryOfficeEquipment from "./models/InventoryOfficeEquipment.js";
import InventoryOfficeFurnitureandFixture from "./models/InventoryOfficeFurnitureandFixture.js";
import InventoryOfficeICTEquipment from "./models/InventoryOfficeICTEquipment.js";
import InventoryOfficeMotorandVehicle from "./models/InventoryOfficeMotorandVehicle.js";
import { createLog } from "./Controllers/logsController.js";
import { log, flushLogs } from "./utils/logger.js";
import { observeHttpDuration } from "./utils/metrics.js";
import { uploadsRoot } from "./utils/uploadPaths.js";

dotenv.config()
const app = express()
const port = process.env.PORT || 8000
const sentryDsn = process.env.SENTRY_DSN || "";
if (sentryDsn) {
   Sentry.init({
      dsn: sentryDsn,
      environment: process.env.NODE_ENV || "development",
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
   });
   app.use(Sentry.Handlers.requestHandler());
}
const rawCorsOrigins = (process.env.CORS_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);
const allowList = new Set([
   ...rawCorsOrigins,
   "http://localhost:3000",
   "http://inventory.dictr2.cloud",
   "https://inventory.dictr2.cloud",
]);
const netlifyPattern = process.env.CORS_NETLIFY_DOMAIN
   ? new RegExp(`^https://${process.env.CORS_NETLIFY_DOMAIN.replace(/\./g, "\\.")}$`)
   : /^https?:\/\/.+\.netlify\.app$/i;

const corsOptions = {
   origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowList.has(origin)) return callback(null, true);
      if (netlifyPattern.test(origin)) return callback(null, true);
      return callback(new Error("CORS origin not allowed"));
   },
   credentials: true,
   allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
   methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
}
app.use(bodyParser.json({ limit: "1mb" }));

mongoose.set("strictQuery", false)
const connect = async() => {
   try {
      await mongoose.connect(process.env.MONGO_URI, {
         useNewUrlParser: true,
         useUnifiedTopology: true
      })

      console.log('MongoDB connected')
      await ensureUserReadAccess();
   } catch (error) {
      console.log('MongoDB connected failed')
   }
}

app.use(express.json({ limit: "1mb" }))
app.use(cors(corsOptions))
app.use(cookieParser())
app.use((req, res, next) => {
   const reqId =
      typeof crypto.randomUUID === "function"
         ? crypto.randomUUID()
         : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
   req.requestId = reqId;
   res.setHeader("X-Request-Id", reqId);

   const start = process.hrtime.bigint();
   res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      const routeLabel = req.route?.path
         ? `${req.baseUrl}${req.route.path}`
         : req.baseUrl || req.path;
      observeHttpDuration(req.method, routeLabel, res.statusCode, durationMs / 1000);
      log("info", "http_request", {
         requestId: reqId,
         method: req.method,
         path: req.originalUrl,
         route: routeLabel,
         statusCode: res.statusCode,
         durationMs: Math.round(durationMs),
         ip: req.ip,
      });
   });

   next();
});
const globalLimiter = createRateLimiter({
   windowMs: 60 * 1000,
   max: 300,
   message: "Too many requests. Please slow down.",
});

app.use("/api/v1", globalLimiter);
app.use("/uploads", express.static(uploadsRoot));
app.use("/api/v1/uploads", express.static(uploadsRoot));
app.use("/api/v1/auth", authRoute)
app.use("/api/v1/users", userRoute)
app.use("/api/v1/logs", logsRoute)
app.use('/api/v1/email', emailRoute);
app.use('/api/v1/classification', classificationRoute);
app.use('/api/v1/distribute', distributeRoute);
app.use('/api/v1/inventoryofficesupply', inventoryofficesupply);
app.use('/api/v1/inventoryofficeequipment', inventoryofficeequipment);
app.use('/api/v1/inventoryofficefurnitureandfixture', inventoryofficefurnitureandfixture);
app.use('/api/v1/inventoryofficeICTequipment', inventoryofficeICTequipment);
app.use('/api/v1/inventoryofficemotorandvehicle', inventoryofficemotorandvehicle);
app.use('/api/v1/inventoryofficeLandandBuilding', inventoryofficeLandandBuilding);
app.use('/api/v1/inventorygovnetsupply', inventorygovnetsupply);
app.use('/api/v1/inventorygovnetequipment', inventorygovnetequipment);
app.use('/api/v1/inventoryFreewifi', inventoryFreewifi);
app.use("/api/v1/requests", requestRoute);
app.use("/api/v1/settings", systemSettingsRoute);
app.use("/api/v1/dashboard", dashboardRoute);
app.use("/api/v1/health", healthRoute);
app.use("/api/v1/metrics", metricsRoute);
app.use("/api/v1/public", publicRoute);
app.use("/api/v1/csv-import", csvImportRoute);
app.use("/api/v1/projects", projectsRoute);
app.use("/api/v1/designations", designationsRoute);
app.use("/api/v1/backup", backupRoute);
app.use("/api/v1/gatepass", gatepassRoute);




app.use('/api/v1/measure', measureRoute);

if (sentryDsn) {
   app.use(Sentry.Handlers.errorHandler());
}

app.use((err, req, res, _next) => {
   const status = err?.status || 500;
   log("error", "unhandled_error", {
      requestId: req?.requestId,
      message: err?.message || "Unhandled error",
      status,
      stack: err?.stack,
   });
   res.status(status).json({ success: false, message: err?.message || "Server error" });
});

process.on("unhandledRejection", (reason) => {
   log("error", "unhandled_rejection", { reason: String(reason) });
   if (sentryDsn) Sentry.captureException(reason);
});

process.on("uncaughtException", (err) => {
   log("error", "uncaught_exception", { message: err?.message, stack: err?.stack });
   if (sentryDsn) Sentry.captureException(err);
});

process.on("SIGINT", async () => {
   await flushLogs();
   process.exit(0);
});

process.on("SIGTERM", async () => {
   await flushLogs();
   process.exit(0);
});

const safeCreateLog = async (logData) => {
   try {
      await createLog(logData);
   } catch (e) {
      console.error("LOGGING_ERROR:", e?.message || e);
   }
};

const normalizeRoleKey = (role) => {
   if (!role) return "";
   return String(role).trim().toLowerCase();
};

const ensureUserReadAccess = async () => {
   try {
      const settings = await SystemSettings.findOne({ key: "global" });
      if (!settings) return;

      const roleAccess = settings.role_access || {};
      const targets = ["AFD", "AFD Special Access"];
      let changed = false;

      targets.forEach((roleName) => {
         const targetKey = normalizeRoleKey(roleName);
         const existingKey =
            Object.keys(roleAccess).find(
               (k) => normalizeRoleKey(k) === targetKey
            ) || targetKey;
         const list = Array.isArray(roleAccess[existingKey])
            ? roleAccess[existingKey]
            : [];
         if (!list.includes("users.read")) {
            roleAccess[existingKey] = [...list, "users.read"];
            changed = true;
         }
      });

      if (changed) {
         settings.role_access = roleAccess;
         await settings.save();
         log("info", "role_access_migration", {
            addedTag: "users.read",
            roles: targets,
         });
      }
   } catch (error) {
      log("error", "role_access_migration_failed", { message: error?.message });
   }
};

const cleanupStaleDistributions = async () => {
   try {
      const settings = await SystemSettings.findOne({ key: "global" }).lean();
      const enabled = settings?.cleanup_pending_enabled !== false;
      if (!enabled) return;

      const days = Number(settings?.cleanup_pending_days || 14);
      const ttlMs = Math.max(1, days) * 24 * 60 * 60 * 1000;
      const cutoff = new Date(Date.now() - ttlMs);
      const nowIso = new Date().toISOString();
      const autoNote = `[AUTO-DECLINE] ${nowIso} • Declined due to inactivity (${days} day window).`;

      const preApprovalRegex = /^(pending|for checking|for approval(?:[\s-]*afd)?)$/i;
      const staleFilter = {
         $or: [
            { updatedAt: { $lt: cutoff } },
            { updatedAt: { $exists: false }, createdAt: { $lt: cutoff } },
         ],
      };
      const preApprovalFilter = {
         $or: [
            { requeststatus: preApprovalRegex },
            { status: preApprovalRegex },
         ],
      };
      const filter = {
         $and: [staleFilter, preApprovalFilter],
      };

      const remarkUpdate = {
         $let: {
            vars: { existing: { $ifNull: ["$remarks", ""] } },
            in: {
               $cond: [
                  { $gt: [{ $strLenCP: "$$existing" }, 0] },
                  { $concat: ["$$existing", "\n", autoNote] },
                  autoNote,
               ],
            },
         },
      };

      const updatePipeline = [
         {
            $set: {
               status: "Declined",
               requeststatus: "Declined",
               remarks: remarkUpdate,
            },
         },
      ];

      const targets = [
         { label: "Distribution", model: Distribute },
         { label: "Office Equipment", model: InventoryOfficeEquipment },
         { label: "Office Furniture & Fixtures", model: InventoryOfficeFurnitureandFixture },
         { label: "Office ICT Equipment", model: InventoryOfficeICTEquipment },
         { label: "Office Motor & Vehicle", model: InventoryOfficeMotorandVehicle },
      ];

      const results = await Promise.all(
         targets.map(async (target) => {
            const result = await target.model.updateMany(filter, updatePipeline);
            return { label: target.label, modified: result?.modifiedCount || 0 };
         })
      );

      const totalModified = results.reduce((sum, item) => sum + item.modified, 0);
      if (totalModified > 0) {
         const breakdown = results
            .filter((item) => item.modified > 0)
            .map((item) => `${item.label}:${item.modified}`)
            .join(", ");
         await safeCreateLog({
            userId: "System",
            action: `Auto Decline (${totalModified} stale request${totalModified === 1 ? "" : "s"})${breakdown ? ` • ${breakdown}` : ""}`,
            status: "success",
            time: nowIso,
         });
      }
   } catch (error) {
      console.error("cleanupStaleDistributions error:", error);
      await safeCreateLog({
         userId: "System",
         action: "Auto Decline (error)",
         status: "error",
         time: new Date().toISOString(),
      });
   }
};

const startCleanupJob = () => {
   const intervalMs = 60 * 60 * 1000;
   setInterval(cleanupStaleDistributions, intervalMs);
   cleanupStaleDistributions();
};

app.listen(port, () => {
   connect()
   startCleanupJob()
   console.log('server listening on port', port)
})
