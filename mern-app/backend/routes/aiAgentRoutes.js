// backend/routes/aiAgentRoutes.js
const express = require("express");
const { getSuggestions } = require("../controllers/aiAgentController");
const { protect } = require("../middlewares/authMiddleware");
const router = express.Router();

router.post("/suggest", protect, getSuggestions);

module.exports = router;
