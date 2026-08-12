import mongoose from "mongoose";

const designationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    normalized: { type: String, required: true, unique: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

designationSchema.index({ normalized: 1 }, { unique: true });
designationSchema.index({ active: 1 });

export default mongoose.model("Designation", designationSchema);
