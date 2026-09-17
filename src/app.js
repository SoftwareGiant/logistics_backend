const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const truckRoutes = require("./routes/truckRoutes");
const ownerRoutes = require("./routes/ownerRoutes");
const requirementRoutes = require("./routes/requirementRoutes");
const payoutRoutes = require("./routes/payoutRoutes");
const pushRoutes = require("./routes/pushRoutes");

const app = express();

// Middlewares
app.use(express.json());
app.use(cors());

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/trucks", truckRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/owners", ownerRoutes);
app.use("/api/requirements", requirementRoutes);
app.use("/api/payouts", payoutRoutes);
app.use("/api/push", pushRoutes);
// Health check
app.get("/", (req, res) => {
  res.send("API Running 🚀");
});

module.exports = app;