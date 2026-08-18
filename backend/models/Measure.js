import mongoose from "mongoose";

const measureSchema = new mongoose.Schema(
   {
      description: {
         type: String,
         required: true,
      },
      active: {
         type: Boolean,
         required: true,
      },
      designation: {
         type: String,
         required: true,
      },
      },
   { timestamps: true }
);

measureSchema.index({ description: 1 });
measureSchema.index({ designation: 1 });
measureSchema.index({ active: 1 });

export default mongoose.model("Measure", measureSchema);
