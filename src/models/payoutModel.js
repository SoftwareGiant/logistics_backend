const mongoose = require("mongoose");

const payoutSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 1,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    // Bank details snapshot at time of request
    bankDetails: {
      accountHolderName: { type: String, default: "" },
      ifsc: { type: String, default: "" },
      accountNumber: { type: String, default: "" },
    },

    adminNote: {
      type: String,
      default: "",
    },

    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    processedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payout", payoutSchema);
