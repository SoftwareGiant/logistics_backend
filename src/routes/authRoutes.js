const express = require("express");
const router = express.Router();

const {
  registerCompany,
  registerTruckOwner,
  login,
} = require("../controllers/authController");
const { protect } = require("../middlewares/authMiddleware");

router.post("/register/company", registerCompany);
router.post("/register/truck-owner", registerTruckOwner);
router.post("/login", login);
router.get("/me", protect, (req, res) => res.json({ user: req.user }));

module.exports = router;