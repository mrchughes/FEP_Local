// backend/routes/evidenceRoutes.js
const express = require("express");
const { uploadEvidence, deleteEvidence, listEvidence } = require("../controllers/evidenceController");
const { protect } = require("../middlewares/authMiddleware");
const router = express.Router();

// Evidence routes
router.post("/upload", protect, uploadEvidence);
router.delete("/:filename", protect, deleteEvidence);
router.get("/list", protect, listEvidence);

module.exports = router;
