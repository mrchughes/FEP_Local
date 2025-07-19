// backend/models/pdsRegistration.js
const mongoose = require("mongoose");
const { encrypt, decrypt } = require("../utils/encryption");

/**
 * PDS Registration Schema
 * Stores information about registered PDS providers
 */
const PDSRegistrationSchema = new mongoose.Schema({
    pdsProvider: {
        type: String,
        required: true,
        trim: true
    },
    pdsDiscoveryUrl: {
        type: String,
        trim: true
    },
    registrationId: {
        type: String,
        required: true,
        trim: true
    },
    serviceDid: {
        type: String,
        required: true,
        trim: true
    },
    registrationTimestamp: {
        type: Date,
        default: Date.now
    },
    verificationTimestamp: {
        type: Date
    },
    status: {
        type: String,
        enum: ['pending', 'verified', 'active', 'revoked'],
        default: 'pending'
    },
    accessToken: {
        type: String,
        // Encrypted storage
        set: function (token) {
            if (!token) return null;
            return encrypt(token);
        },
        get: function (token) {
            if (!token) return null;
            return decrypt(token);
        }
    },
    refreshToken: {
        type: String,
        // Encrypted storage
        set: function (token) {
            if (!token) return null;
            return encrypt(token);
        },
        get: function (token) {
            if (!token) return null;
            return decrypt(token);
        }
    },
    expiresAt: {
        type: Date
    },
    publicKey: {
        kid: String,
        kty: String,
        alg: String,
        use: String,
        n: String,
        e: String
    },
    keyId: String,
    endpoints: {
        token: String,
        authorization: String,
        credentials: String
    },
    providerCapabilities: [String]
}, {
    timestamps: true,
    toJSON: { getters: true, setters: false } // Use getters but not setters when converting to JSON
});

const PDSRegistration = mongoose.model("PDSRegistration", PDSRegistrationSchema);
module.exports = PDSRegistration;
