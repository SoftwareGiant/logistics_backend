const PushSubscription = require("../models/pushSubscriptionModel");

// Public key is safe to expose — it's meant to be handed to the browser.
exports.getVapidPublicKey = (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
};

exports.subscribe = async (req, res) => {
  try {
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ message: "Invalid push subscription" });
    }

    await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        endpoint,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
        userId: req.user._id,
        userAgent: req.headers["user-agent"] || "",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ message: "Subscribed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) {
      return res.status(400).json({ message: "endpoint is required" });
    }
    await PushSubscription.deleteOne({ endpoint, userId: req.user._id });
    res.json({ message: "Unsubscribed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
