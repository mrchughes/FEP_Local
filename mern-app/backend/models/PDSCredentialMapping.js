// backend/models/PDSCredentialMapping.js
const mongoose = require('mongoose');

/**
 * Schema for tracking credential field mappings applied to applications
 */
const PDSCredentialMappingSchema = new mongoose.Schema({
    // Reference to the application
    application: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Application',
        required: true
    },

    // Reference to the user
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Credential information
    credential: {
        id: {
            type: String,
            required: true
        },
        type: {
            type: String,
            required: true
        },
        issuer: {
            type: String,
            required: true
        }
    },

    // Array of field mappings
    mappings: [{
        formField: {
            type: String,
            required: true
        },
        credentialField: {
            type: String,
            required: true
        },
        source: {
            type: String,
            required: true
        }
    }],

    // When the mapping was applied
    appliedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Index for efficient queries
PDSCredentialMappingSchema.index({ application: 1, user: 1 });
PDSCredentialMappingSchema.index({ 'credential.type': 1 });

module.exports = mongoose.model('PDSCredentialMapping', PDSCredentialMappingSchema);
