// backend/controllers/evidenceController.js
const asyncHandler = require("express-async-handler");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");

// Directory to store uploads (ensure this exists or create it)
const UPLOAD_DIR = path.join(__dirname, "../uploads/evidence");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Create a directory for user-specific evidence if it doesn't exist
const ensureUserDir = (userId) => {
    const userDir = path.join(UPLOAD_DIR, userId);
    if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
    }
    return userDir;
};

// POST /api/evidence/upload
const uploadEvidence = asyncHandler(async (req, res) => {
    try {
        console.log("[EVIDENCE] Upload request received", req.files ? Object.keys(req.files) : "no files");

        if (!req.files || !req.files.evidence) {
            console.error("[EVIDENCE] No file in request");
            res.status(400);
            throw new Error("No file uploaded");
        }

        // Get user from auth middleware
        const userId = req.user._id;
        const userIdStr = userId.toString(); // Convert ObjectId to string
        console.log(`[EVIDENCE] Upload for user: ${userIdStr}`);

        // Ensure user directory exists
        const userDir = ensureUserDir(userIdStr);

        const file = req.files.evidence;
        console.log(`[EVIDENCE] Processing file upload: ${file.name}, size: ${file.size} bytes, mimetype: ${file.mimetype}`);

        // Validate using both file extension and MIME type for better security
        const fileExtension = path.extname(file.name).toLowerCase();
        const allowedExtensions = ['.docx', '.pdf', '.jpg', '.jpeg', '.png'];
        const allowedMimeTypes = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf', 'image/jpeg', 'image/png'];

        console.log(`[EVIDENCE] Validating file: extension=${fileExtension}, mimetype=${file.mimetype}`);

        // File size validation
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            console.error(`[EVIDENCE] File too large: ${file.size} bytes`);
            res.status(400);
            throw new Error("File too large. Maximum file size is 10MB.");
        }

        // More robust file extension extraction for validation
        // This handles file names with multiple dots correctly
        const fileName = file.name;
        const fileNameParts = fileName.split('.');
        const extractedExtension = fileNameParts.length > 1
            ? `.${fileNameParts[fileNameParts.length - 1].toLowerCase()}`
            : '';

        console.log(`[EVIDENCE] Extracted extension: ${extractedExtension}`);

        // Check both the simple extension and more robust extracted extension
        const isValidExtension = allowedExtensions.includes(fileExtension) ||
            allowedExtensions.includes(extractedExtension);

        // Check MIME type
        const isValidMimeType = allowedMimeTypes.includes(file.mimetype);

        // Accept if either extension or MIME type is valid
        if (!isValidExtension && !isValidMimeType) {
            console.error(`[EVIDENCE] Invalid file: extension=${fileExtension}, mimetype=${file.mimetype}`);
            res.status(400);
            throw new Error("Invalid file type. Only DOCX, PDF, JPEG, and PNG files are allowed.");
        }

        console.log(`[EVIDENCE] File validation passed: ${fileName} (ext: ${isValidExtension}, mime: ${isValidMimeType})`);


        console.log(`[EVIDENCE] File accepted based on extension: ${fileExtension}`);

        // Save file to user-specific directory
        const savePath = path.join(userDir, file.name);

        // Check if file already exists and remove it
        if (fs.existsSync(savePath)) {
            console.log(`[EVIDENCE] File ${file.name} already exists, replacing it`);
            fs.unlinkSync(savePath);
        }

        await file.mv(savePath);
        console.log(`[EVIDENCE] File saved successfully: ${savePath}`);

        // Also save a copy to shared evidence directory for AI processing
        const sharedDir = path.join(__dirname, "../../../shared-evidence");
        if (!fs.existsSync(sharedDir)) {
            fs.mkdirSync(sharedDir, { recursive: true });
        }

        // Create a unique filename for shared directory to avoid conflicts
        const uniqueFilename = `${userIdStr}_${file.name}`;
        const sharedPath = path.join(sharedDir, uniqueFilename);

        // Copy file to shared directory
        fs.copyFileSync(savePath, sharedPath);
        console.log(`[EVIDENCE] File copied to shared directory: ${sharedPath}`);

        res.json({
            name: file.name,
            url: `/uploads/evidence/${userIdStr}/${file.name}`,
            size: file.size,
            type: file.mimetype,
            userId: userIdStr
        });
    } catch (error) {
        console.error(`[EVIDENCE] Upload error: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/evidence/:filename
const deleteEvidence = asyncHandler(async (req, res) => {
    try {
        const filename = req.params.filename;
        const userId = req.user._id;
        const userIdStr = userId.toString(); // Convert ObjectId to string
        console.log(`[EVIDENCE] Processing file deletion: ${filename} for user: ${userIdStr}`);

        // User-specific file path
        const userDir = ensureUserDir(userIdStr);
        const filePath = path.join(userDir, filename);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`[EVIDENCE] File deleted successfully: ${filePath}`);

            // Also delete from shared directory if exists
            const sharedDir = path.join(__dirname, "../../../shared-evidence");
            const sharedPath = path.join(sharedDir, `${userIdStr}_${filename}`);
            if (fs.existsSync(sharedPath)) {
                fs.unlinkSync(sharedPath);
                console.log(`[EVIDENCE] File deleted from shared directory: ${sharedPath}`);
            }

            res.json({ message: "File deleted" });
        } else {
            console.error(`[EVIDENCE] File not found: ${filePath}`);
            res.status(404);
            throw new Error("File not found");
        }
    } catch (error) {
        console.error(`[EVIDENCE] Delete error: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/evidence/list
const listEvidence = asyncHandler(async (req, res) => {
    try {
        const userId = req.user._id;
        const userIdStr = userId.toString(); // Convert ObjectId to string
        console.log(`[EVIDENCE] Listing evidence for user: ${userIdStr}`);

        // User-specific directory
        const userDir = path.join(UPLOAD_DIR, userIdStr);

        // If user directory doesn't exist yet, return empty array
        if (!fs.existsSync(userDir)) {
            console.log(`[EVIDENCE] User directory does not exist yet for ${userId}, returning empty list`);
            return res.json({ files: [] });
        }

        const files = fs.readdirSync(userDir)
            .filter(file => fs.statSync(path.join(userDir, file)).isFile())
            .map(file => ({
                name: file,
                url: `/uploads/evidence/${userIdStr}/${file}`,
                size: fs.statSync(path.join(userDir, file)).size,
                uploaded: fs.statSync(path.join(userDir, file)).mtime,
                userId: userIdStr
            }));

        console.log(`[EVIDENCE] Listed ${files.length} evidence files for user ${userId}`);
        res.json({ files });
    } catch (error) {
        console.error(`[EVIDENCE] List error: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

module.exports = { uploadEvidence, deleteEvidence, listEvidence };
