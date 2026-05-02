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

// 🗑️ Delete Requirement
exports.deleteRequirement = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user._id;

    // 🔍 Find requirement
    const requirement = await Requirement.findById(id);

    if (!requirement) {
      return res.status(404).json({ message: "Requirement not found" });
    }

    // ✅ Check if requirement belongs to the company
    if (requirement.companyId.toString() !== companyId.toString()) {
      return res.status(403).json({ message: "Unauthorized to delete this requirement" });
    }

    // 🗑️ Delete requirement
    await Requirement.findByIdAndDelete(id);

    res.json({ message: "Requirement deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};