const Booking = require("../models/bookingModel");
const Truck = require("../models/truckModel");
const User = require("../models/userModel");

exports.getOwnerDashboardStats = async (req, res) => {
  try {
    const ownerId = req.user._id;

    const ownerTrucks = await Truck.find({ ownerId }).select("_id availability");
    const truckIds = ownerTrucks.map((truck) => truck._id);

    const [
      totalBookings,
      pendingBookings,
      activeBookings,
      completedBookings,
      rejectedBookings,
    ] = await Promise.all([
      Booking.countDocuments({ truckId: { $in: truckIds } }),
      Booking.countDocuments({
        truckId: { $in: truckIds },
        status: "pending",
      }),
      Booking.countDocuments({
        truckId: { $in: truckIds },
        status: { $in: ["assigned", "en_route", "picked_up", "in_transit"] },
      }),
      Booking.countDocuments({
        truckId: { $in: truckIds },
        status: "delivered",
      }),
      Booking.countDocuments({
        truckId: { $in: truckIds },
        status: { $in: ["rejected", "cancelled"] },
      }),
    ]);

    const availableTrucks = ownerTrucks.filter(
      (truck) => truck.availability === "available"
    ).length;

    res.json({
      totalTrucks: ownerTrucks.length,
      availableTrucks,
      busyTrucks: ownerTrucks.length - availableTrucks,
      totalBookings,
      pendingBookings,
      activeBookings,
      completedBookings,
      rejectedBookings,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};



exports.getAvailableTruckDriverPairs = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { date } = req.query;

    const d = date ? new Date(date) : new Date();
    const start = new Date(d.setHours(0, 0, 0, 0));
    const end = new Date(d.setHours(23, 59, 59, 999));

    // ================= GET DATA =================
    const trucks = await Truck.find({ ownerId }).lean();
    const drivers = await User.find({
      truckOwnerId: ownerId,
      role: "driver",
    }).lean();

    const truckIds = trucks.map((t) => t._id);
    const driverIds = drivers.map((d) => d._id);

    // ================= BOOKINGS =================
    const bookings = await Booking.find({
      pickupDate: { $gte: start, $lte: end },
      status: {
        $in: ["assigned", "en_route", "picked_up", "in_transit"],
      },
      $or: [
        { truckId: { $in: truckIds } },
        { driverId: { $in: driverIds } },
      ],
    }).lean();

    const bookedTruckIds = new Set();
    const bookedDriverIds = new Set();

    bookings.forEach((b) => {
      if (b.truckId) bookedTruckIds.add(b.truckId.toString());
      if (b.driverId) bookedDriverIds.add(b.driverId.toString());
    });

    // ================= MAP DRIVER BY TRUCK =================
    const driverMap = {};
    drivers.forEach((d) => {
      if (d.assignedTruckId) {
        driverMap[d.assignedTruckId.toString()] = d;
      }
    });

    // ================= FINAL FILTER =================
    const availablePairs = trucks
      .filter((t) => {
        const truckIdStr = t._id.toString();
        const isTruckFree = !bookedTruckIds.has(truckIdStr);
        const driver = driverMap[truckIdStr];
        const isDriverFree =
          driver && !bookedDriverIds.has(driver._id.toString());

        // 🔥 allow both:
        // ✔ new trip (available)
        // ✔ return trip (busy but running)
        const status = t.availability || "available";
        const isEligible = status === "available" || status === "busy";

        return isTruckFree && isDriverFree && isEligible;
      })
      .map((t) => {
        const driver = driverMap[t._id.toString()];
        const currentCity = t.currentLocation?.city;

        const isReturn =
          t.availability === "busy" &&
          currentCity !== t.usualRoute?.from;

        return {
          _id: t._id,
          label: `${t.truckNumber} • ${driver?.name || "No Driver"} • ${
            isReturn ? "Return" : "New"
          }`,
          truck: {
            _id: t._id,
            truckNumber: t.truckNumber,
            type: t.type,
            capacity: t.capacity,
            route: t.usualRoute,
            currentLocation: currentCity,
          },
          driver: driver
            ? {
                _id: driver._id,
                name: driver.name,
                phone: driver.phone,
              }
            : null,
          tripType: isReturn ? "return" : "new",
        };
      });

    res.json({
      success: true,
      date,
      total: availablePairs.length,
      pairs: availablePairs,
    });

  } catch (error) {
    console.error("[ERROR] getAvailableTruckDriverPairs:", error);
    res.status(500).json({
      message: error.message,
    });
  }
};