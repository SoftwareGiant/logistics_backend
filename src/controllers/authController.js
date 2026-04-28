const mongoose = require("mongoose");

const User = require("../models/userModel");
const Company = require("../models/companyModel");
const Truck = require("../models/truckModel");

const generateToken = require("../utils/generateToken");

const sanitizeRepresentatives = (representatives = []) =>
  representatives.map(({ password, ...rep }) => rep);

// ================= REGISTER COMPANY =================
exports.registerCompany = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      name,
      email,
      phone,
      password,
      companyName,
      location,
      gstNumber,
      representatives = [],
    } = req.body;

    // 🔍 basic validation
    if (!name || !password || (!email && !phone)) {
      throw new Error("Basic details required");
    }

    if (!companyName || !location) {
      throw new Error("Company details required");
    }

    // 🔍 check owner duplicate
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }],
    }).session(session);

    if (existingUser) {
      throw new Error("User already exists");
    }

    // 👤 create company owner
    const [owner] = await User.create(
      [
        {
          name,
          email,
          phone,
          password,
          role: "company",
        },
      ],
      { session }
    );

    const ownerId = owner._id;

    // ================= 👨‍💼 CREATE REPRESENTATIVES =================
    let createdRepresentatives = [];

    if (representatives.length > 0) {
      const repDocs = [];

      for (let i = 0; i < representatives.length; i++) {
        const rep = representatives[i];

        if (!rep?.name || (!rep.email && !rep.phone) || !rep.password) {
          throw new Error(`Invalid representative data at index ${i}`);
        }

        // 🔍 duplicate check for reps
        const existingRep = await User.findOne({
          $or: [{ email: rep.email }, { phone: rep.phone }],
        }).session(session);

        if (existingRep) {
          throw new Error(`Representative already exists at index ${i}`);
        }

        repDocs.push({
          name: rep.name,
          email: rep.email,
          phone: rep.phone,
          password: rep.password,
          role: "company_staff",
          companyId: null, // set later
          createdBy: ownerId,
        });
      }

      createdRepresentatives = await User.insertMany(repDocs, { session });
    }

    // ================= 🏢 CREATE COMPANY =================
    const [company] = await Company.create(
      [
        {
          userId: ownerId,
          companyName,
          location,
          gstNumber,
        },
      ],
      { session }
    );

    // 🔗 link owner → company
    await User.findByIdAndUpdate(
      ownerId,
      { companyId: company._id },
      { session }
    );

    // 🔗 link reps → company
    if (createdRepresentatives.length > 0) {
      const repIds = createdRepresentatives.map((r) => r._id);

      await User.updateMany(
        { _id: { $in: repIds } },
        { companyId: company._id },
        { session }
      );
    }

    // ✅ commit
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message: "Company registered, pending approval",
      owner: {
        _id: owner._id,
        name: owner.name,
        email: owner.email,
        role: owner.role,
      },
      company,
      representatives: createdRepresentatives.map((r) => ({
        _id: r._id,
        name: r.name,
        email: r.email,
        phone: r.phone,
      })),
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
      email,
      phone,
      password,
      trucks = [],
      drivers = [],
    } = req.body;

    if (!name || !password || (!email && !phone)) {
      throw new Error("Basic details required");
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (existingUser) {
      throw new Error("User already exists");
    }

    const [owner] = await User.create(
      [
        {
          name,
          email,
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
        if (
          !t.truckNumber ||
          !t.capacity ||
          !t.type ||
          !t.usualRoute?.from ||
          !t.usualRoute?.to ||
          !t.pricing?.normalPrice ||
          !t.pricing?.returnPrice
        ) {
          throw new Error(`Invalid truck data at index ${index}`);
        }

        return {
          ownerId,
          truckNumber: t.truckNumber.trim().toUpperCase(),
          capacity: t.capacity,
          type: t.type,
          usualRoute: {
            from: t.usualRoute.from.toLowerCase().trim(),
            to: t.usualRoute.to.toLowerCase().trim(),
          },
          currentLocation: t.currentLocation
            ? t.currentLocation.toLowerCase().trim()
            : t.usualRoute.from.toLowerCase().trim(),
          pricing: {
            normalPrice: t.pricing.normalPrice,
            returnPrice: t.pricing.returnPrice,
          },
          availability: "available",
        };
      });

      createdTrucks = await Truck.insertMany(truckDocs, { session });
    }

    let createdDrivers = [];

    if (drivers.length > 0) {
      const driverDocs = drivers.map((d, index) => {
        if (!d.name || (!d.email && !d.phone) || !d.password) {
          throw new Error(`Invalid driver data at index ${index}`);
        }

        return {
          name: d.name,
          email: d.email,
          phone: d.phone,
          password: d.password,
          role: "driver",
          truckOwnerId: ownerId,
          assignedTruckId: d.assignedTruckId || null,
          licenseNumber: d.licenseNumber,
          createdBy: ownerId,
        };
      });

      createdDrivers = await User.insertMany(driverDocs, { session });
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message: "Truck owner registered, pending approval",
      owner,
      trucks: createdTrucks,
      drivers: createdDrivers.map((d) => ({
        _id: d._id,
        name: d.name,
        phone: d.phone,
      })),
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
    const { email, phone, password } = req.body;

    if ((!email && !phone) || !password) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    let user;
    if (email) {
      user = await User.findOne({
        $or: [{ email }],
      });
    }
    if (phone) {
      user = await User.findOne({
        $or: [{ phone }],
      });
    }

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
