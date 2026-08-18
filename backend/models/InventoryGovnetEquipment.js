import mongoose from "mongoose";

const inventoryGovnetEquipmentSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  item_no: { type: Number, required: true },
  property_no: { type: Number, required: true },
  qty: { type: Number, default: null },
  itemName: { type: String, default: null },
  serial_no: { type: String, default: null },
  classification: { type: String, default: null },
  unitofmeasure: { type: String, default: null },
  status: { type: String, default: null },
  unit_cost: { type: Number, default: null },
  total_cost: { type: Number, default: null },
  date_acquired: { type: Date, default: null },
  issued_to: { type: String, default: null },
  stored_to: { type: String, default: null },
  date_issued: { type: Date, default: null },
  remarks: { type: String, default: null },
  thumbnail: {
    url: { type: String, default: null },
    filename: { type: String, default: null },
    stored_name: { type: String, default: null },
    size: { type: Number, default: null },
    uploaded_by: { type: String, default: null },
    uploaded_at: { type: Date, default: null },
  },
  archive: { type: Boolean, default: null }
});

inventoryGovnetEquipmentSchema.index({ item_no: 1 });
inventoryGovnetEquipmentSchema.index({ property_no: 1 });
inventoryGovnetEquipmentSchema.index({ itemName: 1 });
inventoryGovnetEquipmentSchema.index({ classification: 1 });
inventoryGovnetEquipmentSchema.index({ status: 1 });
inventoryGovnetEquipmentSchema.index({ date_acquired: -1 });
inventoryGovnetEquipmentSchema.index({ issued_to: 1 });
inventoryGovnetEquipmentSchema.index({ stored_to: 1 });

export default mongoose.model("InventoryGovnetEquipment", inventoryGovnetEquipmentSchema);
