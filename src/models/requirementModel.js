const mongoose = require("mongoose");

const requirementSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    pickupCity: { type: String, required: true, lowercase: true },
    dropCity: { type: String, required: true, lowercase: true },

    goodsType: String,
    weight: Number,
    truckType: String,
    preferredDate: Date,

    additionalNotes: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    status: {
      type: String,
      enum: ["active", "fulfilled", "cancelled"],
      default: "active",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Requirement", requirementSchema);