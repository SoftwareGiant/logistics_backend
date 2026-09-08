const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");
const Payout = require("../models/payoutModel");
const User = require("../models/userModel");

// ─── Truck owner: Create payout request ──────────────────────────────────────
router.post("/request", protect, authorizeRoles("truck_owner"), async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Valid payout amount is required" });
    }

    const owner = await User.findById(req.user._id);
    if (
      !owner.bankDetails ||
      !owner.bankDetails.accountHolderName ||
      !owner.bankDetails.ifsc ||
      !owner.bankDetails.accountNumber
    ) {
      return res.status(400).json({
        message: "Please add your bank details before requesting a payout",
      });
    }

    // Check for existing pending payout
    const existingPending = await Payout.findOne({
      ownerId: req.user._id,
      status: "pending",
    });
    if (existingPending) {
      return res.status(400).json({
        message: "You already have a pending payout request. Please wait for it to be processed.",
      });
    }

    const payout = await Payout.create({
      ownerId: req.user._id,
      amount,
      bankDetails: {
        accountHolderName: owner.bankDetails.accountHolderName,
        ifsc: owner.bankDetails.ifsc,
        accountNumber: owner.bankDetails.accountNumber,
      },
    });

    // 🔔 Send push notification to all admins via Socket.io
    const io = req.app.get("io");
    if (io) {
      const admins = await User.find({ role: "admin", isActive: true }).select("_id");
      admins.forEach((admin) => {
        io.to(`user:${admin._id}`).emit("notification", {
          title: "New Payout Request 💰",
          body: `${req.user.name} has requested a payout of ₹${Number(amount).toLocaleString("en-IN")}`,
          url: "/dashboard/admin/payouts",
        });
      });
    }

    res.status(201).json({
      message: "Payout request submitted successfully",
      payout,
    });
  } catch (error) {
    console.error("Error creating payout request:", error);
    res.status(500).json({ message: "Failed to create payout request" });
  }
});

// ─── Truck owner: Get my payouts ─────────────────────────────────────────────
router.get("/my", protect, authorizeRoles("truck_owner"), async (req, res) => {
  try {
    const payouts = await Payout.find({ ownerId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ payouts });
  } catch (error) {
    console.error("Error fetching driver payouts:", error);
    res.status(500).json({ message: "Failed to fetch payouts" });
  }
});

// ─── Admin: Get all payouts ──────────────────────────────────────────────────
router.get(
  "/admin/all",
  protect,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      let { page = 1, limit = 15, status } = req.query;
      page = Number(page);
      limit = Number(limit);

      const query = {};
      if (status && status !== "all") {
        query.status = status;
      }

      const total = await Payout.countDocuments(query);

      const payouts = await Payout.find(query)
        .populate("ownerId", "name phone email bankDetails")
        .populate("processedBy", "name")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      res.json({
        total,
        page,
        pages: Math.ceil(total / limit),
        payouts,
      });
    } catch (error) {
      console.error("Error fetching admin payouts:", error);
      res.status(500).json({ message: "Failed to fetch payouts" });
    }
  }
);

// ─── Admin: Update payout status ─────────────────────────────────────────────
router.put(
  "/admin/:payoutId",
  protect,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { payoutId } = req.params;
      const { status, adminNote } = req.body;

      if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be 'approved' or 'rejected'" });
      }

      const payout = await Payout.findById(payoutId);
      if (!payout) {
        return res.status(404).json({ message: "Payout request not found" });
      }

      if (payout.status !== "pending") {
        return res.status(400).json({ message: "Payout has already been processed" });
      }

      payout.status = status;
      payout.adminNote = adminNote || "";
      payout.processedBy = req.user._id;
      payout.processedAt = new Date();
      await payout.save();

      // 🔔 Notify driver
      const io = req.app.get("io");
      if (io) {
        io.to(`user:${payout.ownerId}`).emit("notification", {
          title: status === "approved" ? "Payout Approved ✅" : "Payout Rejected ❌",
          body:
            status === "approved"
              ? `Your payout request of ₹${payout.amount.toLocaleString("en-IN")} has been approved!`
              : `Your payout request of ₹${payout.amount.toLocaleString("en-IN")} was rejected. ${adminNote || ""}`,
          url: "/dashboard/truck-owner/earnings",
        });
      }

      res.json({
        message: `Payout ${status} successfully`,
        payout,
      });
    } catch (error) {
      console.error("Error updating payout:", error);
      res.status(500).json({ message: "Failed to update payout" });
    }
  }
);

module.exports = router;
