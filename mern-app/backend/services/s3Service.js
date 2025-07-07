// Fully implemented real code for backend/services/s3Service.js
const AWS = require("aws-sdk");
const s3 = new AWS.S3();

const uploadFormToS3 = async (formData, key) => {
    try {
        // Validate key to prevent path traversal
        if (key.includes("..") || key.includes("//")) {
            throw new Error("Invalid file path");
        }

        const params = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
            Body: JSON.stringify(formData, null, 2),
            ContentType: "application/json",
            ServerSideEncryption: "AES256", // Enable encryption
        };
        await s3.putObject(params).promise();
    } catch (error) {
        console.error("Error uploading to S3:", error);
        throw new Error("Failed to upload form data");
    }
};

const getPreSignedUrl = async (key) => {
    try {
        // Validate key to prevent unauthorized access
        if (key.includes("..") || key.includes("//")) {
            throw new Error("Invalid file path");
        }

        const params = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
            Expires: 3600, // 1 hour expiry
        };
        return s3.getSignedUrlPromise("getObject", params);
    } catch (error) {
        console.error("Error generating pre-signed URL:", error);
        throw new Error("Failed to generate download URL");
    }
};

module.exports = { uploadFormToS3, getPreSignedUrl };
