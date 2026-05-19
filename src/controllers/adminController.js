const mongoose = require("mongoose");
const Booking = require("../models/bookingModel");
const Truck = require("../models/truckModel");
const User = require("../models/userModel");
const Company = require("../models/companyModel");
const Requirement = require("../models/requirementModel");
const Offer = require("../models/offerModel");

const parsePagination = (query) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.max(Number(query.limit) || 10, 1);

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
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
                coordinates: company?.location?.coordinates,
              },

              // 🔥 FULL REPRESENTATIVES
              representatives: company?.representatives || [],
            },
          };
        }

        // ================= TRUCK OWNER =================
        if (user.role === "truck_owner") {

          const trucks = await Truck.find({
            ownerId: user._id,
          }).lean();

          const drivers = await User.find({
            truckOwnerId: user._id,
            role: "driver",
          })
            .select("-password")
            .lean();

          // 🔥 map driver to truck
          const driverMap = {};
          drivers.forEach((d) => {
            if (d.assignedTruckId) {
              driverMap[d.assignedTruckId.toString()] = d;
            }
          });

          const trucksWithDrivers = trucks.map((t) => ({
            ...t,
            driver: driverMap[t._id.toString()] || null,
          }));

          return {
            ...user,

            ownerDetails: {
              trucks: trucksWithDrivers, // 🔥 FULL TRUCK + DRIVER
              drivers, // 🔥 ALL DRIVERS
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

          const dbRepresentatives = await User.find({
            role: "company_staff",
            createdBy: user._id,
          })
            .select("-password")
            .lean();

          const representatives = dbRepresentatives.length > 0 ? dbRepresentatives : (company?.representatives || []);

          return {
            ...user,

            companyDetails: {
              companyName: company?.companyName,
              gstNumber: company?.gstNumber,

              location: {
                city: company?.location?.city,
                state: company?.location?.state,
                coordinates: company?.location?.coordinates,
              },

              representatives,
            },
          };
        }

        // ================= TRUCK OWNER =================
        if (user.role === "truck_owner") {

          const trucks = await Truck.find({
            ownerId: user._id,
          }).lean();

          const drivers = await User.find({
            truckOwnerId: user._id,
            role: "driver",
          })
            .select("-password")
            .populate("assignedTruckId")
            .lean();

          const driverMap = {};

          drivers.forEach((d) => {
            if (d.assignedTruckId) {
              driverMap[d.assignedTruckId.toString()] = d;
            }
          });

          const trucksWithDrivers = trucks.map((t) => ({
            ...t,
            driver: driverMap[t._id.toString()] || null,
          }));

          return {
            ...user,

            ownerDetails: {
              trucks: trucksWithDrivers,
              drivers,
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

          const dbRepresentatives = await User.find({
            role: "company_staff",
            createdBy: user._id,
          })
            .select("-password")
            .lean();

          const representatives = dbRepresentatives.length > 0 ? dbRepresentatives : (company?.representatives || []);

          return {
            ...user,

            companyDetails: {
              companyName: company?.companyName,
              gstNumber: company?.gstNumber,

              location: {
                city: company?.location?.city,
                state: company?.location?.state,
                coordinates: company?.location?.coordinates,
              },

              representatives,
            },
          };
        }

        // ================= TRUCK OWNER =================
        if (user.role === "truck_owner") {

          const trucks = await Truck.find({
            ownerId: user._id,
          }).lean();

          const drivers = await User.find({
            truckOwnerId: user._id,
            role: "driver",
          })
            .select("-password")
            .populate("assignedTruckId")
            .lean();

          const driverMap = {};

          drivers.forEach((d) => {
            if (d.assignedTruckId) {
              driverMap[d.assignedTruckId.toString()] = d;
            }
          });

          const trucksWithDrivers = trucks.map((t) => ({
            ...t,
            driver: driverMap[t._id.toString()] || null,
          }));

          return {
            ...user,

            ownerDetails: {
              trucks: trucksWithDrivers,
              drivers,
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

    const [companies, representatives] = await Promise.all([
      Company.find({ userId: { $in: ownerIds } }).lean(),
      User.find({
        role: "company_staff",
        verificationStatus: "approved",
        createdBy: { $in: ownerIds },
      })
        .select("-password")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const companyMap = new Map(
      companies.map((company) => [company.userId.toString(), company])
    );

    const representativesByOwner = representatives.reduce((acc, rep) => {
      const ownerId = rep.createdBy?.toString();

      if (!ownerId) {
        return acc;
      }

      if (!acc[ownerId]) {
        acc[ownerId] = [];
      }

      acc[ownerId].push(rep);
      return acc;
    }, {});

    const companyOwners = owners.map((owner) => {
      const company = companyMap.get(owner._id.toString()) || null;
      const representatives =
        representativesByOwner[owner._id.toString()] ||
        company?.representatives ||
        [];

      return {
        owner,
        company: company
          ? {
              ...company,
              representatives,
            }
          : {
              representatives,
            },
      };
    });

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

exports.getApprovedTruckOwners = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const query = {
      role: "truck_owner",
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

    const [trucks, drivers] = await Promise.all([
      Truck.find({ ownerId: { $in: ownerIds } }).sort({ createdAt: -1 }).lean(),
      User.find({
        role: "driver",
        verificationStatus: "approved",
        truckOwnerId: { $in: ownerIds },
      })
        .select("-password")
        .populate("assignedTruckId")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const trucksByOwner = trucks.reduce((acc, truck) => {
      const ownerId = truck.ownerId?.toString();

      if (!ownerId) {
        return acc;
      }

      if (!acc[ownerId]) {
        acc[ownerId] = [];
      }

      acc[ownerId].push(truck);
      return acc;
    }, {});

    const driversByOwner = drivers.reduce((acc, driver) => {
      const ownerId = driver.truckOwnerId?.toString();

      if (!ownerId) {
        return acc;
      }

      if (!acc[ownerId]) {
        acc[ownerId] = [];
      }

      acc[ownerId].push(driver);
      return acc;
    }, {});

    const truckOwners = owners.map((owner) => ({
      owner,
      trucks: trucksByOwner[owner._id.toString()] || [],
      drivers: driversByOwner[owner._id.toString()] || [],
    }));

    res.json({
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      truckOwners,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};


exports.getAllFleetStatus = async (req, res) => {
  try {
    let { page = 1, limit = 10, from, to, date } = req.query;

    page = Number(page);
    limit = Number(limit);

    const skip = (page - 1) * limit;

    // ================= FILTER QUERY =================
    let truckQuery = {};

    if (from) {
      truckQuery["usualRoute.from"] = from.toLowerCase().trim();
    }

    if (to) {
      truckQuery["usualRoute.to"] = to.toLowerCase().trim();
    }

    // ================= TOTAL =================
    const total = await Truck.countDocuments(truckQuery);

    const trucks = await Truck.find(truckQuery)
      .populate("ownerId", "name phone verificationStatus")
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

      const isAvailableForNewTrip =
        t.availability === "available" &&
        currentCity === t.usualRoute.from;

      const isAvailableForReturnTrip =
        t.availability === "busy" &&
        currentCity !== t.usualRoute.from;

      if (isAvailableForReturnTrip) tripType = "return";

      return {
        _id: t._id,

        truckNumber: t.truckNumber,
        type: t.type,
        capacity: t.capacity,

        currentLocation: t.currentLocation,

        route: {
          from: t.usualRoute.from,
          to: t.usualRoute.to,
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
        pricing: t.pricing || { normalPrice: 0, returnPrice: 0 },
      };
    });

    res.json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      filters: { from, to, date },
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
exports.getAllBookingsAdmin = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      status,
      tripType, // return / fresh
      search,   // optional (truckNumber / company name later)
      sort = "latest",
    } = req.query;

    page = Number(page);
    limit = Number(limit);

    // ================= FILTER =================
    let query = {};

    if (status) {
      query.status = status; // pending / accepted / completed / cancelled
    }

    if (tripType === "return") {
      query.isReturnTrip = true;
    }

    if (tripType === "fresh") {
      query.isReturnTrip = false;
    }

    // ================= SEARCH (basic) =================
    if (search) {
      query.$or = [
        { truckNumber: { $regex: search, $options: "i" } },
      ];
    }

    // ================= SORT =================
    let sortOption = { createdAt: -1 }; // default latest

    if (sort === "oldest") {
      sortOption = { createdAt: 1 };
    }

    // ================= QUERY =================
    const total = await Booking.countDocuments(query);

const bookings = await Booking.find(query)
      .populate("companyId", "name phone email  ")
      .populate("truckId", "truckNumber type capacity")
      .populate("driverId", "name phone")
      .sort(sortOption)
      .skip((page - 1) * limit)
      .limit(limit);

    // ================= RESPONSE =================
    res.json({
      total,
      page,
      pages: Math.ceil(total / limit),
      bookings,
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

    const total = await Requirement.countDocuments(query);

    const requirements = await Requirement.find(query)
      .populate("companyId", "name email phone")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // 🔥 offer count
    const ids = requirements.map((r) => r._id);

    const offerCounts = await Offer.aggregate([
      { $match: { requirementId: { $in: ids } } },
      { $group: { _id: "$requirementId", count: { $sum: 1 } } },
    ]);

    const countMap = {};
    offerCounts.forEach((o) => {
      countMap[o._id] = o.count;
    });

    // 🔥 FINAL FORMAT (FULL DATA)
    const data = requirements.map((r) => ({
      _id: r._id,

      // 📍 ROUTE
      pickupCity: r.pickupCity,
      dropCity: r.dropCity,

      // 📦 DETAILS
      goodsType: r.goodsType,
      weight: r.weight,
      truckType: r.truckType,
      preferredDate: r.preferredDate,
      additionalNotes: r.additionalNotes,

      // 🏢 COMPANY
      company: {
        _id: r.companyId?._id,
        name: r.companyId?.name,
        email: r.companyId?.email,
        phone: r.companyId?.phone,
      },

      // 📊 META
      status: r.status,
      offerCount: countMap[r._id] || 0,

      createdAt: r.createdAt,
    }));

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

exports.getRequirementOffersAdmin = async (req, res) => {
  try {
    const { requirementId } = req.params;

    const requirement = await Requirement.findById(requirementId);

    if (!requirement) {
      return res.status(404).json({ message: "Requirement not found" });
    }

    const offers = await Offer.find({ requirementId })
      .populate("truckOwnerId", "name phone")
      .populate("truckId")
      .populate("driverId", "name phone")
      .lean();

    const formatted = offers.map((o) => {
      const t = o.truckId;

      const isReturn =
        t.usualRoute.from === requirement.dropCity.city &&
        t.usualRoute.to === requirement.pickupCity.city;

      const price = isReturn
        ? t.pricing.returnPrice
        : t.pricing.normalPrice;

      return {
        _id: o._id,

        truckOwner: o.truckOwnerId,
        driver: o.driverId,

        truck: {
          _id: t._id,
          truckNumber: t.truckNumber,
          capacity: t.capacity,
          type: t.type,
        },

        isReturn,
        price,
        status: o.status,
      };
    });

    res.json({
      requirement: {
        _id: requirement._id,
        pickupCity: requirement.pickupCity,
        dropCity: requirement.dropCity,
        goodsType: requirement.goodsType,
        weight: requirement.weight,
        truckType: requirement.truckType,
        preferredDate: requirement.preferredDate,
        status: requirement.status,
      },
      total: formatted.length,
      data: formatted,
      offers: formatted,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
