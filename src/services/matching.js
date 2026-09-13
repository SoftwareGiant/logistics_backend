const Truck = require("../models/truckModel");
const Requirement = require("../models/requirementModel");
const { computeOwnerPayout } = require("./pricing");

// A requirement is matched to trucks within this radius of its pickup point.
const RADIUS_METERS = 10 * 1000; // 10 km

// A live location is only trusted for matching if it was updated within this window.
// Older than this → we fall back to the truck's base location.
const FRESH_MS = 24 * 60 * 60 * 1000; // 24 hours

// Accepts either a GeoJSON sub-object ({ type: "Point", coordinates: [lng, lat] })
// or a raw [lng, lat] pair and returns a GeoJSON point (or null).
function toPoint(value) {
  if (!value) return null;
  if (Array.isArray(value) && value.length === 2) {
    return { type: "Point", coordinates: value };
  }
  if (Array.isArray(value.coordinates) && value.coordinates.length === 2) {
    return { type: "Point", coordinates: value.coordinates };
  }
  return null;
}

function requirementPickupPoint(requirement) {
  return toPoint(requirement?.pickupCity?.coordinates);
}

function isRequirementLive(requirement) {
  if (!requirement || requirement.status !== "active") return false;
  if (!requirement.expiresAt) return true;
  return new Date(requirement.expiresAt).getTime() >= Date.now();
}

/**
 * Company side: given a requirement, find every truck that matches it.
 * Match rules: verified owner + available + exact truck type + capacity >= weight
 * + within RADIUS_METERS of the pickup point (fresh live location, else base location).
 */
async function findMatchingTrucks(requirement, { excludeOwnerId } = {}) {
  const near = requirementPickupPoint(requirement);
  if (!near || !requirement.truckType || requirement.weight == null) {
    return [];
  }

  const freshSince = new Date(Date.now() - FRESH_MS);

  const baseMatch = {
    verified: true,
    availability: "available",
    type: requirement.truckType,
    capacity: { $gte: Number(requirement.weight) },
  };
  if (excludeOwnerId) {
    baseMatch.ownerId = { $ne: excludeOwnerId };
  }

  // 1) Trucks with a FRESH live location inside the radius.
  const liveMatches = await Truck.aggregate([
    {
      $geoNear: {
        near,
        key: "currentLocation.coordinates",
        distanceField: "distanceMeters",
        maxDistance: RADIUS_METERS,
        spherical: true,
        query: { ...baseMatch, "currentLocation.updatedAt": { $gte: freshSince } },
      },
    },
  ]);

  // 2) Trucks whose live location isn't trustworthy → fall back to their base
  // location. "Not trustworthy" means stale/missing updatedAt, OR a fresh
  // updatedAt with no usable coordinates (e.g. right after a trip is marked
  // delivered). A truck with a FRESH, VALID live location that's simply too
  // far away must NOT fall back to base — we know exactly where it is, and
  // it isn't here, so it should be excluded rather than matched via a stale
  // "home base" it may be nowhere near right now.
  const baseMatches = await Truck.aggregate([
    {
      $geoNear: {
        near,
        key: "baseLocation.coordinates",
        distanceField: "distanceMeters",
        maxDistance: RADIUS_METERS,
        spherical: true,
        query: {
          ...baseMatch,
          $or: [
            { "currentLocation.updatedAt": { $exists: false } },
            { "currentLocation.updatedAt": { $lt: freshSince } },
            { "currentLocation.coordinates": { $exists: false } },
            { "currentLocation.coordinates": { $size: 0 } },
          ],
        },
      },
    },
  ]);

  const results = [
    ...liveMatches.map((t) => ({ ...t, locationSource: "live" })),
    ...baseMatches.map((t) => ({ ...t, locationSource: "base" })),
  ];

  results.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return results;
}

/**
 * Truck-owner side: the reverse lookup — live, non-expired requirements that match
 * any of the owner's verified, available trucks.
 */
async function findMatchingRequirementsForOwner(ownerId) {
  const trucks = await Truck.find({
    ownerId,
    verified: true,
    availability: "available",
  }).lean();

  if (!trucks.length) return [];

  const now = new Date();
  const freshSince = new Date(Date.now() - FRESH_MS);
  const seen = new Map();

  for (const truck of trucks) {
    const liveFresh =
      truck.currentLocation?.updatedAt &&
      new Date(truck.currentLocation.updatedAt) >= freshSince;

    const livePoint = liveFresh ? toPoint(truck.currentLocation?.coordinates) : null;
    const point = livePoint || toPoint(truck.baseLocation?.coordinates);
    if (!point) continue;

    const reqs = await Requirement.find({
      status: "active",
      expiresAt: { $gte: now },
      truckType: truck.type,
      weight: { $lte: truck.capacity },
      "pickupCity.coordinates": {
        $near: { $geometry: point, $maxDistance: RADIUS_METERS },
      },
    })
      .populate("companyId", "name phone")
      .lean();

    for (const r of reqs) {
      if (!seen.has(String(r._id))) {
        const { ownerPayout, commissionPercent } = computeOwnerPayout(r.budget);
        seen.set(String(r._id), {
          ...r,
          ownerPayout,
          commissionPercent,
          matchedTruck: {
            _id: truck._id,
            truckNumber: truck.truckNumber,
            type: truck.type,
            capacity: truck.capacity,
          },
          locationSource: livePoint ? "live" : "base",
        });
      }
    }
  }

  return [...seen.values()];
}

module.exports = {
  RADIUS_METERS,
  FRESH_MS,
  toPoint,
  isRequirementLive,
  findMatchingTrucks,
  findMatchingRequirementsForOwner,
};
