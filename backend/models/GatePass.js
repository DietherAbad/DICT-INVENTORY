import mongoose from "mongoose";

const gatePassItemSchema = new mongoose.Schema(
  {
    inventoryId: { type: String, required: true },
    collection: { type: String, required: true },
    itemName: { type: String, default: "" },
    classification: { type: String, default: "" },
    qty: { type: Number, default: 1 },
    unitofmeasure: { type: String, default: "pc" },
    property_no: { type: String, default: "" },
    serial_no: { type: String, default: "" },
    unit_cost: { type: Number, default: 0 },
    source: { type: String, enum: ["my_inventory", "in_stock"], required: true },
    prior_status: { type: String, default: null },
    prior_issued_to: { type: String, default: null },
    scanned_by: { type: String, default: null },
  },
  { _id: false, suppressReservedKeysWarning: true }
);

const gatePassSchema = new mongoose.Schema(
  {
    gatepass_no: { type: String, default: null, index: true, sparse: true },
    ics_no: { type: String, default: null },
    par_no: { type: String, default: null },
    requester: { type: String, required: true, index: true },
    requester_id: { type: String, default: null },
    office: { type: String, default: "" },
    fund_cluster: { type: String, default: "FREE WIFI" },
    purpose: { type: String, required: true },
    destination: { type: String, default: "" },
    date_requested: { type: Date, default: null },
    date_approved: { type: Date, default: null },
    date_released: { type: Date, default: null },
    date_out: { type: Date, default: null },
    date_returned: { type: Date, default: null },
    released_by: { type: String, default: null },
    approved_by: { type: String, default: null },
    guard_on_duty: { type: String, default: null },
    declined_by: { type: String, default: null },
    requeststatus: {
      type: String,
      enum: [
        "Draft",
        "For Approval",
        "For Release",
        "Released",
        "Out",
        "Returned",
        "Declined",
      ],
      default: "Draft",
      index: true,
    },
    items: { type: [gatePassItemSchema], default: [] },
    history: [
      {
        action: String,
        by: String,
        at: { type: Date, default: Date.now },
        note: String,
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("GatePass", gatePassSchema);
