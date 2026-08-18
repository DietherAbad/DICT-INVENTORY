import mongoose from "mongoose";

const logsSchema = new mongoose.Schema(
   {
      userId: {
         type: String
      },
      action: {
         type: String
      },
      status: {
         type: String,
         required: true,
      },
      time: {
         type: String,
         required: true,
      },
   },
   { timestamps: true }
);

logsSchema.index({ userId: 1 });
logsSchema.index({ status: 1 });
logsSchema.index({ time: -1 });
logsSchema.index({ createdAt: -1 });

export default mongoose.model("Logs", logsSchema);
