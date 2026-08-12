import mongoose from "mongoose";

const inventoryOfficeICTEquipmentSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  item_no: { type: String, required: true },
  property_no: { type: String, required: true },
  qty: { type: Number, default: null },
  itemName: { type: String, default: null },
  serial_no: { type: String, default: null },
  specifications: { type: String, default: null },
  asset_type: { type: String, default: null },
  asset_id: { type: String, unique: true, sparse: true },
  batch_no: { type: String, default: null },
  classification: { type: String, default: null },
  unitofmeasure: { type: String, default: null },
  status: { type: String, default: null },
  requeststatus: { type: String, default: null },
  transfertype: { type: String, default: null },
  unit_cost: { type: Number, default: null },
  total_cost: {type: Number, default: null },
  date_acquired: { type: Date, default: null },
  date_requested: { type: Date, default: null },
  date_approved: { type: Date, default: null },
  date_released: { type: Date, default: null },
  date_received: { type: Date, default: null },
  requested_by: { type: String, default: null },
  requested_by_id: { type: String, default: null },
  requested_by_email: { type: String, default: null },
  issued_to: { type: String, default: null },
  issued_to_id: { type: String, default: null },
  current_holder: { type: String, default: null },
  current_holder_id: { type: String, default: null },
  transfered_to: { type: String, default: null },
  transfered_to_id: { type: String, default: null },
  transferred_to_id: { type: String, default: null },
  transfer_type: { type: String, default: null },
  transfer_target: { type: String, default: null },
  stored_to: { type: String, default: null },
  date_issued: { type: Date, default: null },
  remarks: { type: String, default: null },
  reason: { type: String, default: null },
  inclusions: { type: String, default: null },
  archive: { type: Boolean, default: null },
  project: { type: String, default: null },
  ics_no: { type: String, default: null },
  par_no: { type: String, default: null },
  ptr_no: { type: String, default: null },
  thumbnail: {
    url: { type: String, default: null },
    filename: { type: String, default: null },
    stored_name: { type: String, default: null },
    size: { type: Number, default: null },
    uploaded_by: { type: String, default: null },
    uploaded_at: { type: Date, default: null },
  },
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
  public_qr_token: { type: String },
  history: [
    {
      name: { type: String, required: true },
      from: { type: String, required: true },
      to: { type: String, required: true },
      reason: { type: String, default: null },
      remarks: { type: String, default: null },
      changes: [{ type: String }],
      doc_type: { type: String, default: null },
      signed_file: { type: mongoose.Schema.Types.Mixed, default: null },
      doc_snapshot: { type: mongoose.Schema.Types.Mixed, default: null },
      revert_to_history_index: { type: Number, default: null },
    }
  ]
});

inventoryOfficeICTEquipmentSchema.index({ item_no: 1 });
inventoryOfficeICTEquipmentSchema.index({ property_no: 1 });
inventoryOfficeICTEquipmentSchema.index({ itemName: 1 });
inventoryOfficeICTEquipmentSchema.index({ classification: 1 });
inventoryOfficeICTEquipmentSchema.index({ status: 1 });
inventoryOfficeICTEquipmentSchema.index({ requeststatus: 1 });
inventoryOfficeICTEquipmentSchema.index({ date_requested: -1 });
inventoryOfficeICTEquipmentSchema.index({ issued_to: 1 });
inventoryOfficeICTEquipmentSchema.index({ transfered_to: 1 });
inventoryOfficeICTEquipmentSchema.index({ stored_to: 1 });
inventoryOfficeICTEquipmentSchema.index({ asset_type: 1 });
inventoryOfficeICTEquipmentSchema.index(
  { public_qr_token: 1 },
  { unique: true, sparse: true }
);

const InventoryOfficeICTEquipment =
  mongoose.models.InventoryOfficeICTEquipment ||
  mongoose.model("InventoryOfficeICTEquipment", inventoryOfficeICTEquipmentSchema);

export default InventoryOfficeICTEquipment;
