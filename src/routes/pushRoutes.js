const express = require("express");
const router = express.Router();

const { getVapidPublicKey, subscribe, unsubscribe } = require("../controllers/pushController");
const { protect } = require("../middlewares/authMiddleware");

router.get("/vapid-public-key", getVapidPublicKey);
router.post("/subscribe", protect, subscribe);
router.post("/unsubscribe", protect, unsubscribe);

module.exports = router;
