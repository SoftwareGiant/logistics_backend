const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const User = require("../models/userModel");
const Company = require("../models/companyModel");
const Truck = require("../models/truckModel");

const generateToken = require("../utils/generateToken");

// ================= REGISTER COMPANY =================
exports.registerCompany = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { name, phone, password, companyName, location, gstNumber } = req.body;

    // 🔍 validation
    if (!name || !password || !phone) {
      throw new Error("Basic details required");
    }

    if (!companyName || !location) {
      throw new Error("Company details required");
    }

    const existingUser = await User.findOne({ phone }).session(session);

    if (existingUser) {
      throw new Error("User already exists");
    }

    // 👤 create owner
    const [owner] = await User.create(
      [
        {
          name,
          phone,
          password,
          role: "company",
        },
      ],
      { session }
    );

    // ================= 🏢 CREATE COMPANY =================
    const [company] = await Company.create(
      [
        {
          userId: owner._id,
          companyName,
          location,
          gstNumber,
        },
      ],
      { session }
    );

    await User.findByIdAndUpdate(owner._id, { companyId: company._id }, { session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message: "Company registered, pending approval",
      owner,
      company,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    res.status(400).json({
      message: error.message,
    });
  }
};

// ================= REGISTER TRUCK OWNER =================
exports.registerTruckOwner = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      name,
      phone,
      password,
      trucks = [],
    } = req.body;

    if (!name || !password || !phone) {
      throw new Error("Basic details required");
    }
    const existingUser = await User.findOne({ phone }).session(session);


    if (existingUser) {
      throw new Error("User already exists");
    }

    const [owner] = await User.create(
      [
        {
          name,
          phone,
          password,
          role: "truck_owner",
        },
      ],
      { session }
    );

    const ownerId = owner._id;

    let createdTrucks = [];

    if (trucks.length > 0) {
      const truckDocs = trucks.map((t, index) => {
        if (!t.truckNumber || !t.capacity || !t.type) {
          throw new Error(`Invalid truck data at index ${index}`);
        }

        const coords = t.baseLocation?.coordinates;
        if (!Array.isArray(coords) || coords.length !== 2) {
          throw new Error(`Truck location is required at index ${index}`);
        }

        return {
          ownerId,
          truckNumber: t.truckNumber.trim().toUpperCase(),
          capacity: t.capacity,
          type: t.type,
          availability: "available",
          verified: false,
          baseLocation: {
            address: t.baseLocation.address || undefined,
            city: t.baseLocation.city ? t.baseLocation.city.toLowerCase().trim() : undefined,
            coordinates: [Number(coords[0]), Number(coords[1])],
          },
          images: Array.isArray(t.images) ? t.images : [],
        };
      });

      createdTrucks = await Truck.insertMany(truckDocs, { session });
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message: "Truck owner registered, pending approval",
      owner,
      trucks: createdTrucks,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    res.status(400).json({
      message: error.message,
    });
  }
};

// ================= LOGIN =================
exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Wrong password" });
    }

    if (user.verificationStatus !== "approved") {
      return res.status(403).json({
        message: "Account under verification",
      });
    }

    res.json({
      token: generateToken(user),
      user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
