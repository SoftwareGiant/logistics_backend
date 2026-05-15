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
      lowercase: true,
      trim: true,
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
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    truckId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Truck",
      required: true,
    },

    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    pickupCity: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    dropCity: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    goodsType: String,

    weight: Number,

    price: {
      type: Number,
      required: true,
    },

    pickupDate: Date,

    isReturnTrip: {
      type: Boolean,
      default: false,
    },

    // 🔥 UPDATED STATUS FLOW
    status: {
      type: String,
      enum: [
        "pending",     // created by company
        "accepted",    // owner accepted
        "rejected",
        "assigned",    // driver assigned
        "en_route",    // driver going to pickup
        "picked_up",   // goods picked
        "in_transit",  // on the way
        "delivered",   // completed
        "cancelled",
      ],
      default: "pending",
    },

    // 🕒 TIMESTAMPS (IMPORTANT)
    assignedAt: Date,
    enRouteAt: Date,
    pickedUpAt: Date,
    inTransitAt: Date,
    deliveredAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);