const Truck = require("../models/truckModel");
const Booking = require("../models/bookingModel");
const User = require("../models/userModel");

// The truck owner keeps a truck's live location fresh.
// Body: { truckId, coordinates: [lng, lat], city? }
exports.updateTruckLocation = async (req, res) => {
  try {
    const { truckId, coordinates, city } = req.body;

    if (!truckId || !Array.isArray(coordinates) || coordinates.length !== 2) {
      return res.status(400).json({ message: "truckId and coordinates [lng, lat] are required" });
    }

    const truck = await Truck.findById(truckId);
    if (!truck) {
      return res.status(404).json({ message: "Truck not found" });
    }
    if (truck.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    truck.currentLocation = {
      ...(truck.currentLocation ? truck.currentLocation.toObject?.() || truck.currentLocation : {}),
      coordinates: [Number(coordinates[0]), Number(coordinates[1])],
      city: city ? city.toLowerCase() : truck.currentLocation?.city,
      updatedAt: new Date(),
    };
    await truck.save();

    res.json({ message: "Location updated", currentLocation: truck.currentLocation });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


exports.getOwnerFleet = async (req, res) => {
  try {
    const ownerId = req.user._id;

    // 🔥 get all trucks of owner
    const trucks = await Truck.find({ ownerId }).lean();

    // 🔥 get drivers of this owner
    const drivers = await User.find({ truckOwnerId: ownerId, role: "driver" }).lean();
    const driverMap = {};
    drivers.forEach(d => {
      if (d.assignedTruckId) {
        driverMap[d.assignedTruckId.toString()] = d;
      }
    });

    // 🔥 get active bookings for those trucks
    const truckIds = trucks.map((t) => t._id);

    const activeBookings = await Booking.find({
      truckId: { $in: truckIds },
      status: {
        $in: ["assigned", "en_route", "picked_up", "in_transit"],
      },
    }).lean();

    // 🔥 map bookings by truckId
    const bookingMap = {};
    activeBookings.forEach((b) => {
      bookingMap[b.truckId.toString()] = b;
    });

    // 🔥 prepare response
    const fleet = trucks.map((t) => {
      const booking = bookingMap[t._id.toString()];
      const driver = driverMap[t._id.toString()];

      let status = "Available";
      let destination = null;

      if (booking) {
        if (booking.status === "assigned") {
          status = "Loading";
        } else if (
          ["en_route", "picked_up", "in_transit"].includes(booking.status)
        ) {
          status = "In Transit";
        }

        destination = booking.dropCity;
      }

      return {
        _id: t._id,
        truckNumber: t.truckNumber,
        capacity: t.capacity,
        type: t.type,
        usualRoute: t.usualRoute,
        verified: !!t.verified,

        currentLocation: t.currentLocation,
        baseLocation: t.baseLocation,
        pendingLocation: t.pendingLocation,

        status,
        destination,

        availability: t.availability,
        driver: driver ? { name: driver.name, phone: driver.phone } : null,
        images: t.images || [],
      };
    });

    res.json({
      total: fleet.length,
      fleet,
    });

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// ================= CHECK TRUCK EXISTS =================
exports.checkTruckExists = async (req, res) => {
  try {
    const { truckNumber } = req.params;
    if (!truckNumber) {
      return res.status(400).json({ message: "Truck number parameter is required" });
    }

    const truck = await Truck.findOne({ truckNumber: truckNumber.toUpperCase().trim() });
    
    return res.json({
      exists: !!truck,
      message: truck ? "Truck number already exists" : "Truck number is available"
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};