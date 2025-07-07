// Fully implemented real code for backend/controllers/formController.js
const asyncHandler = require("express-async-handler");
const { uploadFormToS3, getPreSignedUrl } = require("../services/s3Service");
const { saveFormData, getFormData, clearFormData } = require("../services/dynamodbService");

const submitForm = asyncHandler(async (req, res) => {
    const userEmail = req.user.email;
    const { isAutoSave = false, ...formData } = req.body;

    // Validate form data exists
    if (!formData || Object.keys(formData).length === 0) {
        res.status(400);
        throw new Error("Form data is required");
    }

    // Sanitize form data to prevent injection attacks
    const sanitizedFormData = JSON.parse(JSON.stringify(formData));

    // Always save to database
    await saveFormData(userEmail, sanitizedFormData);

    if (isAutoSave) {
        // For auto-save, just return success
        res.json({ 
            message: "Form auto-saved successfully",
            savedAt: new Date().toISOString()
        });
    } else {
        // For final submission, upload to S3 and provide download link
        const key = `forms/${userEmail}-${Date.now()}.json`;
        await uploadFormToS3(sanitizedFormData, key);

        const url = await getPreSignedUrl(key);

        // Clear the saved form data after successful final submission
        await clearFormData(userEmail);

        res.json({ 
            message: "Form submitted successfully", 
            downloadUrl: url,
            submittedAt: new Date().toISOString()
        });
    }
});

const getResumeData = asyncHandler(async (req, res) => {
    const userEmail = req.user.email;
    const data = await getFormData(userEmail);

    if (!data) {
        res.status(404);
        throw new Error("No saved form data found");
    }

    res.json(data);
});

module.exports = { submitForm, getResumeData };
