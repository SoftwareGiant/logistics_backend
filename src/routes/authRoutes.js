const express = require("express");
const router = express.Router();

const {
  registerCompany,
  registerTruckOwner,
  login,
} = require("../controllers/authController");

router.post("/register/company", registerCompany);
router.post("/register/truck-owner", registerTruckOwner);
router.post("/login", login);

module.exports = router;