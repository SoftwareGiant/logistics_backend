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

status: {
    type: String, 
  enum: [
    "pending",     // company created
    "accepted",    // owner accepted
    "rejected",    // owner rejected
    "in_transit",  // driver started
    "delivered",   // completed
    "cancelled"
  ],
  default: "pending" 
},
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);