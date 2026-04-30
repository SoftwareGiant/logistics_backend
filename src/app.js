const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const truckRoutes = require("./routes/truckRoutes");
const ownerRoutes = require("./routes/ownerRoutes");
const requirementRoutes = require("./routes/requirementRoutes");
const offerRoutes = require("./routes/offerRoutes");

const app = express();

// Middlewares
app.use(express.json());
app.use(cors());

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/trucks", truckRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/owner", ownerRoutes);
app.use("/api/requirements", requirementRoutes);
app.use("/api/offers", offerRoutes);
// Health check
app.get("/", (req, res) => {
  res.send("API Running 🚀");
});

module.exports = app;