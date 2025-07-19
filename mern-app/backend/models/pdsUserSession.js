// backend/models/pdsUserSession.js
const mongoose = require("mongoose");
const { encrypt, decrypt } = require("../utils/encryption");

/**
 * PDS User Session Schema
 * Stores user's PDS connection information
 */
const PDSUserSessionSchema = new mongoose.Schema({
    customerId: {
        type: String,
        required: true,
        trim: true
    },
    pdsProvider: {
        type: String,
        required: true,
        trim: true
    },
    webId: {
        type: String,
        required: true,
        trim: true
    },
    accessToken: {
        type: String,
        required: true,
        // Encrypted storage
        set: function (token) {
            return encrypt(token);
        },
        get: function (token) {
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
        type: Date,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { getters: true, setters: false } // Use getters but not setters when converting to JSON
});

const PDSUserSession = mongoose.model("PDSUserSession", PDSUserSessionSchema);
module.exports = PDSUserSession;
