const Booking = require("../models/bookingModel");
const Truck = require("../models/truckModel");

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
