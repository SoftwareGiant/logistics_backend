const express = require("express");
const router = express.Router();

const {
  getMatchingRequirements,
  createOffer,
  getRequirementOffers,
  acceptOffer,
  getMyOffers,
} = require("../controllers/offerController");

const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

// truck owner
router.get("/available", protect, authorizeRoles("truck_owner"), getMatchingRequirements);
router.get("/my", protect, authorizeRoles("truck_owner"), getMyOffers);
router.post("/", protect, authorizeRoles("truck_owner"), createOffer);

// company
router.get("/:requirementId", protect, authorizeRoles("company"), getRequirementOffers);
router.put("/:offerId/accept", protect, authorizeRoles("company"), acceptOffer);

module.exports = router;