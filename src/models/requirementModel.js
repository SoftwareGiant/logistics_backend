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

    weight: Number,

    truckType: String,

    preferredDate: Date,

    preferredTime: String,

    price: Number,

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

// Geo indexes
requirementSchema.index({ "pickupCity.coordinates": "2dsphere" });
requirementSchema.index({ "dropCity.coordinates": "2dsphere" });

module.exports = mongoose.model("Requirement", requirementSchema);