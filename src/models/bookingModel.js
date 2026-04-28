const mongoose = require("mongoose");

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
      type: String,
      required: true,
      lowercase: true,
    },

    dropCity: {
      type: String,
      required: true,
      lowercase: true,
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