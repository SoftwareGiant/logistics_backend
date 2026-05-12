const express = require("express");
const router = express.Router();

const {
  addRequirement,
  getMyRequirements,
  deleteRequirement,
  getPopularRoutes,
} = require("../controllers/requirementController");

const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

router.get("/popular", protect, getPopularRoutes);
router.post("/", protect, authorizeRoles("company"), addRequirement);
router.get("/my", protect, authorizeRoles("company"), getMyRequirements);
router.delete("/:id", protect, authorizeRoles("company"), deleteRequirement);

module.exports = router;