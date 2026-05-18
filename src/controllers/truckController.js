const Truck = require("../models/truckModel");
const Booking = require("../models/bookingModel");
const User = require("../models/userModel");

// ================= SEARCH TRUCKS =================
exports.searchTrucks = async (req, res) => {
  try {
    let { pickup, drop } = req.query;

    if (!pickup || !drop) {
      return res.status(400).json({
        message: "pickup and drop required",
      });
    }

    pickup = pickup.toLowerCase().trim();
    drop = drop.toLowerCase().trim();

    // 🔥 populate owner
    const trucks = await Truck.find({
      $or: [
        { "usualRoute.from": pickup, "usualRoute.to": drop },
        { "usualRoute.from": drop, "usualRoute.to": pickup },
      ],
    })
      .populate({
        path: "ownerId",
        select: "verificationStatus",
      })
      .lean();

    const truckIds = trucks.map((t) => t._id);

    const activeBookings = await Booking.find({
      truckId: { $in: truckIds },
      status: {
        $in: ["assigned", "en_route", "picked_up", "in_transit"],
      },
    }).lean();

    const bookingMap = {};
    activeBookings.forEach((b) => {
      bookingMap[b.truckId.toString()] = b;
    });

    let returnTrucks = [];
    let newTripTrucks = [];

    trucks.forEach((t) => {
      // ❌ skip unapproved owners
      if (t.ownerId?.verificationStatus !== "approved") return;

      const currentCity = t.currentLocation?.city;
      const activeBooking = bookingMap[t._id.toString()];
      const hasActiveBooking = Boolean(activeBooking);
      const activeBookingIsNewTrip =
        activeBooking &&
        activeBooking.pickupCity === t.usualRoute.from &&
        activeBooking.dropCity === t.usualRoute.to;

      const isNewTrip =
        t.usualRoute.from === pickup &&
        t.usualRoute.to === drop &&
        currentCity === pickup &&
        t.availability === "available" &&
        !hasActiveBooking;

      const isReverseRoute =
        t.usualRoute.from === drop &&
        t.usualRoute.to === pickup;

      const isTruckAtPickup =
        currentCity === pickup &&
        t.availability === "available";

      const isReturn =
        (isReverseRoute && (isTruckAtPickup || activeBookingIsNewTrip)) ||
        (t.isReturnTripReady && isTruckAtPickup && t.usualRoute.from === drop);

      const isReadyForReturn = isReturn && isTruckAtPickup;
      const isRunningReturn = isReturn && activeBookingIsNewTrip;

      if (!isReturn && !isNewTrip) return;

      const formatted = {
        _id: t._id,
        truckNumber: t.truckNumber,
        capacity: t.capacity,
        type: t.type,

        from: t.usualRoute.from,
        to: t.usualRoute.to,
        averageTime: t.usualRoute.averageTime,
        currentLocation: currentCity,

        price: isReturn
          ? t.pricing.returnPrice
          : t.pricing.normalPrice,

        isReturn,
        isNewTrip,
        isReadyForReturn,
        isRunningReturn,
        images: t.images || [],
      };

      if (isReturn) returnTrucks.push(formatted);
      if (isNewTrip) newTripTrucks.push(formatted);
    });

    returnTrucks.sort((a, b) => a.price - b.price);
    newTripTrucks.sort((a, b) => a.price - b.price);

    res.json({
      returnTrucks,
      newTripTrucks,
    });

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

exports.updateTruckLocation = async (req, res) => {
  try {
    const { coordinates, city } = req.body; // coordinates: [lng, lat]
    const driver = await User.findById(req.user._id);

    if (!driver || !driver.assignedTruckId) {
      return res.status(400).json({
        message: "No truck assigned to this driver",
      });
    }

    const updateData = {
      "currentLocation.coordinates": coordinates,
    };

    if (city) {
      updateData["currentLocation.city"] = city.toLowerCase();
    }

    const truck = await Truck.findByIdAndUpdate(
      driver.assignedTruckId,
      updateData,
      { new: true }
    );

    res.json({
      message: "Location updated",
      currentLocation: truck.currentLocation,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
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

        currentLocation: t.currentLocation,

        status,
        destination,

        availability: t.availability,
        driver: driver ? { name: driver.name, phone: driver.phone } : null,
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