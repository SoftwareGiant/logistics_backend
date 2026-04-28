const express = require("express");
const router = express.Router();

const {   createBooking,
  getCompanyBookings,
  getOwnerBookings,
  getDriverBookings,
  updateBookingByOwner,
  updateBookingByDriver, 
  getDriverCurrentTrip,
  getDriverTripHistory} = require("../controllers/bookingController");
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

// only logged-in company
router.post("/", protect, createBooking);

// company
router.get("/company", protect, authorizeRoles("company"), getCompanyBookings);

// owner
router.get("/owner", protect, authorizeRoles("truck_owner"), getOwnerBookings);
// driver
router.get("/driver", protect, authorizeRoles("driver"), getDriverBookings);

router.put(
  "/:bookingId/owner-action",
  protect,
  authorizeRoles("truck_owner"),
  updateBookingByOwner
);
router.put(
  "/:bookingId/driver-update",
  protect,
  authorizeRoles("driver"),
  updateBookingByDriver
);
// driver current trip 
router.get(
  "/driver/current",
  protect,
  authorizeRoles("driver"),
  getDriverCurrentTrip
);

// driver trip history
router.get(
  "/driver/history",
  protect,
  authorizeRoles("driver"),
  getDriverTripHistory
);
module.exports = router;