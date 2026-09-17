const Requirement = require("../models/requirementModel");
const Booking = require("../models/bookingModel");
const Truck = require("../models/truckModel");
const {
  findMatchingTrucks,
  findMatchingRequirementsForOwner,
  isRequirementLive,
} = require("../services/matching");
const { computeOwnerPayout } = require("../services/pricing");
const { sendPushToUsers } = require("../services/pushNotify");

const MATCH_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

// Pings every owner with a matching truck the moment a requirement goes live —
// both a live socket event (while their dashboard is open) and a real OS push
// notification (reaches them even if the site isn't open at all).
function notifyMatchingOwners(io, requirement, matches) {
  if (!matches.length) return;
  const ownerIds = [...new Set(matches.map((t) => String(t.ownerId)))];
  const pickup = requirement.pickupCity?.address || requirement.pickupCity?.city || "pickup";
  const drop = requirement.dropCity?.address || requirement.dropCity?.city || "drop";
  const budget = Number(requirement.budget || 0).toLocaleString("en-IN");
  const payload = {
    title: "New load nearby 🚛",
    body: `${pickup} → ${drop} · ₹${budget} · ${requirement.truckType}`,
    url: "/dashboard/truck-owner",
    ring: true,
  };
  if (io) {
    for (const ownerId of ownerIds) {
      io.to(`user:${ownerId}`).emit("notification", payload);
    }
  }
  sendPushToUsers(ownerIds, payload).catch((err) => console.error("Push notify failed:", err.message));
}

function withExpiry(requirement) {
  const obj = requirement.toObject ? requirement.toObject() : { ...requirement };
  const expired =
    obj.status === "expired" ||
    (obj.status === "active" &&
      obj.expiresAt &&
      new Date(obj.expiresAt).getTime() < Date.now());
  obj.isExpired = expired;
  obj.expiresInMs = obj.expiresAt
    ? Math.max(0, new Date(obj.expiresAt).getTime() - Date.now())
    : 0;
  return obj;
}

// Attaches the resulting booking (truck) to a fulfilled requirement.
async function attachBooking(reqObj) {
  if (reqObj.status !== "fulfilled") {
    reqObj.booking = null;
    return reqObj;
  }
  const bk = await Booking.findOne({ requirementId: reqObj._id })
    .populate("truckId", "truckNumber type capacity")
    .lean();
  reqObj.booking = bk
    ? { _id: bk._id, status: bk.status, truck: bk.truckId || null }
    : null;
  return reqObj;
}

// ➕ Add Requirement
exports.addRequirement = async (req, res) => {
  try {
    const { truckType, weight, budget } = req.body;

    if (!truckType || String(truckType).trim() === "") {
      return res.status(400).json({ message: "Truck type is required" });
    }
    if (weight === undefined || weight === null || weight === "" || Number(weight) <= 0) {
      return res.status(400).json({ message: "A valid weight (in tons) is required" });
    }
    if (budget === undefined || budget === null || budget === "" || Number(budget) <= 0) {
      return res.status(400).json({ message: "A valid offered price is required" });
    }

    const requirement = await Requirement.create({
      ...req.body,
      weight: Number(weight),
      budget: Number(budget),
      truckType: String(truckType).trim(),
      companyId: req.user._id,
      status: "active",
      expiresAt: new Date(Date.now() + MATCH_WINDOW_MS),
    });

    // No matching truck in range → don't run a 30-minute window; the company
    // should edit this requirement or post a fresh one.
    const matches = await findMatchingTrucks(requirement);
    if (matches.length === 0) {
      requirement.status = "expired";
      requirement.expiryReason = "no_match";
      await requirement.save();
    } else {
      notifyMatchingOwners(req.app.get("io"), requirement, matches);
    }

    res.status(201).json({
      requirement: withExpiry(requirement),
      matchCount: matches.length,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔎 Get one requirement (owner-company only) — repost prefill + status page
exports.getRequirementById = async (req, res) => {
  try {
    const requirement = await Requirement.findById(req.params.id);
    if (!requirement) {
      return res.status(404).json({ message: "Requirement not found" });
    }
    if (requirement.companyId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    res.json({ requirement: await attachBooking(withExpiry(requirement)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✏️ Edit an active (not yet booked) requirement — re-opens the 30-minute window
exports.updateRequirement = async (req, res) => {
  try {
    const requirement = await Requirement.findById(req.params.id);
    if (!requirement) {
      return res.status(404).json({ message: "Requirement not found" });
    }
    if (requirement.companyId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    if (requirement.status === "fulfilled") {
      return res.status(400).json({ message: "This requirement is already booked and cannot be edited" });
    }

    const editable = [
      "pickupCity", "dropCity", "goodsType", "weight", "truckType",
      "preferredDate", "preferredTime", "budget", "additionalNotes",
    ];
    for (const k of editable) {
      if (req.body[k] !== undefined) requirement[k] = req.body[k];
    }

    if (!requirement.truckType) {
      return res.status(400).json({ message: "Truck type is required" });
    }
    if (requirement.weight == null || Number(requirement.weight) <= 0) {
      return res.status(400).json({ message: "A valid weight (in tons) is required" });
    }
    if (requirement.budget == null || Number(requirement.budget) <= 0) {
      return res.status(400).json({ message: "A valid offered price is required" });
    }

    requirement.status = "active";
    requirement.expiresAt = new Date(Date.now() + MATCH_WINDOW_MS);
    requirement.expiryReason = undefined;
    await requirement.save();

    // Still no matching truck in range → keep it out of the timed flow.
    const matches = await findMatchingTrucks(requirement);
    if (matches.length === 0) {
      requirement.status = "expired";
      requirement.expiryReason = "no_match";
      await requirement.save();
    } else {
      notifyMatchingOwners(req.app.get("io"), requirement, matches);
    }

    res.json({
      requirement: withExpiry(requirement),
      matchCount: matches.length,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🚛 Owner → live requirements matching their trucks (10 km + type + capacity + verified)
exports.getAvailableRequirements = async (req, res) => {
  try {
    const requirements = await findMatchingRequirementsForOwner(req.user._id);
    res.json({ requirements });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🤝 Owner → accept a live requirement at the company's posted price.
// First-come-first-served: an atomic status flip decides the winner.
exports.acceptRequirement = async (req, res) => {
  try {
    const { id } = req.params;
    const { truckId, driverId } = req.body;

    if (!truckId) {
      return res.status(400).json({ message: "Please select a truck" });
    }

    const truck = await Truck.findOne({ _id: truckId, ownerId: req.user._id });
    if (!truck) return res.status(404).json({ message: "Truck not found" });
    if (!truck.verified) {
      return res.status(403).json({ message: "This truck is not verified yet" });
    }
    if (truck.availability !== "available") {
      return res.status(400).json({ message: "This truck is currently busy" });
    }

    const requirement = await Requirement.findById(id);
    if (!requirement) return res.status(404).json({ message: "Requirement not found" });

    if (requirement.truckType && truck.type !== requirement.truckType) {
      return res.status(400).json({ message: "Truck type does not match this load" });
    }
    if (requirement.weight != null && Number(truck.capacity) < Number(requirement.weight)) {
      return res.status(400).json({ message: "Truck capacity is below the load weight" });
    }

    // 🔒 Atomic claim — only the first accept wins
    const claimed = await Requirement.findOneAndUpdate(
      { _id: id, status: "active", expiresAt: { $gte: new Date() } },
      { status: "fulfilled" },
      { new: true }
    );
    if (!claimed) {
      return res.status(409).json({ message: "This load was just taken by another truck owner" });
    }

    try {
      const { ownerPayout, commissionPercent } = computeOwnerPayout(claimed.budget);
      const booking = await Booking.create({
        companyId: claimed.companyId,
        requirementId: claimed._id,
        truckId: truck._id,
        driverId: driverId || undefined,
        pickupCity: claimed.pickupCity,
        dropCity: claimed.dropCity,
        goodsType: claimed.goodsType,
        weight: claimed.weight,
        pickupDate: claimed.preferredDate,
        pickupTime: claimed.preferredTime,
        price: claimed.budget || 0,
        ownerPayout,
        commissionPercent,
        status: "assigned",
      });

      truck.availability = "busy";
      await truck.save();

      const bookedPayload = {
        title: "Load booked ✅",
        body: `Truck ${truck.truckNumber} accepted your requirement — booking confirmed.`,
        url: "/dashboard/company/my-booking",
        ring: true,
      };
      const io = req.app.get("io");
      if (io) {
        io.to(`user:${claimed.companyId}`).emit("notification", bookedPayload);
      }
      sendPushToUsers([claimed.companyId], bookedPayload).catch((err) =>
        console.error("Push notify failed:", err.message)
      );

      res.json({
        message: "Load accepted — booking created",
        booking,
        requirementId: claimed._id,
      });
    } catch (e) {
      // roll the claim back if the booking couldn't be created
      await Requirement.findByIdAndUpdate(id, { status: "active" });
      throw e;
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🚚 Trucks that currently match this requirement (type + capacity + 10km + verified)
exports.getMatchingTrucks = async (req, res) => {
  try {
    const requirement = await Requirement.findById(req.params.id);
    if (!requirement) {
      return res.status(404).json({ message: "Requirement not found" });
    }
    if (requirement.companyId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const trucks = await findMatchingTrucks(requirement);

    res.json({
      live: isRequirementLive(requirement),
      total: trucks.length,
      trucks: trucks.map((t) => ({
        _id: t._id,
        truckNumber: t.truckNumber,
        type: t.type,
        capacity: t.capacity,
        distanceKm: Math.round((t.distanceMeters / 1000) * 10) / 10,
        locationSource: t.locationSource,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 📋 My Requirements
exports.getMyRequirements = async (req, res) => {
  try {
    const companyId = req.user._id;

    // Lazily flip elapsed active requirements to "expired" so status stays truthful.
    await Requirement.updateMany(
      { companyId, status: "active", expiresAt: { $lt: new Date() } },
      { status: "expired", expiryReason: "timeout" }
    );

    const requirements = await Requirement.find({ companyId }).sort({ createdAt: -1 }).lean();

    const fulfilledIds = requirements.filter(r => r.status === "fulfilled").map(r => r._id);
    const bookings = fulfilledIds.length
      ? await Booking.find({ requirementId: { $in: fulfilledIds } })
          .populate("truckId", "truckNumber type capacity")
          .lean()
      : [];
    const bkMap = {};
    bookings.forEach(b => {
      if (b.requirementId) bkMap[b.requirementId.toString()] = b;
    });

    const now = Date.now();
    const data = requirements.map(r => {
      const bk = bkMap[r._id.toString()];
      return {
        ...r,
        isExpired: r.status === "expired",
        expiresInMs: r.expiresAt ? Math.max(0, new Date(r.expiresAt).getTime() - now) : 0,
        booking: bk ? { _id: bk._id, status: bk.status, truck: bk.truckId || null } : null,
      };
    });

    res.json({ requirements: data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🗑️ Delete Requirement
exports.deleteRequirement = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user._id;

    // 🔍 Find requirement
    const requirement = await Requirement.findById(id);

    if (!requirement) {
      return res.status(404).json({ message: "Requirement not found" });
    }

    // ✅ Check if requirement belongs to the company
    if (requirement.companyId.toString() !== companyId.toString()) {
      return res.status(403).json({ message: "Unauthorized to delete this requirement" });
    }

    // 🗑️ Delete requirement
    await Requirement.findByIdAndDelete(id);

    res.json({ message: "Requirement deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 📈 Popular Routes (Aggregated from requirements)
exports.getPopularRoutes = async (req, res) => {
  try {
    const popularRoutes = await Requirement.aggregate([
      {
        $group: {
          _id: {
            from: "$pickupCity.city",
            to: "$dropCity.city"
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    const formattedRoutes = popularRoutes
      .filter(r => r._id.from && r._id.to)
      .map(r => ({
        from: r._id.from,
        to: r._id.to,
        count: r.count
      }));

    res.json({ routes: formattedRoutes });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
