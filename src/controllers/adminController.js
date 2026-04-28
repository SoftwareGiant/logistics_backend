const mongoose = require("mongoose");

const User = require("../models/userModel");
const Company = require("../models/companyModel");

// ================= GET PENDING USERS =================
exports.getPendingUsers = async (req, res) => {
  try {
    const users = await User.find({
      verificationStatus: "pending",
    }).select("-password");

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= APPROVE USER =================
exports.approveUser = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    const user = await User.findById(id).session(session);
    if (!user) throw new Error("User not found");

    if (user.verificationStatus === "approved") {
      throw new Error("Already approved");
    }

    user.verificationStatus = "approved";
    await user.save({ session });

    if (user.role === "company") {
      const company = await Company.findOne({
        userId: user._id,
      }).session(session);

      if (company?.representatives?.length > 0) {
        for (const rep of company.representatives) {
          if ((!rep.email && !rep.phone) || !rep.password) continue;

          const duplicateFilters = [];
          if (rep.email) duplicateFilters.push({ email: rep.email });
          if (rep.phone) duplicateFilters.push({ phone: rep.phone });

          const existing =
            duplicateFilters.length > 0
              ? await User.findOne({ $or: duplicateFilters }).session(session)
              : null;

          if (existing) continue;

          await User.create(
            [
              {
                name: rep.name,
                email: rep.email,
                phone: rep.phone,
                password: rep.password,
                role: "company_staff",
                companyId: company._id,
                createdBy: user._id,
                verificationStatus: "approved",
              },
            ],
            { session }
          );
        }
      }
    }

    if (user.role === "truck_owner") {
      const drivers = await User.find({
        truckOwnerId: user._id,
        role: "driver",
      }).session(session);

      for (const driver of drivers) {
        driver.verificationStatus = "approved";
        await driver.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    res.json({ message: "User approved successfully" });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    res.status(400).json({ message: error.message });
  }
};

// ================= REJECT USER =================
exports.rejectUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.verificationStatus = "rejected";
    await user.save();

    res.json({ message: "User rejected" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createAdmin = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !password || (!email && !phone)) {
      return res.status(400).json({
        message: "Name, password and email or phone required",
      });
    }

    const existing = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (existing) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    const admin = await User.create({
      name,
      email,
      phone,
      password,
      role: "admin",
      verificationStatus: "approved",
    });

    res.status(201).json({
      message: "Admin created successfully",
      admin: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
