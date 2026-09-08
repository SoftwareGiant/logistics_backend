const express = require("express");
const router = express.Router();

const { getOwnerFleet, updateTruckLocation, checkTruckExists } = require("../controllers/truckController");
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

router.get(
  "/owner/fleet",
  protect,
  authorizeRoles("truck_owner"),
  getOwnerFleet
);

// The owner keeps the truck's live location fresh (no driver login).
router.put(
  "/update-location",
  protect,
  authorizeRoles("truck_owner"),
  updateTruckLocation
);

router.get(
  "/check/:truckNumber",
  protect,
  checkTruckExists
);

module.exports = router;