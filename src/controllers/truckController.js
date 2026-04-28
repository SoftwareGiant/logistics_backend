const Truck = require("../models/truckModel");

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

    const trucks = await Truck.find({
      $or: [
        { "usualRoute.from": pickup, "usualRoute.to": drop },
        { "usualRoute.from": drop, "usualRoute.to": pickup },
      ],
    }).lean();

    let returnTrucks = [];
    let newTripTrucks = [];

    trucks.forEach((t) => {
      const isNewTrip =
        t.usualRoute.from === pickup &&
        t.usualRoute.to === drop &&
        t.currentLocation === pickup &&
        t.availability === "available";

      const isReturn =
        t.usualRoute.from === drop &&
        t.usualRoute.to === pickup;

      const isReadyForReturn =
        isReturn &&
        t.currentLocation === pickup &&
        t.availability === "available";

      const isRunningReturn =
        isReturn &&
        t.availability === "busy";

      // 🔥 COMMON DATA
      const formatted = {
        _id: t._id,
        truckNumber: t.truckNumber,
        capacity: t.capacity,
        type: t.type,
        from: t.usualRoute.from,
        to: t.usualRoute.to,
        currentLocation: t.currentLocation,

        price: isReturn
          ? t.pricing.returnPrice
          : t.pricing.normalPrice,

        isReadyForReturn,
        isRunningReturn,
      };

      // 🔥 GROUPING
      if (isReturn) {
        returnTrucks.push(formatted);
      }

      if (isNewTrip) {
        newTripTrucks.push(formatted);
      }
    });

    // 🔥 SORTING
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