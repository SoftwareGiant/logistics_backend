const Truck = require("../models/truckModel");
const Booking = require("../models/bookingModel");

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

    let returnTrucks = [];
    let newTripTrucks = [];

    trucks.forEach((t) => {
      // ❌ skip unapproved owners
      if (t.ownerId?.verificationStatus !== "approved") return;

      const currentCity = t.currentLocation?.city;

      const isNewTrip =
        t.usualRoute.from === pickup &&
        t.usualRoute.to === drop &&
        currentCity === pickup &&
        t.availability === "available";

      const isReturn =
        t.usualRoute.from === drop &&
        t.usualRoute.to === pickup;

      const isReadyForReturn =
        isReturn &&
        currentCity === pickup &&
        t.availability === "available";

      const isRunningReturn =
        isReturn &&
        t.availability === "busy";

      if (!isReturn && !isNewTrip) return;

      const formatted = {
        _id: t._id,
        truckNumber: t.truckNumber,
        capacity: t.capacity,
        type: t.type,

        from: t.usualRoute.from,
        to: t.usualRoute.to,
        currentLocation: currentCity,

        price: isReturn
          ? t.pricing.returnPrice
          : t.pricing.normalPrice,

        isReturn,
        isNewTrip,
        isReadyForReturn,
        isRunningReturn,
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


exports.getOwnerFleet = async (req, res) => {
  try {
    const ownerId = req.user._id;

    // 🔥 get all trucks of owner
    const trucks = await Truck.find({ ownerId }).lean();

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

        currentLocation: t.currentLocation,

        status,
        destination,

        availability: t.availability,
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