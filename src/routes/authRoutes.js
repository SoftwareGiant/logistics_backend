const express = require("express");
const router = express.Router();
const User = require("../models/userModel");

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

// ─── Bank Details (truck owner — used for payouts) ────────────────────────────
router.put("/bank-details", protect, async (req, res) => {
  try {
    if (req.user.role !== "truck_owner") {
      return res.status(403).json({ message: "Only truck owners can update bank details" });
    }

    const { accountHolderName, ifsc, accountNumber } = req.body;

    if (!accountHolderName || !ifsc || !accountNumber) {
      return res.status(400).json({ message: "All bank detail fields are required" });
    }

    const updated = await User.findByIdAndUpdate(
      req.user._id,
      {
        bankDetails: {
          accountHolderName: accountHolderName.trim(),
          ifsc: ifsc.trim().toUpperCase(),
          accountNumber: accountNumber.trim(),
        },
      },
      { new: true }
    ).select("-password");

    res.json({ message: "Bank details updated successfully", user: updated });
  } catch (error) {
    console.error("Error updating bank details:", error);
    res.status(500).json({ message: "Failed to update bank details" });
  }
});

module.exports = router;