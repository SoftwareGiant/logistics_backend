const Offer = require("../models/offerModel");
const Requirement = require("../models/requirementModel");
const Truck = require("../models/truckModel");

// 🚛 Owner → See matching requirements
exports.getMatchingRequirements = async (req, res) => {
  try {
    const trucks = await Truck.find({ ownerId: req.user._id });

    const routes = trucks.map(t => ({
      pickupCity: t.usualRoute.from,
      dropCity: t.usualRoute.to,
    }));

    const requirements = await Requirement.find({
      status: "active",
      $or: routes,
    });

    res.json({ requirements });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 💰 Owner → Send Offer
const Booking = require("../models/bookingModel");

exports.createOffer = async (req, res) => {
  try {
    const { requirementId, truckId, driverId } = req.body;

    const requirement = await Requirement.findById(requirementId);

    if (!requirement) {
      return res.status(404).json({ message: "Requirement not found" });
    }

    const date = new Date(requirement.preferredDate);

    // 🔥 SAME DAY RANGE
    const start = new Date(date.setHours(0, 0, 0, 0));
    const end = new Date(date.setHours(23, 59, 59, 999));

    // ================= TRUCK CHECK =================
    const truckBooked = await Booking.findOne({
      truckId,
      pickupDate: { $gte: start, $lte: end },
      status: { $in: ["assigned", "en_route", "picked_up", "in_transit"] },
    });

    if (truckBooked) {
      return res.status(400).json({
        message: "Truck already booked for this date",
      });
    }

    // ================= DRIVER CHECK =================
    if (driverId) {
      const driverBooked = await Booking.findOne({
        driverId,
        pickupDate: { $gte: start, $lte: end },
        status: { $in: ["assigned", "en_route", "picked_up", "in_transit"] },
      });

      if (driverBooked) {
        return res.status(400).json({
          message: "Driver already booked for this date",
        });
      }
    }

    // ================= DUPLICATE OFFER =================
    const exists = await Offer.findOne({
      requirementId,
      truckOwnerId: req.user._id,
      truckId,
    });

    if (exists) {
      return res.status(400).json({ message: "Already offered" });
    }

    // ================= CREATE =================
    const offer = await Offer.create({
      requirementId,
      truckId,
      driverId,
      truckOwnerId: req.user._id,
    });

    res.json({
      message: "Offer sent",
      offer,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📦 Company → View offers (AUTO PRICE)
exports.getRequirementOffers = async (req, res) => {
  try {
    const { requirementId } = req.params;

    const requirement = await Requirement.findById(requirementId);

    const offers = await Offer.find({ requirementId })
      .populate("truckId")
      .populate("driverId", "name phone");

    const data = offers.map(o => {
      const t = o.truckId;

      const isReturn =
        t.usualRoute.from === requirement.dropCity &&
        t.usualRoute.to === requirement.pickupCity;

      const price = isReturn
        ? t.pricing.returnPrice
        : t.pricing.normalPrice;

      return {
        _id: o._id,
        truckNumber: t.truckNumber,
        driver: o.driverId,
        isReturn,
        price,
      };
    });

    res.json({ offers: data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};