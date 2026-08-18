import mongoose from "mongoose";

const inventoryLandAndBuildingSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  item_no: { type: Number, default: null },
  classification: { type: String, default: null },
  address: { type: String, default: null },
  land_area: { type: Number, default: null },
  bldg_area: { type: Number, default: null },
  proof_of_ownership: { type: String, default: null },
  reference: { type: String, default: null },
  unit_value: { type: Number, default: null },
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

inventoryLandAndBuildingSchema.index({ item_no: 1 });
inventoryLandAndBuildingSchema.index({ classification: 1 });
inventoryLandAndBuildingSchema.index({ address: 1 });

export default mongoose.model("InventoryLandAndBuilding", inventoryLandAndBuildingSchema);
