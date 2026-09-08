const express = require("express");
const router = express.Router();

const {
  addRequirement,
  getMyRequirements,
  getRequirementById,
  updateRequirement,
  getMatchingTrucks,
  getAvailableRequirements,
  acceptRequirement,
  deleteRequirement,
  getPopularRoutes,
} = require("../controllers/requirementController");

const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

router.get("/popular", protect, getPopularRoutes);

// ─── Truck owner ─────────────────────────────────────────────────────────────
router.get("/available", protect, authorizeRoles("truck_owner"), getAvailableRequirements);
router.post("/:id/accept", protect, authorizeRoles("truck_owner"), acceptRequirement);

// ─── Company ─────────────────────────────────────────────────────────────────
router.post("/", protect, authorizeRoles("company"), addRequirement);
router.get("/my", protect, authorizeRoles("company"), getMyRequirements);
router.get("/:id/matching-trucks", protect, authorizeRoles("company"), getMatchingTrucks);
router.get("/:id", protect, authorizeRoles("company"), getRequirementById);
router.put("/:id", protect, authorizeRoles("company"), updateRequirement);
router.delete("/:id", protect, authorizeRoles("company"), deleteRequirement);

module.exports = router;
