const Offer = require("../models/offerModel");
const Requirement = require("../models/requirementModel");
const Truck = require("../models/truckModel");

// 🚛 Owner → See matching requirements
exports.getMatchingRequirements = async (req, res) => {
  try {
    const trucks = await Truck.find({ ownerId: req.user._id });

    // 1. Usual Route matches
    const usualRoutes = trucks.map(t => ({
      "pickupCity.city": t.usualRoute.from,
      "dropCity.city": t.usualRoute.to,
    }));

    // 2. Current Location matches (Return Trip)
    // If a truck is available at its drop location, it's looking for a load back to its base
    const returnRoutes = trucks
      .filter(t => t.availability === "available" && t.currentLocation)
      .map(t => ({
        "pickupCity.city": t.currentLocation.toLowerCase(),
        "dropCity.city": t.usualRoute.from.toLowerCase(),
      }));

    const requirements = await Requirement.find({
      status: "active",
      $or: [...usualRoutes, ...returnRoutes],
    }).populate("companyId", "name phone");

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

// 💰 Owner → View My Offers
exports.getMyOffers = async (req, res) => {
  try {
    const offers = await Offer.find({ truckOwnerId: req.user._id })
      .populate("requirementId")
      .populate("truckId")
      .sort({ createdAt: -1 });

    res.json({ offers });
  } catch (err) {
    res.status(500).json({ message: err.message });
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
        t.usualRoute.from === requirement.dropCity.city &&
        t.usualRoute.to === requirement.pickupCity.city;

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

// 🤝 Company → Accept Offer
const mongoose = require("mongoose");

exports.acceptOffer = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { offerId } = req.params;

    const offer = await Offer.findById(offerId)
      .populate("truckId")
      .populate("requirementId");

    if (!offer) {
      console.log("[ACCEPT_OFFER] Offer not found:", offerId);
      return res.status(404).json({ message: "Offer not found" });
    }

    const requirement = offer.requirementId;

    if (!requirement) {
       console.log("[ACCEPT_OFFER] Requirement not found for offer:", offerId);
       return res.status(404).json({ message: "Associated requirement not found" });
    }

    console.log(`[ACCEPT_OFFER] Company ${req.user._id} attempting to accept offer ${offerId} for requirement ${requirement._id}`);

    if (requirement.companyId.toString() !== req.user._id.toString()) {
      console.log(`[ACCEPT_OFFER] Auth mismatch: req.companyId(${requirement.companyId}) !== user.id(${req.user._id})`);
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (requirement.status !== "active") {
      console.log(`[ACCEPT_OFFER] Requirement not active. Status: ${requirement.status}`);
      return res.status(400).json({ message: "Requirement already fulfilled or inactive" });
    }

    const t = offer.truckId;
    const isReturn =
      t.usualRoute.from === requirement.dropCity.city &&
      t.usualRoute.to === requirement.pickupCity.city;
    const price = isReturn ? t.pricing.returnPrice : t.pricing.normalPrice;

    // 1. Create Booking
    const [booking] = await Booking.create(
      [
        {
          companyId: req.user._id,
          truckId: t._id,
          driverId: offer.driverId,
          pickupCity: requirement.pickupCity,
          dropCity: requirement.dropCity,
          goodsType: requirement.goodsType,
          weight: requirement.weight,
          pickupDate: requirement.preferredDate,
          price,
          isReturnTrip: isReturn,
          status: "assigned", 
        },
      ],
      { session }
    );

    // 2. Update Offer Status
    offer.status = "accepted";
    await offer.save({ session });

    // 3. Update Requirement Status
    requirement.status = "fulfilled";
    await requirement.save({ session });

    // 4. Reject other offers
    await Offer.updateMany(
      { requirementId: requirement._id, _id: { $ne: offerId } },
      { status: "rejected" },
      { session }
    );

    // 5. Mark truck as busy
    if (t.type === "Open Body") t.type = "open";
    t.availability = "busy";
    await t.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.json({ message: "Offer accepted and booking created", booking });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: error.message });
  }
};