const webpush = require("web-push");

// VAPID identifies this server to push services (FCM, Mozilla's push service,
// etc). Keys are already in .env; the subject just needs to be a contactable
// mailto: or https: URL some push services use to reach you about issues.
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

module.exports = webpush;
