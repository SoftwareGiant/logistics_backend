/**
 * One-off admin bootstrap.
 *
 * Usage (from logistic_backend/):
 *   node scripts/createAdmin.js "<name>" "<phone>" "<password>" ["<email>"]
 *
 * Example:
 *   node scripts/createAdmin.js "Platform Admin" "9999999999" "admin123" "admin@logisync.com"
 *
 * Creates a User with role "admin" and verificationStatus "approved" so it can
 * log in immediately through the normal login screen (phone + password).
 * If a user with the same phone/email already exists it is promoted to admin.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/models/userModel");

async function main() {
  const [, , name, phone, password, email] = process.argv;

  if (!name || !phone || !password) {
    console.error('Usage: node scripts/createAdmin.js "<name>" "<phone>" "<password>" ["<email>"]');
    process.exit(1);
  }

  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set (check your .env).");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const existing = await User.findOne({
    $or: [{ phone }, ...(email ? [{ email }] : [])],
  });

  if (existing) {
    existing.name = name;
    existing.role = "admin";
    existing.verificationStatus = "approved";
    existing.isActive = true;
    if (email) existing.email = email;
    existing.password = password; // re-hashed by the pre-save hook
    await existing.save();
    console.log(`Existing user ${existing._id} promoted to admin.`);
  } else {
    const admin = await User.create({
      name,
      phone,
      email: email || undefined,
      password, // hashed by the pre-save hook
      role: "admin",
      verificationStatus: "approved",
    });
    console.log(`Admin created: ${admin._id}`);
  }

  console.log(`\nLog in at http://localhost:3000/  with:\n  phone:    ${phone}\n  password: ${password}\nYou will be redirected to /dashboard/admin`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
