// models/Counter.js
import mongoose from "mongoose";

const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },   // sequence name, e.g. "distribute.RIS_no"
    seq: { type: Number, default: 0 },       // last issued number
  },
  { versionKey: false }
);


export default mongoose.model("Counter", counterSchema);
