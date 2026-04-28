const express = require("express");
const router = express.Router();

const { getOwnerDashboardStats } = require("../controllers/ownerController");
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

router.get(
  "/dashboard",
  protect,
  authorizeRoles("truck_owner"),
  getOwnerDashboardStats
);

module.exports = router;