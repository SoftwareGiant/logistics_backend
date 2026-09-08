const Booking = require("../models/bookingModel");
const Truck = require("../models/truckModel");

// The company now sets the price itself (requirement budget), so there is no
// platform markup — the amount the company sees is the amount they agreed to.
const getCompanyPrice = (actualPrice) => {
  const price = Number(actualPrice);
  return Number.isNaN(price) ? 0 : price;
};

const extractCityName = (loc) => {
  if (!loc) return "unknown";
  if (typeof loc === "object" && loc.city) return loc.city;
  if (typeof loc === "string") {
    if (loc.startsWith("{")) {
      const match = loc.match(/city:\s*['"]([^'"]+)['"]/);
      if (match) return match[1];
    }
    return loc;
  }
  return "unknown";
};

// ================= OWNER DRIVES THE TRIP =================
// A booking only exists once a truck owner has accepted a requirement
// (requirementController.acceptRequirement), so it always arrives here as "assigned".
// The owner then advances the trip status.
// action: "status", status: "en_route" | "picked_up" | "in_transit" | "delivered"
exports.updateBookingByOwner = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { action, status } = req.body;

    const ownerId = req.user._id;

    const booking = await Booking.findById(bookingId).populate("truckId");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (!booking.truckId || booking.truckId.ownerId.toString() !== ownerId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const io = req.app.get("io");

    // ─── ADVANCE TRIP STATUS ──────────────────────────────────────────────────
    if (action === "status") {
      const validFlow = {
        assigned: ["en_route"],
        en_route: ["picked_up"],
        picked_up: ["in_transit"],
        in_transit: ["delivered"],
      };

      if (!validFlow[booking.status]?.includes(status)) {
        return res.status(400).json({
          message: `Invalid status transition from ${booking.status} → ${status}`,
        });
      }

      booking.status = status;

      if (status === "en_route") booking.enRouteAt = new Date();

      if (status === "picked_up") {
        booking.pickedUpAt = new Date();
        await Truck.findByIdAndUpdate(booking.truckId._id, { availability: "busy" });
      }

      if (status === "in_transit") booking.inTransitAt = new Date();

      if (status === "delivered") {
        booking.deliveredAt = new Date();

        const truck = await Truck.findById(booking.truckId._id);
        const updateData = { availability: "available" };

        if (truck && truck.pendingLocation && truck.pendingLocation.city) {
          updateData.currentLocation = {
            city: truck.pendingLocation.city,
            coordinates: truck.pendingLocation.coordinates || [0, 0],
            updatedAt: new Date(),
          };
          updateData.pendingLocation = null;
        } else {
          updateData.currentLocation = {
            city: extractCityName(booking.dropCity),
            updatedAt: new Date(),
          };
        }

        await Truck.findByIdAndUpdate(booking.truckId._id, updateData);
      }

      await booking.save();

      if (io) {
        io.to(`user:${booking.companyId}`).emit("notification", {
          title: "Trip Update 🚚",
          body: `Truck ${booking.truckId.truckNumber} is now "${status.replace("_", " ")}".`,
          url: "/dashboard/company/my-booking",
        });
      }

      return res.json({ message: "Status updated successfully", booking });
    }

    return res.status(400).json({ message: "Invalid action" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getCompanyBookings = async (req, res) => {
  try {
    if (req.user.role !== "company") {
      return res.status(403).json({ message: "Unauthorized" });
    }
    const companyId = req.user._id;

    const bookings = await Booking.find({ companyId })
      .populate("truckId")
      .populate("driverId", "name phone");

    const mappedBookings = bookings.map(b => {
      const bObj = b.toObject ? b.toObject() : b;
      if (req.user.role !== "truck_owner") {
        bObj.price = getCompanyPrice(bObj.price);
      }
      return bObj;
    });

    res.json({
      total: mappedBookings.length,
      bookings: mappedBookings,
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
