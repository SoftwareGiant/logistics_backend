const express = require("express");
const router = express.Router();

const { searchTrucks, getOwnerFleet, updateTruckLocation, checkTruckExists } = require("../controllers/truckController");
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

router.get("/search", searchTrucks);
router.get(
  "/owner/fleet",
  protect,
  authorizeRoles("truck_owner"),
  getOwnerFleet
);

router.put(
  "/update-location",
  protect,
  authorizeRoles("driver"),
  updateTruckLocation
);

router.get(
  "/check/:truckNumber",
  protect,
  checkTruckExists
);

module.exports = router;