const mongoose = require("mongoose");
const Booking = require("../models/bookingModel");
const Truck = require("../models/truckModel");
const User = require("../models/userModel");
const Requirement = require("../models/requirementModel");

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

    if (!companyId) {
      throw new Error(`Unauthorized role for creating bookings: ${req.user.role}`);
    }

    if (!truckId || !pickupCity || !dropCity) {
      throw new Error("Required fields missing");
    }

    // normalize helper
    const normalizeLoc = (loc) => {
      if (typeof loc === "string") {
        return {
          city: loc.toLowerCase().trim(),
          address: loc,
          coordinates: { coordinates: [0, 0] },
        };
      }
      return loc;
    };

    const pickup = normalizeLoc(pickupCity);
    const drop = normalizeLoc(dropCity);

    // 🔍 find truck
    const truck = await Truck.findById(truckId).session(session);

    if (!truck) throw new Error("Truck not found");

    if (truck.availability !== "available") {
      throw new Error("Truck not available");
    }

    // 🔥 detect return trip
    const isReturn =
      truck.usualRoute.from === drop.city &&
      truck.usualRoute.to === pickup.city;

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

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // 🔐 ownership check
    if (booking.truckId.ownerId.toString() !== ownerId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (booking.status !== "pending") {
      return res.status(400).json({ message: "Booking already processed" });
    }

    // ================= ACCEPT =================
    if (action === "accept") {

      // 🔥 find available driver for this truck
      const driver = await User.findOne({
        assignedTruckId: booking.truckId._id,
        role: "driver",
      });

      if (!driver) {
        return res.status(400).json({
          message: "No driver assigned to this truck",
        });
      }

      // 🔥 assign driver + update status
      booking.driverId = driver._id;
      booking.status = "assigned";
      booking.assignedAt = new Date();

    }

    // ================= REJECT =================
    else if (action === "reject") {
      booking.status = "rejected";
    }

    else {
      return res.status(400).json({ message: "Invalid action" });
    }

    await booking.save();

    res.json({
      message: `Booking ${action}ed successfully`,
      booking,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


exports.updateBookingByDriver = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;

    const driverId = req.user._id;

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // 🔐 driver check
    if (!booking.driverId || booking.driverId.toString() !== driverId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // 🔥 FULL STATUS FLOW
    const validFlow = {
      assigned: ["en_route"],
      en_route: ["picked_up"],
      picked_up: ["in_transit"],
      in_transit: ["delivered"],
    };

    // ❌ invalid transition
    if (!validFlow[booking.status]?.includes(status)) {
      return res.status(400).json({
        message: `Invalid status transition from ${booking.status} → ${status}`,
      });
    }

    // 🔄 update status
    booking.status = status;

    // 🔥 Normalize legacy data if it exists
    const normalize = (loc) => {
      if (typeof loc === "string") {
        if (loc.startsWith("{")) {
          try { return JSON.parse(loc); } catch (e) { return loc; }
        }
      }
      return loc;
    };
    booking.pickupCity = normalize(booking.pickupCity);
    booking.dropCity = normalize(booking.dropCity);

    // 🕒 timestamps
    if (status === "en_route") {
      booking.enRouteAt = new Date();
    }

    if (status === "picked_up") {
      booking.pickedUpAt = new Date();

      // 🚛 truck becomes busy
      await Truck.findByIdAndUpdate(booking.truckId, {
        availability: "busy",
      });
    }

    if (status === "in_transit") {
      booking.inTransitAt = new Date();
    }

    if (status === "delivered") {
      booking.deliveredAt = new Date();

      // 🚛 truck free + update location
      const truck = await Truck.findById(booking.truckId);
      const updateData = {
        availability: "available",
      };

      if (truck && truck.pendingLocation && truck.pendingLocation.city) {
        updateData.currentLocation = {
          city: truck.pendingLocation.city,
          coordinates: truck.pendingLocation.coordinates || [0, 0]
        };
        updateData.pendingLocation = null;
      } else {
        updateData.currentLocation = {
          city: booking.dropCity,
        };
      }

      await Truck.findByIdAndUpdate(booking.truckId, updateData);
    }

    await booking.save();

    res.json({
      message: "Status updated successfully",
      booking,
    });

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
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




exports.getDriverCurrentTrip = async (req, res) => {
  try {
    const driverId = req.user._id;

    // 🔥 CURRENT TRIP (running)
    const currentTrip = await Booking.findOne({
      driverId,
      status: {
        $in: ["en_route", "picked_up", "in_transit"],
      },
    })
      .sort({ updatedAt: -1 })
      .populate("truckId")
      .populate("companyId", "name phone");

    // 🔥 NEXT TRIP (assigned but not started)
    const nextTrip = await Booking.findOne({
      driverId,
      status: "assigned",
    })
      .sort({ createdAt: 1 })
      .populate("truckId")
      .populate("companyId", "name phone");

    res.json({
      currentTrip: currentTrip || null,
      nextTrip: nextTrip || null,
    });

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};


exports.getDriverTripHistory = async (req, res) => {
  try {
    const driverId = req.user._id;

    let { page = 1, limit = 10, sort = "latest" } = req.query;

    page = Number(page);
    limit = Number(limit);

    // 🔥 only past trips
    const query = {
      driverId,
      status: {
        $in: ["delivered", "cancelled"],
      },
    };

    // 🔄 sorting
    let sortOption = { createdAt: -1 };
    if (sort === "oldest") {
      sortOption = { createdAt: 1 };
    }

    const total = await Booking.countDocuments(query);

    const bookings = await Booking.find(query)
      .populate("truckId")
      .populate("companyId", "name phone")
      .sort(sortOption)
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      total,
      page,
      pages: Math.ceil(total / limit),
      bookings,
    });

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
exports.getReturnTripMatches = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const driverId = req.user._id;

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // ?? driver check
    if (!booking.driverId || booking.driverId.toString() !== driverId.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Swapping locations for return trip
    const returnPickup = booking.dropCity.toLowerCase().trim();
    const returnDrop = booking.pickupCity.toLowerCase().trim();

    // Find active requirements that match the return route
    const requirements = await Requirement.find({
      status: 'active',
      'pickupCity.city': returnPickup,
      'dropCity.city': returnDrop,
    }).populate('companyId', 'name phone');

    res.json({
      returnPickup,
      returnDrop,
      matches: requirements,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

exports.selectReturnTrip = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const driverId = req.user._id;

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // ?? driver check
    if (!booking.driverId || booking.driverId.toString() !== driverId.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (booking.status !== 'delivered') {
      return res.status(400).json({ message: 'Trip must be delivered first' });
    }

    // Update truck state
    await Truck.findByIdAndUpdate(booking.truckId, {
      isReturnTripReady: true,
      currentLocation: {
        city: booking.dropCity,
      }
    });

    res.json({
      message: 'Return trip signaled. Locations interchanged for companies.',
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
