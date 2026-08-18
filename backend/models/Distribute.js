// models/Distribute.js
import mongoose from "mongoose";
import Counter from "./Counter.js";

function pad(num, size) {
  let s = String(num);
  while (s.length < size) s = "0" + s;
  return s;
}

function getDatePartsFrom(dateLike) {
  const d = dateLike ? new Date(dateLike) : new Date();
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1, 2);
  const day = pad(d.getDate(), 2);
  // dateKey is YYYY-MMDD (per your sample: 2025-1122), e.g. Nov 22 => "2025-1122"
  const dateKey = `${year}-${month}${day}`;
  return { year, month, day, dateKey };
}

const distributeSchema = new mongoose.Schema(
  {
    // RIS string in format "YYYY-MMDD-COUNTER" (e.g., "2025-1122-0001")
    RIS_no: {
      type: String,
      unique: true,
      index: true,
      sparse: true, // allow legacy docs without RIS_no
    },

    // cart items
    items: [
      {
        stock_no: { type: Number, required: true },
        returnId: { type: String, required: true },
        classification: { type: String, required: true },
        project: { type: String, default: null },
        itemName: { type: String, required: true },
        unitofmeasure: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        cost: { type: Number, required: true, min: 0 },
      },
    ],

    itemId: { type: String },

    request_type: { type: String, default: "distribution" },
    distributedto: {
      type: String,
      required: function () {
        return this.request_type !== "disposal";
      },
      default: null,
    },
    office: {
      type: String,
      required: function () {
        return this.request_type !== "disposal";
      },
      default: null,
    },
    distributedto_is: {
      type: String,
      required: function () {
        return this.request_type !== "disposal";
      },
      default: null,
    },
    requested_by: { type: String, default: null },
    requested_by_id: { type: String, default: null },

    purpose: { type: String, default: null, trim: true },
    remarks: { type: String, default: null },
    disposal_reason: { type: String, default: null },
    disposal_notes: { type: String, default: null },

    status: { type: String, default: "Pending" },
    requeststatus: { type: String, default: null },
    date_checked: { type: Date, default: null },
    date_requested: { type: Date, default: null },
    date_approved: { type: Date, default: null },
    date_released: { type: Date, default: null },
    date_received: { type: Date, default: null },
    signed_file: {
      url: { type: String, default: null },
      filename: { type: String, default: null },
      stored_name: { type: String, default: null },
      uploaded_by: { type: String, default: null },
      uploaded_at: { type: Date, default: null },
    },
    signed_file_prev: {
      url: { type: String, default: null },
      filename: { type: String, default: null },
      stored_name: { type: String, default: null },
      uploaded_by: { type: String, default: null },
      uploaded_at: { type: Date, default: null },
    },
    signed_file_prev_expires_at: { type: Date, default: null },
    history: [
      {
        name: { type: String, required: true },
        from: { type: String, required: true },
        to: { type: String, required: true },
        reason: { type: String, default: null },
        remarks: { type: String, default: null },
        changes: [{ type: String }],
        doc_type: { type: String, default: null },
        signed_file: {
          url: { type: String, default: null },
          filename: { type: String, default: null },
          stored_name: { type: String, default: null },
          uploaded_by: { type: String, default: null },
          uploaded_at: { type: Date, default: null },
        },
        doc_snapshot: { type: mongoose.Schema.Types.Mixed, default: null },
        revert_to_history_index: { type: Number, default: null },
      },
    ],
  },
  {
    timestamps: true,
  }
);

distributeSchema.index({ status: 1 });
distributeSchema.index({ requeststatus: 1 });
distributeSchema.index({ date_requested: -1 });
distributeSchema.index({ distributedto: 1 });
distributeSchema.index({ distributedto_is: 1 });
distributeSchema.index({ createdAt: -1 });

const normalizeRequestType = (value) => String(value || "").toLowerCase().trim();

// Atomic sequencer (daily reset by counter key suffix YYYY-MMDD)
async function assignDailyRIS(doc) {
  // Prefer the request date if supplied; otherwise use "now"
  const basis = doc.date_requested || Date.now();
  const { dateKey } = getDatePartsFrom(basis);
  const isDisposal = normalizeRequestType(doc.request_type) === "disposal";

  // Keep the legacy RIS counter key for distributions so existing sequences do not reset.
  // Supply disposal uses its own SDR counter and visible prefix.
  const counterKey = isDisposal
    ? `distribute.SDR_no.${dateKey}`
    : `distribute.RIS_no.${dateKey}`;

  const counter = await Counter.findOneAndUpdate(
    { _id: counterKey },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session: doc.$session?.() || undefined }
  ).lean();

  const seqStr = pad(counter.seq, 4); // "0001"
  // Final RIS: YYYY-MMDD-COUNTER; final SDR: SDR-YYYY-MMDD-COUNTER.
  doc.RIS_no = isDisposal ? `SDR-${dateKey}-${seqStr}` : `${dateKey}-${seqStr}`;
}

distributeSchema.pre("save", async function (next) {
  try {
    if (this.isNew && !this.RIS_no) {
      await assignDailyRIS(this);
    }
    next();
  } catch (err) {
    next(err);
  }
});

export default mongoose.model("Distribute", distributeSchema);
