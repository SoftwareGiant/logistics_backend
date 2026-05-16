const mongoose = require("mongoose");

// 📍 Common location schema (reuse)
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
      lowercase: true,
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
  { _id: false }
);

const truckSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    truckNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    capacity: {
      type: Number, // in tons
      required: true,
    },

    type: {
      type: String,
      enum: ["open", "container", "closed", "refrigerated", "tanker"],
      required: true,
    },

    status: {
      type: String,
      enum: ["available", "in_transit", "loading"],
      default: "available",
    },

    // 🔁 ROUTE (important for matching)
    usualRoute: {
      from: {
        type: String,
        lowercase: true,
        trim: true
      },
      to: {
        type: String,
        lowercase: true,
        trim: true
      }
    },

    // 📍 CURRENT LIVE LOCATION
currentLocation: {
  city: String,
  coordinates: {
    type: [Number] // [lng, lat]
  }
},
    // 🕓 Last completed trip (for return matching)
    lastTrip: {
      from: String,
      to: String,
      completedAt: Date,
    },
    pricing: {
      normalPrice: {
        type: Number,
        required: true
      },
      returnPrice: {
        type: Number,
        required: true
      }
    },

    availability: {
      type: String,
      enum: ["available", "busy"],
      default: "available"
    },

    isReturnTripReady: {
      type: Boolean,
      default: false
    },

    images: {
      type: [String],
      default: []
    }
  },
  { timestamps: true }
);

// 🔥 GEO INDEX (VERY IMPORTANT)
truckSchema.index({ "currentLocation.coordinates": "2dsphere" });

module.exports = mongoose.model("Truck", truckSchema);