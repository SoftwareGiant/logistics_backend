/**
 * One-off backfill for the geo-matching feature.
 *
 *  1. Marks every truck whose owner is already approved as `verified: true`
 *     (new approvals do this automatically going forward).
 *  2. Reports how many trucks still have no `baseLocation.coordinates` — those
 *     owners need to re-save a location before their trucks can be matched.
 *
 * Usage (from logistic_backend/):
 *   node scripts/backfillTruckMatching.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Truck = require("../src/models/truckModel");
const User = require("../src/models/userModel");

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set (check your .env).");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const approvedOwnerIds = await User.find({
    role: "truck_owner",
    verificationStatus: "approved",
  }).distinct("_id");

  const verifyRes = await Truck.updateMany(
    { ownerId: { $in: approvedOwnerIds }, verified: { $ne: true } },
    { verified: true }
  );
  console.log(`Marked ${verifyRes.modifiedCount} truck(s) as verified.`);

  const missingLocation = await Truck.countDocuments({
    $or: [
      { "baseLocation.coordinates": { $exists: false } },
      { "baseLocation.coordinates": { $size: 0 } },
    ],
  });
  console.log(
    `${missingLocation} truck(s) have no base location — they will not match until a location is set.`
  );

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
