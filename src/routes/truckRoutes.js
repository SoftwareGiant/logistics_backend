const express = require("express");
const router = express.Router();

const { searchTrucks } = require("../controllers/truckController");

router.get("/search", searchTrucks);

module.exports = router;