require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");
const app = require("./src/app");
const connectDB = require("./src/config/db");

const PORT = process.env.PORT || 5000;

// Create HTTP server
const httpServer = http.createServer(app);

// Attach Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// Make io available to routes/controllers via app locals
app.set("io", io);

// ─── In-memory location cache ──────────────────────────────────────────────────
// Stores the last known { lat, lng, isOnline, updatedAt } per driverId.
// Any observer that joins AFTER the last broadcast immediately gets a catch-up
// event, so a full page refresh never leaves the map blank.
const locationCache = new Map();
// Map<socketId, driverId> so we can clear the cache on socket disconnect
const socketToDriver = new Map();

// ─── Socket.io Connection Handler ─────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // ── Observer joins a driver's channel ──────────────────────────────────────
  // Called by company/truck-owner dashboards to subscribe to a driver's location.
  socket.on("driver:join", (driverId) => {
    if (!driverId) return;
    socket.join(`driver:${driverId}`);
    console.log(`👁️  Observer ${socket.id} subscribed to driver:${driverId}`);

    const cached = locationCache.get(driverId);
    if (cached && cached.isOnline) {
      // ✅ Driver is active — replay last known location immediately
      socket.emit(`driver:${driverId}:location`, {
        lat: cached.lat,
        lng: cached.lng,
        isOnline: true,
      });
      console.log(`📤 Replayed cached location to ${socket.id} for driver:${driverId}`);
    } else {
      // ✅ Driver is not active — immediately tell observer so they show
      //    "Driver is offline" instead of "Connecting..." indefinitely
      socket.emit(`driver:${driverId}:location`, { lat: 0, lng: 0, isOnline: false });
      console.log(`📤 Notified ${socket.id} that driver:${driverId} is offline`);
    }
  });

  // ── Driver emits their live location ───────────────────────────────────────
  // Payload: { driverId, lat, lng, isOnline }
  socket.on("driver:location", (data) => {
    const { driverId, lat, lng, isOnline } = data;
    if (!driverId) return;

    // Track which driver this socket belongs to (for disconnect cleanup)
    socketToDriver.set(socket.id, driverId);

    if (isOnline) {
      // Update cache with fresh coordinates
      locationCache.set(driverId, { lat, lng, isOnline: true, updatedAt: Date.now() });
    } else {
      locationCache.delete(driverId);
    }

    // Broadcast to ALL connected clients (observers listening on this event name)
    io.emit(`driver:${driverId}:location`, { lat, lng, isOnline });
    console.log(`📍 Driver ${driverId}: ${lat}, ${lng} | online: ${isOnline}`);
  });

  // ── Driver explicitly goes offline ─────────────────────────────────────────
  socket.on("driver:offline", (driverId) => {
    if (!driverId) return;
    locationCache.delete(driverId);
    socketToDriver.delete(socket.id);
    io.emit(`driver:${driverId}:location`, { lat: 0, lng: 0, isOnline: false });
    console.log(`🔴 Driver ${driverId} went offline`);
  });

  // ── Socket disconnected ────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    // If this was a driver socket, remove their cache entry so observers
    // don't get stale coordinates after a driver closes their tab.
    const driverId = socketToDriver.get(socket.id);
    if (driverId) {
      locationCache.delete(driverId);
      socketToDriver.delete(socket.id);
      io.emit(`driver:${driverId}:location`, { lat: 0, lng: 0, isOnline: false });
      console.log(`🔌 Driver socket ${socket.id} (${driverId}) disconnected — cache cleared`);
    } else {
      console.log(`❌ Observer socket disconnected: ${socket.id}`);
    }
  });
});

// Connect DB
connectDB();

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} (HTTP + Socket.io)`);
});