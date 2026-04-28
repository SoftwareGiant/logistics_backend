const mongoose = require("mongoose");
const Booking = require("../models/bookingModel");
const Truck = require("../models/truckModel");
const User = require("../models/userModel");

// ================= CREATE BOOKING =================
exports.createBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      truckId,
      pickupCity,
      dropCity,
      goodsType,
      weight,
      pickupDate,
    } = req.body;

   let companyId;

if (req.user.role === "company") {
  companyId = req.user._id;
} else if (req.user.role === "company_staff") {
  companyId = req.user.companyId;
}
    if (!truckId || !pickupCity || !dropCity) {
      throw new Error("Required fields missing");
    }

    // normalize
    const pickup = pickupCity.toLowerCase().trim();
    const drop = dropCity.toLowerCase().trim();

    // 🔍 find truck
    const truck = await Truck.findById(truckId).session(session);

    if (!truck) throw new Error("Truck not found");

    if (truck.availability !== "available") {
      throw new Error("Truck not available");
    }

    // 🔥 detect return trip
    const isReturn =
      truck.usualRoute.from === drop &&
      truck.usualRoute.to === pickup;

    // 💰 pricing (backend trusted)
    const price = isReturn
      ? truck.pricing.returnPrice
      : truck.pricing.normalPrice;

    // 👨‍✈️ find driver (optional)
    const driver = await User.findOne({
      assignedTruckId: truck._id,
      role: "driver",
    }).session(session);

    // 📦 create booking
    const [booking] = await Booking.create(
      [
        {
          companyId,
          truckId: truck._id,
          driverId: driver?._id,

          pickupCity: pickup,
          dropCity: drop,

          goodsType,
          weight,
          pickupDate,

          price,
          isReturnTrip: isReturn,
        },
      ],
      { session }
    );

    // 🚛 mark truck busy
    truck.availability = "busy";
    await truck.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message: "Booking created successfully",
      booking,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    res.status(400).json({
      message: error.message,
    });
  }
};


exports.updateBookingByOwner = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { action } = req.body; // accept | reject

    const ownerId = req.user._id;

    const booking = await Booking.findById(bookingId).populate("truckId");

    if (!booking) throw new Error("Booking not found");

    // 🔐 ensure owner owns this truck
    if (booking.truckId.ownerId.toString() !== ownerId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (booking.status !== "pending") {
      throw new Error("Booking already processed");
    }

    if (action === "accept") {
      booking.status = "accepted";

      // 🚛 mark truck busy
      await Truck.findByIdAndUpdate(booking.truckId._id, {
        availability: "busy",
      });

    } else if (action === "reject") {
      booking.status = "rejected";
    } else {
      throw new Error("Invalid action");
    }

    await booking.save();

    res.json({
      message: `Booking ${action}ed successfully`,
      booking,
    });

  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};


exports.updateBookingByDriver = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;

    const driverId = req.user._id;

    const booking = await Booking.findById(bookingId);

    if (!booking) throw new Error("Booking not found");

    // 🔐 check driver assigned
    if (booking.driverId?.toString() !== driverId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // 🔥 allowed transitions
    const allowed = ["in_transit", "delivered"];

    if (!allowed.includes(status)) {
      throw new Error("Invalid status update");
    }

    booking.status = status;
    await booking.save();

    // 🔓 if delivered → free truck
    if (status === "delivered") {
      await Truck.findByIdAndUpdate(booking.truckId, {
        availability: "available",
        currentLocation: booking.dropCity,
      });
    }

    res.json({
      message: "Status updated",
      booking,
    });

  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};


exports.getCompanyBookings = async (req, res) => {
  try {
    let companyId;

    if (req.user.role === "company") {
      companyId = req.user._id;
    } else if (req.user.role === "company_staff") {
      companyId = req.user.companyId;
    } else {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const bookings = await Booking.find({ companyId })
      .populate("truckId")
      .populate("driverId", "name phone");

    res.json({
      total: bookings.length,
      bookings,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


exports.getOwnerBookings = async (req, res) => {
  try {
    const ownerId = req.user._id;

    const bookings = await Booking.find()
      .populate({
        path: "truckId",
        match: { ownerId: ownerId },
      })
      .populate("companyId", "name email")
      .populate("driverId", "name phone");

    // 🔥 filter null trucks
    const filtered = bookings.filter(b => b.truckId !== null);

    res.json({
      total: filtered.length,
      bookings: filtered,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.getDriverBookings = async (req, res) => {
  try {
    const driverId = req.user._id;

    const bookings = await Booking.find({ driverId })
      .populate("truckId")
      .populate("companyId", "name phone");

    res.json({
      total: bookings.length,
      bookings,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};