// backend/controllers/evidenceController.js
const asyncHandler = require("express-async-handler");
const path = require("path");
const fs = require("fs");

// Directory to store uploads (ensure this exists or create it)
const UPLOAD_DIR = path.join(__dirname, "../../uploads/evidence");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// POST /api/evidence/upload
const uploadEvidence = asyncHandler(async (req, res) => {
    if (!req.files || !req.files.evidence) {
        res.status(400);
        throw new Error("No file uploaded");
    }
    const file = req.files.evidence;
    const savePath = path.join(UPLOAD_DIR, file.name);
    await file.mv(savePath);
    res.json({ name: file.name, url: `/uploads/evidence/${file.name}` });
});

// DELETE /api/evidence/:filename
const deleteEvidence = asyncHandler(async (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(UPLOAD_DIR, filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ message: "File deleted" });
    } else {
        res.status(404);
        throw new Error("File not found");
    }
});

module.exports = { uploadEvidence, deleteEvidence };
