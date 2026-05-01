const express = require("express");
const router = express.Router();

const { getOwnerDashboardStats, getAvailableTruckDriverPairs } = require("../controllers/ownerController");
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

router.get(
  "/dashboard",
  protect,
  authorizeRoles("truck_owner"),
  getOwnerDashboardStats
);
router.get(
  "/available-pairs",
  protect,
  authorizeRoles("truck_owner"),
  getAvailableTruckDriverPairs
);
module.exports = router;