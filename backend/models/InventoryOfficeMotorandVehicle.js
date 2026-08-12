import mongoose from "mongoose";

const inventoryOfficeMotorandVehicleSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  item_no: { type: Number, required: true },
  property_no: { type: Number, required: true },
  qty: { type: Number, default: null },
  model: { type: String, default: null },
  plate_no: { type: String, default: null },
  engine_no: { type: String, default: null },
  chassis_no: { type: String, default: null },
  classification: { type: String, default: null },
  unitofmeasure: { type: String, default: null },
  status: { type: String, default: null },
  requeststatus: { type: String, default: null },
  unit_cost: { type: Number, default: null },
  date_acquired: { type: Date, default: null },
  issued_to: { type: String, default: null },
  stored_to: { type: String, default: null },
  date_issued: { type: Date, default: null },
  remarks: { type: String, default: null },
  archive: { type: Boolean, default: null },
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
});

inventoryOfficeMotorandVehicleSchema.index({ item_no: 1 });
inventoryOfficeMotorandVehicleSchema.index({ property_no: 1 });
inventoryOfficeMotorandVehicleSchema.index({ status: 1 });
inventoryOfficeMotorandVehicleSchema.index({ requeststatus: 1 });
inventoryOfficeMotorandVehicleSchema.index({ date_acquired: -1 });
inventoryOfficeMotorandVehicleSchema.index({ plate_no: 1 });
inventoryOfficeMotorandVehicleSchema.index({ issued_to: 1 });
inventoryOfficeMotorandVehicleSchema.index({ stored_to: 1 });

export default mongoose.model("InventoryOfficeMotorandVehicle", inventoryOfficeMotorandVehicleSchema);
