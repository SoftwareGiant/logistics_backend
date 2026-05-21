const express = require("express");
const router = express.Router();
const { authorizeRoles } = require("../middlewares/roleMiddleware");
const { protect } = require("../middlewares/authMiddleware");
const {
  getPendingUsers,
  approveUser,
  rejectUser,
  createAdmin,
  getApprovedCompanyOwners,
  getApprovedTruckOwners,
  getDashboardStats ,
  getAllBookingsAdmin,
    getAllRequirements,
  getRequirementOffersAdmin,
  getAllFleetStatus,
  getRejectedUsers,
  getApprovedUsers,
  updateTruckPricing,
} = require("../controllers/adminController");

router.use(protect);
router.use(authorizeRoles("admin"));
// router.post("/create-admin", createAdmin);

// 🔍 Get all pending users
router.get("/pending-users", getPendingUsers);
router.get("/rejected-users", getRejectedUsers);
router.get("/approved-users", getApprovedUsers);
router.get("/company-owners", getApprovedCompanyOwners);
router.get("/truck-owners", getApprovedTruckOwners);

// ✅ Approve user
router.put("/approve/:id", approveUser);

// ❌ Reject user
router.put("/reject/:id", rejectUser);

router.get(
  "/dashboard",
  protect,
  authorizeRoles("admin"),
  getDashboardStats
);
// all bookings
router.get(
  "/bookings",
  protect,
  authorizeRoles("admin"),
  getAllBookingsAdmin
);
router.get("/requirements", protect, authorizeRoles("admin"), getAllRequirements);
router.get("/requirements/:requirementId/offers", protect, authorizeRoles("admin"), getRequirementOffersAdmin);
router.get(
  "/fleet",
  protect,
  authorizeRoles("admin"),
  getAllFleetStatus
);

router.put(
  "/trucks/:truckId/pricing",
  protect,
  authorizeRoles("admin"),
  updateTruckPricing
);

module.exports = router;
