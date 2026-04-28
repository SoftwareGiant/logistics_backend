const express = require("express");
const router = express.Router();
const { authorizeRoles } = require("../middlewares/roleMiddleware");
const { protect } = require("../middlewares/authMiddleware");
const {
  getPendingUsers,
  approveUser,
  rejectUser,
  createAdmin,
  getDashboardStats ,
  getAllBookingsAdmin
} = require("../controllers/adminController");

router.use(protect);
router.use(authorizeRoles("admin"));
// router.post("/create-admin", createAdmin);

// 🔍 Get all pending users
router.get("/pending-users", getPendingUsers);

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
module.exports = router;