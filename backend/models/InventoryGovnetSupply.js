import mongoose from "mongoose";

const inventoryGovnetSupplySchema = new mongoose.Schema({
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

inventoryGovnetSupplySchema.index({ stock_no: 1 });
inventoryGovnetSupplySchema.index({ itemName: 1 });
inventoryGovnetSupplySchema.index({ classification: 1 });
inventoryGovnetSupplySchema.index({ status: 1 });
inventoryGovnetSupplySchema.index({ date: -1 });

export default mongoose.model("InventoryGovnetSupply", inventoryGovnetSupplySchema);
