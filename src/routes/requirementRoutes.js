const express = require("express");
const router = express.Router();

const {
  addRequirement,
  getMyRequirements,
  deleteRequirement,
} = require("../controllers/requirementController");

const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

router.post("/", protect, authorizeRoles("company"), addRequirement);
router.get("/my", protect, authorizeRoles("company"), getMyRequirements);
router.delete("/:id", protect, authorizeRoles("company"), deleteRequirement);

module.exports = router;