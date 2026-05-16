const express = require("express");
const router = express.Router();

const { getOwnerDashboardStats, getAvailableTruckDriverPairs, addTruck, addDriver, addTruckWithDriver, addMultipleTrucksAndDrivers, updateFleetItem } = require("../controllers/ownerController");
const { uploadMiddleware, uploadImages } = require("../controllers/uploadController");
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

router.post("/upload-images", uploadMiddleware, uploadImages);

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

// 🚛 add truck
router.post(
  "/truck",
  protect,
  authorizeRoles("truck_owner"),
  addTruck
);

// 👨‍✈️ add driver
router.post(
  "/driver",
  protect,
  authorizeRoles("truck_owner"),
  addDriver
);

// 🚛 + 👨‍✈️ add truck with driver (combined)
router.post(
  "/truck-with-driver",
  protect,
  authorizeRoles("truck_owner"),
  addTruckWithDriver
);

// 🚛 + 👨‍✈️ add multiple trucks and drivers (bulk)
router.post(
  "/bulk-add",
  protect,
  authorizeRoles("truck_owner"),
  addMultipleTrucksAndDrivers
);

// 🛠️ edit fleet
router.put(
  "/fleet/:truckId",
  protect,
  authorizeRoles("truck_owner"),
  updateFleetItem
);

module.exports = router;