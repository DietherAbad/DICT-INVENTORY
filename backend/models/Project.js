import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    normalized: { type: String, required: true, unique: true },
    active: { type: Boolean, default: true },
    fund_cluster: {
      type: String,
      enum: ["AFD", "TOD"],
      default: "TOD",
    },
  },
  { timestamps: true }
);

projectSchema.index({ normalized: 1 }, { unique: true });
projectSchema.index({ active: 1 });

export default mongoose.model("Project", projectSchema);
