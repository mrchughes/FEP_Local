// backend/routes/aiAgentRoutes.js
const express = require("express");
const { getSuggestions } = require("../controllers/aiAgentController");
const { extractFormData } = require("../controllers/aiAgentController.extract");
const { protect } = require("../middlewares/authMiddleware");
const router = express.Router();

// POST /api/ai-agent/suggest - Get AI suggestions based on form data
router.post("/suggest", protect, getSuggestions);

// POST /api/ai-agent/extract - Extract data from uploaded evidence
router.post("/extract", protect, extractFormData);

module.exports = router;
