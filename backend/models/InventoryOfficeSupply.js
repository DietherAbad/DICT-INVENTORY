import mongoose from "mongoose";

const inventoryOfficeSupplySchema = new mongoose.Schema({
  id: { type: Number, required: true },
  stock_no: { type: Number, required: true },
  stock_qty: { type: Number, default: null },
  unit: { type: Number, default: null },
  itemName: { type: String, default: null },
  classification: { type: String, default: null },
  unitofmeasure: { type: String, default: null },
  status: { type: String, default: null },
  stock_unit_cost: { type: Number, default: null },
  stock_total_cost: { type: Number, default: null },
  lowstock_threshold: { type: Number, default: 10 },
  date: { type: Date, default: null },
  purchase_qty: { type: Number, default: null },
  purchase_unit_cost: { type: Number, default: null },
  purchase_total_cost: { type: Number, default: null },
  distribution_qty: { type: Number, default: null },
  distribution_unit_cost: { type: Number, default: null },
  distribution_total_cost: { type: Number, default: null },
  balance_qty: { type: Number, default: null },
  balance_unit_cost: { type: Number, default: null },
  balance_total_cost: { type: Number, default: null },
  project: { type: String, default: null },
  remarks: { type: String, default: null },
  archive: { type: Boolean, default: null },
  disposed_qty: { type: Number, default: null },
  thumbnail: {
    url: { type: String, default: null },
    filename: { type: String, default: null },
    stored_name: { type: String, default: null },
    size: { type: Number, default: null },
    uploaded_by: { type: String, default: null },
    uploaded_at: { type: Date, default: null },
  },
  history: [
    {
      name: { type: String, required: true },
      history_qty: { type: Number, default: null },
      disposed_qty: { type: Number, default: null },
      unit_cost: { type: Number, default: null },
      date: { type: String, required: true },
      station: { type: String, required: true },
      status: { type: String, default: null },
      requeststatus: { type: String, default: null },
      reference: { type: String, default: null },
      document_type: { type: String, default: null },
      movement_type: { type: String, default: null },
      remarks: { type: String, default: null },
    }
  ]
});

inventoryOfficeSupplySchema.index({ stock_no: 1 });
inventoryOfficeSupplySchema.index({ itemName: 1 });
inventoryOfficeSupplySchema.index({ classification: 1 });
inventoryOfficeSupplySchema.index({ status: 1 });
inventoryOfficeSupplySchema.index({ date: -1 });
inventoryOfficeSupplySchema.index({ project: 1 });

export default mongoose.model("InventoryOfficeSupply", inventoryOfficeSupplySchema);
