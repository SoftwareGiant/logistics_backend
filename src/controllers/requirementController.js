const Requirement = require("../models/requirementModel");
const Offer = require("../models/offerModel");

// ➕ Add Requirement
exports.addRequirement = async (req, res) => {
  try {
    const requirement = await Requirement.create({
      ...req.body,
      companyId: req.user._id,
    });

    res.status(201).json({ requirement });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 📋 My Requirements (with offer count)
exports.getMyRequirements = async (req, res) => {
  try {
    const companyId = req.user._id;

    const requirements = await Requirement.find({ companyId }).lean();

    const ids = requirements.map(r => r._id);

    const counts = await Offer.aggregate([
      { $match: { requirementId: { $in: ids } } },
      { $group: { _id: "$requirementId", count: { $sum: 1 } } }
    ]);

    const map = {};
    counts.forEach(c => map[c._id] = c.count);

    const data = requirements.map(r => ({
      ...r,
      offerCount: map[r._id] || 0,
    }));

    res.json({ requirements: data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};