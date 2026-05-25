const mongoose = require("mongoose");

const representativeSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    phone: String,
    password: {
      type: String,
      minlength: 6,
    },
  },
  { _id: false }
);

const companySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    companyName: {
      type: String,
      required: true,
    },

    location: {
      city: {
        type: String,
        required: true,
        lowercase: true,
      },
      state: {
        type: String,
        required: true,
        lowercase: true,
      },
      address: {
        type: String,
        trim: true,
      },
      coordinates: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point",
        },
        coordinates: {
          type: [Number], // [lng, lat]
          required: true,
        },
      },
    },

    gstNumber: {
      type: String,
    },

    representatives: [representativeSchema],
  },
  { timestamps: true }
);

// 🔥 Geo Index (IMPORTANT)
companySchema.index({ "location.coordinates": "2dsphere" });

module.exports = mongoose.model("Company", companySchema);
