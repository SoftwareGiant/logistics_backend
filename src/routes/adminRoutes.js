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
  getDashboardStats ,
  getAllRequirements,
  getAllFleetStatus,
  getRejectedUsers,
  getApprovedUsers,
} = require("../controllers/adminController");

router.use(protect);
router.use(authorizeRoles("admin"));
// router.post("/create-admin", createAdmin);

// 🔍 Get all pending users
router.get("/pending-users", getPendingUsers);
router.get("/rejected-users", getRejectedUsers);
router.get("/approved-users", getApprovedUsers);
router.get("/company-owners", getApprovedCompanyOwners);

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
router.get("/requirements", protect, authorizeRoles("admin"), getAllRequirements);
router.get(
  "/fleet",
  protect,
  authorizeRoles("admin"),
  getAllFleetStatus
);

module.exports = router;
