const webpush = require("../config/webpush");
const PushSubscription = require("../models/pushSubscriptionModel");

/**
 * Sends a real OS-level push notification to every device a user has
 * subscribed on — reaches them even if the site isn't open, as long as the
 * browser/OS is running. Falls back silently (no-op) if VAPID isn't
 * configured or the user has no subscriptions.
 *
 * payload: { title, body, url }
 */
async function sendPushToUser(userId, payload) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

  const subs = await PushSubscription.find({ userId }).lean();
  if (!subs.length) return;

  const json = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          json
        );
      } catch (err) {
        // 404/410 = the browser/OS has unsubscribed this endpoint on its own
        // (uninstalled, permission revoked, etc) — clean up the stale row.
        if (err.statusCode === 404 || err.statusCode === 410) {
          await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
        } else {
          console.error("Push send failed:", err.message);
        }
      }
    })
  );
}

/** Same as sendPushToUser but for several recipients at once. */
async function sendPushToUsers(userIds, payload) {
  await Promise.all(userIds.map((id) => sendPushToUser(id, payload)));
}

module.exports = { sendPushToUser, sendPushToUsers };
