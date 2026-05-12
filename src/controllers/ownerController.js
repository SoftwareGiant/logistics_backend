const Booking = require("../models/bookingModel");
const Truck = require("../models/truckModel");
const User = require("../models/userModel");
<<<<<<< HEAD
const bcrypt = require("bcrypt");
=======
>>>>>>> d9f1304950a173e0f832da6ecc026f8dd20b9d50

exports.getOwnerDashboardStats = async (req, res) => {
  try {
    const ownerId = req.user._id;

    const ownerTrucks = await Truck.find({ ownerId }).select("_id availability");
    const truckIds = ownerTrucks.map((truck) => truck._id);

    const [
      totalBookings,
      pendingBookings,
      activeBookings,
      completedBookings,
      rejectedBookings,
    ] = await Promise.all([
      Booking.countDocuments({ truckId: { $in: truckIds } }),
      Booking.countDocuments({
        truckId: { $in: truckIds },
        status: "pending",
      }),
      Booking.countDocuments({
        truckId: { $in: truckIds },
        status: { $in: ["assigned", "en_route", "picked_up", "in_transit"] },
      }),
      Booking.countDocuments({
        truckId: { $in: truckIds },
        status: "delivered",
      }),
      Booking.countDocuments({
        truckId: { $in: truckIds },
        status: { $in: ["rejected", "cancelled"] },
      }),
    ]);

    const availableTrucks = ownerTrucks.filter(
      (truck) => truck.availability === "available"
    ).length;

    res.json({
      totalTrucks: ownerTrucks.length,
      availableTrucks,
      busyTrucks: ownerTrucks.length - availableTrucks,
      totalBookings,
      pendingBookings,
      activeBookings,
      completedBookings,
      rejectedBookings,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};



exports.getAvailableTruckDriverPairs = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { date } = req.query;

    const d = date ? new Date(date) : new Date();
    const start = new Date(d.setHours(0, 0, 0, 0));
    const end = new Date(d.setHours(23, 59, 59, 999));

    // ================= GET DATA =================
    const trucks = await Truck.find({ ownerId }).lean();
    const drivers = await User.find({
      truckOwnerId: ownerId,
      role: "driver",
    }).lean();

    const truckIds = trucks.map((t) => t._id);
    const driverIds = drivers.map((d) => d._id);

    // ================= BOOKINGS =================
    const bookings = await Booking.find({
      pickupDate: { $gte: start, $lte: end },
      status: {
        $in: ["assigned", "en_route", "picked_up", "in_transit"],
      },
      $or: [
        { truckId: { $in: truckIds } },
        { driverId: { $in: driverIds } },
      ],
    }).lean();

    const bookedTruckIds = new Set();
    const bookedDriverIds = new Set();

    bookings.forEach((b) => {
      if (b.truckId) bookedTruckIds.add(b.truckId.toString());
      if (b.driverId) bookedDriverIds.add(b.driverId.toString());
    });

    // ================= MAP DRIVER BY TRUCK =================
    const driverMap = {};
    drivers.forEach((d) => {
      if (d.assignedTruckId) {
        driverMap[d.assignedTruckId.toString()] = d;
      }
    });

    // ================= FINAL FILTER =================
    const availablePairs = trucks
      .filter((t) => {
        const truckIdStr = t._id.toString();
        const isTruckFree = !bookedTruckIds.has(truckIdStr);
        const driver = driverMap[truckIdStr];
        const isDriverFree =
          driver && !bookedDriverIds.has(driver._id.toString());

        // 🔥 allow both:
        // ✔ new trip (available)
        // ✔ return trip (busy but running)
        const status = t.availability || "available";
        const isEligible = status === "available" || status === "busy";

        return isTruckFree && isDriverFree && isEligible;
      })
      .map((t) => {
        const driver = driverMap[t._id.toString()];
        const currentCity = t.currentLocation?.city;

        const isReturn =
          t.availability === "busy" &&
          currentCity !== t.usualRoute?.from;

        return {
          _id: t._id,
          label: `${t.truckNumber} • ${driver?.name || "No Driver"} • ${
            isReturn ? "Return" : "New"
          }`,
          truck: {
            _id: t._id,
            truckNumber: t.truckNumber,
            type: t.type,
            capacity: t.capacity,
            route: t.usualRoute,
            currentLocation: currentCity,
          },
          driver: driver
            ? {
                _id: driver._id,
                name: driver.name,
                phone: driver.phone,
              }
            : null,
          tripType: isReturn ? "return" : "new",
        };
      });

    res.json({
      success: true,
      date,
      total: availablePairs.length,
      pairs: availablePairs,
    });

  } catch (error) {
    console.error("[ERROR] getAvailableTruckDriverPairs:", error);
    res.status(500).json({
      message: error.message,
    });
  }
};

// ================= ADD TRUCK =================
exports.addTruck = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const {
      truckNumber,
      capacity,
      type,
      usualRoute,
      currentLocation,
      pricing,
    } = req.body;

    // 🔍 validation
    if (
      !truckNumber ||
      !capacity ||
      !type ||
      !usualRoute?.from ||
      !usualRoute?.to ||
      !pricing?.normalPrice ||
      !pricing?.returnPrice
    ) {
      return res.status(400).json({
        message:
          "All fields required: truckNumber, capacity, type, usualRoute (from, to), pricing (normalPrice, returnPrice)",
      });
    }

    // 🔍 check duplicate truck number
    const existingTruck = await Truck.findOne({
      truckNumber: truckNumber.toUpperCase(),
    });

    if (existingTruck) {
      return res.status(400).json({
        message: "Truck number already exists",
      });
    }

    // 🚛 create truck
    const truck = await Truck.create({
      ownerId,
      truckNumber: truckNumber.trim().toUpperCase(),
      capacity,
      type,
      usualRoute: {
        from: usualRoute.from.toLowerCase().trim(),
        to: usualRoute.to.toLowerCase().trim(),
      },
      currentLocation: {
        city: currentLocation?.city
          ? currentLocation.city.toLowerCase().trim()
          : usualRoute.from.toLowerCase().trim(),
        coordinates: currentLocation?.coordinates || [0, 0],
      },
      pricing: {
        normalPrice: pricing.normalPrice,
        returnPrice: pricing.returnPrice,
      },
      availability: "available",
    });

    res.status(201).json({
      message: "Truck added successfully",
      truck,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
};

// ================= ADD TRUCK DRIVER =================
exports.addDriver = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { name, email, phone, password, truckId } = req.body;

    // 🔍 validation
    if (!name || (!email && !phone) || !password) {
      return res.status(400).json({
        message: "Name, (email or phone), and password are required",
      });
    }

    // 🔐 password length check
    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    // 🔍 check duplicate email/phone
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (existingUser) {
      return res.status(400).json({
        message: "User with this email or phone already exists",
      });
    }

    // 🔍 validate truck belongs to owner (if truckId provided)
    if (truckId) {
      const truck = await Truck.findById(truckId);

      if (!truck || truck.ownerId.toString() !== ownerId.toString()) {
        return res.status(403).json({
          message: "Truck not found or does not belong to you",
        });
      }
    }

    // 👨‍✈️ create driver (password will be hashed via pre-save hook)
    const driver = await User.create({
      name,
      email,
      phone,
      password, // 🔥 will be hashed by pre-save hook in userModel
      role: "driver",
      truckOwnerId: ownerId,
      assignedTruckId: truckId || null,
      createdBy: ownerId,
    });

    res.status(201).json({
      message: "Driver added successfully",
      driver: {
        _id: driver._id,
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
        assignedTruckId: driver.assignedTruckId,
      },
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
};

// ================= ADD TRUCK + DRIVER (COMBINED) =================
exports.addTruckWithDriver = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const {
      truckNumber,
      capacity,
      type,
      usualRoute,
      currentLocation,
      pricing,
      driver,
    } = req.body;

    // 🔍 truck validation
    if (
      !truckNumber ||
      !capacity ||
      !type ||
      !usualRoute?.from ||
      !usualRoute?.to ||
      !pricing?.normalPrice ||
      !pricing?.returnPrice
    ) {
      return res.status(400).json({
        message:
          "Truck fields required: truckNumber, capacity, type, usualRoute (from, to), pricing (normalPrice, returnPrice)",
      });
    }

    // 🔍 driver validation
    if (!driver || !driver.name || (!driver.email && !driver.phone) || !driver.password) {
      return res.status(400).json({
        message: "Driver fields required: name, (email or phone), password",
      });
    }

    // 🔐 password length check
    if (driver.password.length < 6) {
      return res.status(400).json({
        message: "Driver password must be at least 6 characters",
      });
    }

    // 🔍 check duplicate truck number
    const existingTruck = await Truck.findOne({
      truckNumber: truckNumber.toUpperCase(),
    });

    if (existingTruck) {
      return res.status(400).json({
        message: "Truck number already exists",
      });
    }

    // 🔍 check duplicate driver email/phone
    const existingDriver = await User.findOne({
      $or: [{ email: driver.email }, { phone: driver.phone }],
    });

    if (existingDriver) {
      return res.status(400).json({
        message: "Driver with this email or phone already exists",
      });
    }

    // 🚛 create truck
    const createdTruck = await Truck.create({
      ownerId,
      truckNumber: truckNumber.trim().toUpperCase(),
      capacity,
      type,
      usualRoute: {
        from: usualRoute.from.toLowerCase().trim(),
        to: usualRoute.to.toLowerCase().trim(),
      },
      currentLocation: {
        city: currentLocation?.city
          ? currentLocation.city.toLowerCase().trim()
          : usualRoute.from.toLowerCase().trim(),
        coordinates: currentLocation?.coordinates || [0, 0],
      },
      pricing: {
        normalPrice: pricing.normalPrice,
        returnPrice: pricing.returnPrice,
      },
      availability: "available",
    });

    // 👨‍✈️ create driver with truck assignment
    const createdDriver = await User.create({
      name: driver.name,
      email: driver.email,
      phone: driver.phone,
      password: driver.password, // 🔥 will be hashed by pre-save hook
      role: "driver",
      truckOwnerId: ownerId,
      assignedTruckId: createdTruck._id, // 🔥 AUTO ASSIGN
      createdBy: ownerId,
    });

    res.status(201).json({
      message: "Truck and driver added & assigned successfully",
      truck: createdTruck,
      driver: {
        _id: createdDriver._id,
        name: createdDriver.name,
        email: createdDriver.email,
        phone: createdDriver.phone,
        assignedTruckId: createdDriver.assignedTruckId,
      },
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
};

// ================= ADD MULTIPLE TRUCKS + MULTIPLE DRIVERS =================
exports.addMultipleTrucksAndDrivers = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { trucks = [], drivers = [] } = req.body;

    // 🔍 validation
    if (trucks.length === 0 || drivers.length === 0) {
      return res.status(400).json({
        message: "At least 1 truck and 1 driver required",
      });
    }

    // 🔍 validate trucks
    trucks.forEach((t, index) => {
      if (
        !t.truckNumber ||
        !t.capacity ||
        !t.type ||
        !t.usualRoute?.from ||
        !t.usualRoute?.to ||
        !t.pricing?.normalPrice ||
        !t.pricing?.returnPrice
      ) {
        throw new Error(
          `Invalid truck data at index ${index}: all required fields missing`
        );
      }
    });

    // 🔍 validate drivers
    drivers.forEach((d, index) => {
      if (!d.name || (!d.email && !d.phone) || !d.password) {
        throw new Error(
          `Invalid driver data at index ${index}: name, (email or phone), and password required`
        );
      }

      if (d.password.length < 6) {
        throw new Error(
          `Driver at index ${index}: password must be at least 6 characters`
        );
      }

      if (typeof d.truckIndex !== "number" || d.truckIndex >= trucks.length) {
        throw new Error(
          `Driver at index ${index}: invalid truckIndex (must be 0-${trucks.length - 1})`
        );
      }
    });

    // 🔍 check duplicate truck numbers
    const truckNumbers = trucks.map((t) => t.truckNumber.toUpperCase());
    const duplicateTrucks = await Truck.find({
      truckNumber: { $in: truckNumbers },
    });

    if (duplicateTrucks.length > 0) {
      return res.status(400).json({
        message: `Truck(s) already exist: ${duplicateTrucks
          .map((t) => t.truckNumber)
          .join(", ")}`,
      });
    }

    // 🔍 check duplicate driver emails/phones
    const driverEmails = drivers
      .filter((d) => d.email)
      .map((d) => d.email);
    const driverPhones = drivers
      .filter((d) => d.phone)
      .map((d) => d.phone);

    const duplicateDrivers = await User.find({
      $or: [
        { email: { $in: driverEmails } },
        { phone: { $in: driverPhones } },
      ],
    });

    if (duplicateDrivers.length > 0) {
      return res.status(400).json({
        message: `User(s) already exist with email/phone: ${duplicateDrivers
          .map((d) => d.email || d.phone)
          .join(", ")}`,
      });
    }

    // 🚛 create trucks
    const truckDocs = trucks.map((t) => ({
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
    }));

    const createdTrucks = await Truck.insertMany(truckDocs);

    // 👨‍✈️ create drivers (password will be hashed via pre-save hook)
    const createdDrivers = [];

    for (let i = 0; i < drivers.length; i++) {
      const d = drivers[i];
      const assignedTruck = createdTrucks[d.truckIndex];

      const driver = await User.create({
        name: d.name,
        email: d.email,
        phone: d.phone,
        password: d.password, // 🔥 will be hashed by pre-save hook in userModel
        role: "driver",
        truckOwnerId: ownerId,
        assignedTruckId: assignedTruck._id,
        createdBy: ownerId,
        verificationStatus: "approved",
      });

      createdDrivers.push(driver);
    }

    res.status(201).json({
      message: "Multiple trucks and drivers added successfully",
      total: {
        trucks: createdTrucks.length,
        drivers: createdDrivers.length,
      },
      trucks: createdTrucks,
      drivers: createdDrivers.map((d) => ({
        _id: d._id,
        name: d.name,
        email: d.email,
        phone: d.phone,
        assignedTruckId: d.assignedTruckId,
      })),
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
};