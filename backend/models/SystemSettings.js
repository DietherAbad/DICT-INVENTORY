import mongoose from "mongoose";

const systemSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "global", unique: true },
    enable_signed_download: { type: Boolean, default: true },
    enable_signed_upload: { type: Boolean, default: true },
    enable_email: { type: Boolean, default: true },
    hide_supply_quantities: { type: Boolean, default: false },
    hide_supply_quantity_roles: { type: [String], default: ["super admin", "inventory admin", "afd"] },
    distribution_request_limit_default: { type: Number, default: 5 },
    distribution_request_limit_by_role: { type: Object, default: {} },
    se_threshold: { type: Number, default: 50000 },
    cleanup_pending_enabled: { type: Boolean, default: true },
    cleanup_pending_days: { type: Number, default: 14 },
    session_timeout_enabled: { type: Boolean, default: true },
    session_timeout_minutes: { type: Number, default: 30 },
    role_access_version: { type: Number, default: 1 },
    role_access: { type: Object, default: {} },
    document_signatories: { type: Object, default: {} },
  },
  { timestamps: true }
);

export default mongoose.model("SystemSettings", systemSettingsSchema);
