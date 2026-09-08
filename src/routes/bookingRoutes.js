const express = require("express");
const router = express.Router();

const {
  getCompanyBookings,
  getOwnerBookings,
  updateBookingByOwner,
} = require("../controllers/bookingController");
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

// company
router.get("/company", protect, authorizeRoles("company"), getCompanyBookings);

// owner
router.get("/owner", protect, authorizeRoles("truck_owner"), getOwnerBookings);

// owner drives the whole booking lifecycle (accept/reject + trip status)
router.put(
  "/:bookingId/owner-action",
  protect,
  authorizeRoles("truck_owner"),
  updateBookingByOwner
);

module.exports = router;