import mongoose from "mongoose";

const purchaseSchema = new mongoose.Schema(
   {
      purchaseId: {
         type: String
      },
      classification: {
         type: String
      },
      itemName: {
         type: String,
         required: true,
      },
      quantity: {
         type: Number,
         required: true
      },
      unitofmeasure: {
         type: String,
         required: true,
      },
      date: {
         type: Date,
         required: true
      },
      unitcost: {
         type: Number,
         required: true
      },
      total: {
         type: Number,
         required: true
      },
   },
   { timestamps: true }
);

export default mongoose.model("Purchase", purchaseSchema);
