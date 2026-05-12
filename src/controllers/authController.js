const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

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

    // 🔍 validation
    if (!name || !password || (!email && !phone)) {
      throw new Error("Basic details required");
    }

    if (!companyName || !location) {
      throw new Error("Company details required");
    }


    let existingUser
    if (email) {
      existingUser = await User.findOne({
        $or: [{ email }],
      }).session(session);
    }

    if (phone) {
      existingUser = await User.findOne({
        $or: [{ phone }],
      }).session(session);
    }

    if (existingUser) {
      throw new Error("User already exists");
    }

    // 👤 create owner
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
    let repDocsForCompany = [];

    if (representatives.length > 0) {
      for (let i = 0; i < representatives.length; i++) {
        const rep = representatives[i];

        if (!rep?.name || (!rep.email && !rep.phone) || !rep.password) {
          throw new Error(`Invalid representative data at index ${i}`);
        }

        // 🔍 duplicate check
        const existingRep = await User.findOne({
          $or: [{ email: rep.email }, { phone: rep.phone }],
        }).session(session);

        if (existingRep) {
          throw new Error(`Representative already exists at index ${i}`);
        }

        // 🔥 use create() so pre-save hook runs for password hashing
        const [createdRep] = await User.create(
          [
            {
              name: rep.name,
              email: rep.email,
              phone: rep.phone,
              password: rep.password, // 🔥 will be hashed by pre-save hook
              role: "company_staff",
              createdBy: ownerId,
            },
          ],
          { session }
        );

        createdRepresentatives.push(createdRep);

        // 🔥 prepare for company schema
        repDocsForCompany.push({
          name: rep.name,
          email: rep.email,
          phone: rep.phone,
        });
      }
    }

    // ================= 🏢 CREATE COMPANY =================
    const [company] = await Company.create(
      [
        {
          userId: ownerId,
          companyName,
          location,
          gstNumber,
          representatives: repDocsForCompany, // 🔥 FIX HERE
        },
      ],
      { session }
    );

    // 🔗 link owner
    await User.findByIdAndUpdate(
      ownerId,
      { companyId: company._id },
      { session }
    );

    // 🔗 link reps
    if (createdRepresentatives.length > 0) {
      const repIds = createdRepresentatives.map((r) => r._id);

      await User.updateMany(
        { _id: { $in: repIds } },
        { companyId: company._id },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message: "Company registered, pending approval",
      owner,
      company,
      representatives: createdRepresentatives,
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
    let existingUser
    if (email) {
      existingUser = await User.findOne({
        $or: [{ email }],
      }).session(session);
    }

    if (phone) {
      existingUser = await User.findOne({
        $or: [{ phone }],
      }).session(session);
    }


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
          currentLocation: {
            city: t.currentLocation?.city
              ? t.currentLocation.city.toLowerCase().trim()
              : t.usualRoute.from.toLowerCase().trim(),

            coordinates: t.currentLocation?.coordinates || [0, 0],
          },
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
<<<<<<< HEAD
      for (let i = 0; i < drivers.length; i++) {
        const d = drivers[i];

=======
      const driverDocs = [];

      for (let i = 0; i < drivers.length; i++) {
        const d = drivers[i];

        // Ensure driver data is valid
>>>>>>> d9f1304950a173e0f832da6ecc026f8dd20b9d50
        if (!d.name || (!d.email && !d.phone) || !d.password) {
          throw new Error(`Invalid driver data at index ${i}`);
        }

<<<<<<< HEAD
        // 🔥 use create() instead of insertMany() so pre-save hook runs for password hashing
        const [driver] = await User.create(
          [
            {
              name: d.name,
              email: d.email,
              phone: d.phone,
              password: d.password, // 🔥 will be hashed by pre-save hook
              role: "driver",
              truckOwnerId: ownerId,
              assignedTruckId:
                typeof d.truckIndex === "number"
                  ? createdTrucks[d.truckIndex]?._id
                  : null,
              createdBy: ownerId,
            },
          ],
          { session }
        );

        createdDrivers.push(driver);
      }
=======
        // Prevent Duplicate Drivers
        const existingDriver = await User.findOne({
          $or: [{ email: d.email }, { phone: d.phone }],
        }).session(session);

        if (existingDriver) {
          throw new Error(`Driver with this email/phone already exists at index ${i}`);
        }

        // Push to array (plain text password is fine here, hook will catch it)
        driverDocs.push({
          name: d.name,
          email: d.email,
          phone: d.phone,
          password: d.password,
          role: "driver",
          truckOwnerId: ownerId,
          assignedTruckId:
            typeof d.truckIndex === "number"
              ? createdTrucks[d.truckIndex]?._id
              : null,
          createdBy: ownerId,
        });
      }

      // User.create() iterates through the array and triggers pre("save") for EACH driver
      createdDrivers = await User.create(driverDocs, { session });
>>>>>>> d9f1304950a173e0f832da6ecc026f8dd20b9d50
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
