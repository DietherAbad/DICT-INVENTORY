import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },

    position: {
      type: String,
    },

    designation: {
      type: String,
    },

    project: {
      type: String,
    },

    role: {
      type: String,
      default: "employee",
    },
    active: {
      type: Boolean,
      default: true,
    },
    session_version: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });
userSchema.index({ active: 1 });
userSchema.index({ session_version: 1 });
userSchema.index({ createdAt: -1 });

export default mongoose.model("User", userSchema);
