const mongoose = require("mongoose");
const Booking = require("../models/bookingModel");
const Truck = require("../models/truckModel");
const User = require("../models/userModel");
const Company = require("../models/companyModel");

// ================= GET PENDING USERS =================

exports.getPendingUsers = async (req, res) => {
  try {
    let { page = 1, limit = 10, role } = req.query;

    page = Number(page);
    limit = Number(limit);

    // ================= FILTER =================
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

    // ================= ENRICH DATA =================
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
              location: company?.location?.city || "N/A",
              gstNumber: company?.gstNumber || "N/A",
              representativesCount: company?.representatives?.length || 0,
            },
          };
        }

        // ================= TRUCK OWNER =================
        if (user.role === "truck_owner") {
          const trucksCount = await Truck.countDocuments({
            ownerId: user._id,
          });

          const driversCount = await User.countDocuments({
            truckOwnerId: user._id,
            role: "driver",
          });

          return {
            ...user,
            ownerDetails: {
              trucksCount,
              driversCount,
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
      updatedAt: { $gte: todayStart, $lte: todayEnd },
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
      .populate("companyId", "companyName")
      .populate("truckId", "truckNumber type capacity")
      .populate("driverId", "name phone")
      .populate("truckOwnerId", "name phone")
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