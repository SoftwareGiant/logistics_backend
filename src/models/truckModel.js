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

    // ✅ Set true when the admin approves the owner (used to match only verified trucks)
    verified: {
      type: Boolean,
      default: false,
    },

    // 🏠 BASE LOCATION — captured once at registration (owner's browser location / picked place).
    // Used as a fallback for matching when there is no fresh live location.
    baseLocation: {
      address: { type: String, trim: true },
      city: { type: String, lowercase: true, trim: true },
      coordinates: {
        type: [Number], // [lng, lat]
      },
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
      },
      averageTime: {
        type: String,
        trim: true
      }
    },

    // 📍 CURRENT LIVE LOCATION (refreshed by the driver app while the truck moves)
    currentLocation: {
      city: String,
      coordinates: {
        type: [Number] // [lng, lat]
      },
      updatedAt: {
        type: Date,
      },
    },
    pendingLocation: {
      city: {
        type: String,
        lowercase: true,
        trim: true
      },
      coordinates: {
        type: [Number]
      }
    },
    // 🕓 Last completed trip (for return matching)
    lastTrip: {
      from: String,
      to: String,
      completedAt: Date,
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

// 🔥 GEO INDEXES (VERY IMPORTANT for radius matching)
truckSchema.index({ "currentLocation.coordinates": "2dsphere" });
truckSchema.index({ "baseLocation.coordinates": "2dsphere" });

module.exports = mongoose.model("Truck", truckSchema);