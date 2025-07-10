// backend/routes/evidenceRoutes.js
const express = require("express");
const { uploadEvidence, deleteEvidence } = require("../controllers/evidenceController");
const { protect } = require("../middlewares/authMiddleware");
const router = express.Router();

router.post("/upload", protect, uploadEvidence);
router.delete("/:filename", protect, deleteEvidence);

module.exports = router;
