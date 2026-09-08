const mongoose = require("mongoose");
const Booking = require("../models/bookingModel");
const Truck = require("../models/truckModel");
const User = require("../models/userModel");
const Company = require("../models/companyModel");
const Requirement = require("../models/requirementModel");

const parsePagination = (query) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.max(Number(query.limit) || 10, 1);

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

// No platform markup — the company sets the price (requirement budget) directly.
const getCompanyPrice = (actualPrice) => {
  const price = Number(actualPrice);
  return Number.isNaN(price) ? 0 : price;
};

const markupTruck = (t) => {
  if (!t) return t;
  return t.toObject ? t.toObject() : { ...t };
};

// ================= GET PENDING USERS =================

exports.getPendingUsers = async (req, res) => {
  try {
    let { page = 1, limit = 10, role } = req.query;

    page = Number(page);
    limit = Number(limit);

    let query = {
      verificationStatus: "pending",
      role: { $in: ["company", "truck_owner"] },
    };

    if (role && ["company", "truck_owner"].includes(role)) {
      query.role = role;
    }

    const total = await User.countDocuments(query);

    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // ================= ENRICH =================
    const enrichedUsers = await Promise.all(
      users.map(async (user) => {

        // ================= COMPANY =================
        if (user.role === "company") {
          const company = await Company.findOne({
            userId: user._id,
          }).lean();

          return {
            ...user,

            companyDetails: {
              companyName: company?.companyName,
              gstNumber: company?.gstNumber,

              location: {
                city: company?.location?.city,
                state: company?.location?.state,
                address: company?.location?.address,
                coordinates: company?.location?.coordinates,
              },
            },
          };
        }

        // ================= TRUCK OWNER =================
        if (user.role === "truck_owner") {

          const trucks = await Truck.find({
            ownerId: user._id,
          }).lean();

          return {
            ...user,
            ownerDetails: {
              trucks: trucks.map(markupTruck),
              trucksCount: trucks.length,
            },
          };
        }

        return user;
      })
    );

    res.json({
      total,
      page,
      pages: Math.ceil(total / limit),
      users: enrichedUsers,
    });

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

exports.getApprovedUsers = async (req, res) => {
  try {
    let { page = 1, limit = 10, role } = req.query;

    page = Number(page);
    limit = Number(limit);

    if (Number.isNaN(page) || page < 1) page = 1;
    if (Number.isNaN(limit) || limit < 1) limit = 10;

    // Latest -> oldest (pagination must be consistent, so sort in DB)
    const query = {
      verificationStatus: "approved",
      role: { $in: ["company", "truck_owner"] },
    };

    if (role && ["company", "truck_owner"].includes(role)) {
      query.role = role;
    }

    const total = await User.countDocuments(query);

    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // ================= ENRICH =================
    const enrichedUsers = await Promise.all(
      users.map(async (user) => {

        // ================= COMPANY =================
        if (user.role === "company") {

          const company = await Company.findOne({
            userId: user._id,
          }).lean();

          return {
            ...user,

            companyDetails: {
              companyName: company?.companyName,
              gstNumber: company?.gstNumber,

              location: {
                city: company?.location?.city,
                state: company?.location?.state,
                address: company?.location?.address,
                coordinates: company?.location?.coordinates,
              },
            },
          };
        }

        // ================= TRUCK OWNER =================
        if (user.role === "truck_owner") {

          const trucks = await Truck.find({
            ownerId: user._id,
          }).lean();

          return {
            ...user,
            ownerDetails: {
              trucks: trucks.map(markupTruck),
              trucksCount: trucks.length,
            },
          };
        }

        return user;
      })
    );

    res.json({
      total,
      page,
      pages: Math.ceil(total / limit),
      users: enrichedUsers,
    });

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
exports.getRejectedUsers = async (req, res) => {
  try {
    let { page = 1, limit = 10, role } = req.query;

    page = Number(page);
    limit = Number(limit);

    let query = {
      verificationStatus: "rejected",
      role: { $in: ["company", "truck_owner"] },
    };

    if (role && ["company", "truck_owner"].includes(role)) {
      query.role = role;
    }

    const total = await User.countDocuments(query);

    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // ================= ENRICH =================
    const enrichedUsers = await Promise.all(
      users.map(async (user) => {

        // ================= COMPANY =================
        if (user.role === "company") {

          const company = await Company.findOne({
            userId: user._id,
          }).lean();

          return {
            ...user,

            companyDetails: {
              companyName: company?.companyName,
              gstNumber: company?.gstNumber,

              location: {
                city: company?.location?.city,
                state: company?.location?.state,
                address: company?.location?.address,
                coordinates: company?.location?.coordinates,
              },
            },
          };
        }

        // ================= TRUCK OWNER =================
        if (user.role === "truck_owner") {

          const trucks = await Truck.find({
            ownerId: user._id,
          }).lean();

          return {
            ...user,
            ownerDetails: {
              trucks: trucks.map(markupTruck),
              trucksCount: trucks.length,
            },
          };
        }

        return user;
      })
    );

    res.json({
      total,
      page,
      pages: Math.ceil(total / limit),
      users: enrichedUsers,
    });

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
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


    if (user.role === "truck_owner") {
      const drivers = await User.find({
        truckOwnerId: user._id,
        role: "driver",
      }).session(session);

      for (const driver of drivers) {
        driver.verificationStatus = "approved";
        await driver.save({ session });
      }

      // ✅ Flag this owner's trucks as verified so they become eligible for matching
      await Truck.updateMany(
        { ownerId: user._id },
        { verified: true },
        { session }
      );
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

    if (user.role === "truck_owner") {
      await Truck.updateMany({ ownerId: user._id }, { verified: false });
    }

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

exports.getApprovedCompanyOwners = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const query = {
      role: "company",
      verificationStatus: "approved",
    };

    const total = await User.countDocuments(query);

    const owners = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const ownerIds = owners.map((owner) => owner._id);

    const companies = await Company.find({ userId: { $in: ownerIds } }).lean();
    const companyMap = new Map(
      companies.map((company) => [company.userId.toString(), company])
    );

    const companyOwners = owners.map((owner) => ({
      owner,
      company: companyMap.get(owner._id.toString()) || null,
    }));

    res.json({
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      companyOwners,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};


exports.getAllFleetStatus = async (req, res) => {
  try {
    let { page = 1, limit = 10, owner, availability, verified, date } = req.query;

    page = Number(page);
    limit = Number(limit);

    const skip = (page - 1) * limit;

    // ================= FILTER QUERY =================
    let truckQuery = {};

    if (owner && owner.trim()) {
      const ownerIds = await User.find({
        role: "truck_owner",
        name: { $regex: owner.trim(), $options: "i" },
      }).distinct("_id");
      truckQuery.ownerId = { $in: ownerIds };
    }

    if (availability && ["available", "busy"].includes(availability)) {
      truckQuery.availability = availability;
    }

    if (verified === "true") truckQuery.verified = true;
    if (verified === "false") truckQuery.verified = { $ne: true };

    // ================= TOTAL =================
    const total = await Truck.countDocuments(truckQuery);

    const trucks = await Truck.find(truckQuery)
      .populate("ownerId", "name phone verificationStatus")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const truckIds = trucks.map((t) => t._id);

    // ================= DATE FILTER =================
    let bookingQuery = {
      truckId: { $in: truckIds },
      status: {
        $in: ["assigned", "en_route", "picked_up", "in_transit"],
      },
    };

    if (date) {
      const d = new Date(date);

      const start = new Date(d.setHours(0, 0, 0, 0));
      const end = new Date(d.setHours(23, 59, 59, 999));

      bookingQuery.pickupDate = { $gte: start, $lte: end };
    }

    const bookings = await Booking.find(bookingQuery)
      .populate("companyId", "name")
      .populate("driverId", "name phone")
      .lean();

    const bookingMap = {};
    bookings.forEach((b) => {
      bookingMap[b.truckId.toString()] = b;
    });

    // ================= FINAL DATA =================
    const data = trucks.map((t) => {
      const booking = bookingMap[t._id.toString()];
      const currentCity = t.currentLocation?.city;

      let status = "Available";
      let tripType = "new";

      let driver = null;
      let company = null;
      let goods = null;

      if (booking) {
        driver = booking.driverId || null;
        company = booking.companyId || null;
        goods = booking.goodsType || null;

        status =
          booking.status === "assigned" ? "Loading" : "In Transit";
      }

      const routeFrom = t.usualRoute?.from;

      const isAvailableForNewTrip =
        t.availability === "available" &&
        (!routeFrom || currentCity === routeFrom);

      const isAvailableForReturnTrip =
        t.availability === "busy" &&
        !!routeFrom &&
        currentCity !== routeFrom;

      if (isAvailableForReturnTrip) tripType = "return";

      return {
        _id: t._id,

        truckNumber: t.truckNumber,
        type: t.type,
        capacity: t.capacity,

        currentLocation: t.currentLocation,
        baseLocation: t.baseLocation,
        verified: !!t.verified,

        route: {
          from: t.usualRoute?.from,
          to: t.usualRoute?.to,
        },

        owner: {
          name: t.ownerId?.name,
          phone: t.ownerId?.phone,
          verified: t.ownerId?.verificationStatus === "approved",
        },

        driver: driver
          ? {
              name: driver.name,
              phone: driver.phone,
            }
          : null,

        company: company ? { name: company.name } : null,

        goodsType: goods,

        status,
        availability: t.availability,

        isAvailableForNewTrip,
        isAvailableForReturnTrip,
        tripType,
        images: t.images || [],
      };
    });

    res.json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      filters: { owner: owner || "", availability: availability || "", verified: verified || "" },
      data,
    });

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};


// exports.getDashboardStats = async (req, res) => {
//   try {
//     // ================= BASIC STATS =================

//     const totalTrips = await Booking.countDocuments();

//     const returnTrips = await Booking.countDocuments({
//       isReturnTrip: true,
//     });

//     const freshTrips = totalTrips - returnTrips;

//     const revenueAgg = await Booking.aggregate([
//       {
//         $group: {
//           _id: null,
//           total: { $sum: "$price" },
//         },
//       },
//     ]);

//     const totalRevenue = revenueAgg[0]?.total || 0;

//     const activeTrucks = await Truck.countDocuments({
//       availability: "busy",
//     });

//     const emptyTripReduction = totalTrips > 0
//       ? Math.round((returnTrips / totalTrips) * 100)
//       : 0;

//     // ================= MONTHLY TRIP DISTRIBUTION =================

//     const monthlyData = await Booking.aggregate([
//       {
//         $group: {
//           _id: {
//             month: { $month: "$createdAt" },
//             isReturn: "$isReturnTrip",
//           },
//           count: { $sum: 1 },
//         },
//       },
//     ]);

//     // format month-wise
//     const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

//     let monthlyTrips = months.map((m, i) => ({
//       month: m,
//       returnTrips: 0,
//       freshTrips: 0,
//     }));

//     monthlyData.forEach((item) => {
//       const monthIndex = item._id.month - 1;

//       if (item._id.isReturn) {
//         monthlyTrips[monthIndex].returnTrips = item.count;
//       } else {
//         monthlyTrips[monthIndex].freshTrips = item.count;
//       }
//     });

//     // ================= PIE CHART =================

//     const returnPercent = totalTrips > 0
//       ? Math.round((returnTrips / totalTrips) * 100)
//       : 0;

//     const freshPercent = 100 - returnPercent;

//     const tripTypeBreakdown = {
//       returnTrips: returnPercent,
//       freshTrips: freshPercent,
//     };

//     // ================= FINAL RESPONSE =================

//     res.json({
//       stats: {
//         totalTrips,
//         returnTrips,
//         freshTrips,
//         emptyTripReduction,
//         totalRevenue,
//         activeTrucks,
//       },
//       monthlyTrips,
//       tripTypeBreakdown,
//     });

//   } catch (error) {
//     res.status(500).json({
//       message: error.message,
//     });
//   }
// };
exports.getDashboardStats = async (req, res) => {
  try {

    // 🔥 today range
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // ================= STATS =================

    const pending = await User.countDocuments({
      verificationStatus: "pending",
      role: { $in: ["company", "truck_owner"] },
    });

    const approvedToday = await User.countDocuments({
      verificationStatus: "approved",
      // updatedAt: { $gte: todayStart, $lte: todayEnd },
      role: { $in: ["company", "truck_owner"] },
    });

    const rejected = await User.countDocuments({
      verificationStatus: "rejected",
      role: { $in: ["company", "truck_owner"] },
    });

    // ================= RESPONSE =================

    res.json({
      pending,
      approvedToday,
      rejected,
    });

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
exports.getAllRequirements = async (req, res) => {
  try {
    let { page = 1, limit = 10, status, search } = req.query;

    page = Number(page);
    limit = Number(limit);

    let query = {};

    if (status) query.status = status;

    if (search) {
      query.$or = [
        { pickupCity: { $regex: search, $options: "i" } },
        { dropCity: { $regex: search, $options: "i" } },
      ];
    }

    // Keep status truthful — flip elapsed active requirements to "expired".
    await Requirement.updateMany(
      { status: "active", expiresAt: { $lt: new Date() } },
      { status: "expired" }
    );

    const total = await Requirement.countDocuments(query);

    const requirements = await Requirement.find(query)
      .populate("companyId", "name email phone")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // 🔗 booking (truck + owner) for fulfilled requirements
    const fulfilledIds = requirements.filter((r) => r.status === "fulfilled").map((r) => r._id);
    const bookings = fulfilledIds.length
      ? await Booking.find({ requirementId: { $in: fulfilledIds } })
          .populate({
            path: "truckId",
            select: "truckNumber type capacity images ownerId",
            populate: { path: "ownerId", select: "name phone" },
          })
          .lean()
      : [];
    const bkMap = {};
    bookings.forEach((b) => {
      if (b.requirementId) bkMap[b.requirementId.toString()] = b;
    });

    const now = Date.now();
    const data = requirements.map((r) => {
      const bk = bkMap[r._id.toString()];
      const t = bk?.truckId;
      return {
        _id: r._id,

        pickupCity: r.pickupCity,
        dropCity: r.dropCity,

        goodsType: r.goodsType,
        weight: r.weight,
        truckType: r.truckType,
        preferredDate: r.preferredDate,
        preferredTime: r.preferredTime,
        budget: r.budget,
        additionalNotes: r.additionalNotes,

        company: {
          _id: r.companyId?._id,
          name: r.companyId?.name,
          email: r.companyId?.email,
          phone: r.companyId?.phone,
        },

        status: r.status,
        expiresAt: r.expiresAt,
        createdAt: r.createdAt,
        isExpired:
          r.status === "expired" ||
          (r.status === "active" && r.expiresAt && new Date(r.expiresAt).getTime() < now),
        booking: bk
          ? {
              _id: bk._id,
              status: bk.status,
              price: bk.price,
              createdAt: bk.createdAt,
              truck: t
                ? {
                    _id: t._id,
                    truckNumber: t.truckNumber,
                    type: t.type,
                    capacity: t.capacity,
                    images: t.images || [],
                    owner: t.ownerId
                      ? { _id: t.ownerId._id, name: t.ownerId.name, phone: t.ownerId.phone }
                      : null,
                  }
                : null,
            }
          : null,
      };
    });

    res.json({
      total,
      page,
      pages: Math.ceil(total / limit),
      requirements: data,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

