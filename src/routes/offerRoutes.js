const express = require("express");
const router = express.Router();

const {
  getMatchingRequirements,
  createOffer,
  getRequirementOffers,
} = require("../controllers/offerController");

const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

// truck owner
router.get("/available", protect, authorizeRoles("truck_owner"), getMatchingRequirements);
router.post("/", protect, authorizeRoles("truck_owner"), createOffer);

// company
router.get("/:requirementId", protect, authorizeRoles("company"), getRequirementOffers);

module.exports = router;