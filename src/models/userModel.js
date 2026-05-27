const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true,
    },

    phone: {
      type: String,
      sparse: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    role: {
      type: String,
      enum: ["company", "company_staff", "truck_owner", "driver", "admin"],
      required: true,
    },

    verificationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // Relations
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
    },

    truckOwnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    assignedTruckId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Truck",
    },


    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Bank Details (for drivers)
    bankDetails: {
      accountHolderName: { type: String, trim: true, default: "" },
      ifsc: { type: String, trim: true, uppercase: true, default: "" },
      accountNumber: { type: String, trim: true, default: "" },
    },
  },
  { timestamps: true }
);

// 🔐 Hash password
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);

  next();
});

// 🔑 Compare password
userSchema.methods.comparePassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);