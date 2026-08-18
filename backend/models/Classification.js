import mongoose from "mongoose";

const classificationSchema = new mongoose.Schema(
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

classificationSchema.index({ description: 1 });
classificationSchema.index({ designation: 1 });
classificationSchema.index({ active: 1 });

export default mongoose.model("Classification", classificationSchema);
