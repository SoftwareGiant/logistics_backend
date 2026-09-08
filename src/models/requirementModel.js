const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema(
  {
    city: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    state: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    address: {
      type: String,
      required: true,
      trim: true,
    },

    coordinates: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },

      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
  },
  { _id: false }
);

const requirementSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    pickupCity: {
      type: locationSchema,
      required: true,
    },

    dropCity: {
      type: locationSchema,
      required: true,
    },

    goodsType: String,

    weight: {
      type: Number,
      required: true,
      min: 0,
    },

    truckType: {
      type: String,
      required: true,
      trim: true,
    },

    preferredDate: Date,

    preferredTime: {
      type: String,
      trim: true,
    },

    budget: {
      type: Number,
      required: true,
      min: 1,
    },

    additionalNotes: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    status: {
      type: String,
      enum: ["active", "fulfilled", "cancelled", "expired"],
      default: "active",
    },

    // ⏱️ Matching window — the requirement is live for 30 minutes.
    // If no offer is accepted before this, it is treated as expired and the
    // company can repost it with an adjusted price / details.
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 60 * 1000),
    },
  },
  { timestamps: true }
);

// Geo indexes
requirementSchema.index({ "pickupCity.coordinates": "2dsphere" });
requirementSchema.index({ status: 1, expiresAt: 1 });
requirementSchema.index({ "dropCity.coordinates": "2dsphere" });

module.exports = mongoose.model("Requirement", requirementSchema);