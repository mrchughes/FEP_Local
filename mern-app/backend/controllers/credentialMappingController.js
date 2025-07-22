// backend/controllers/credentialMappingController.js
const Application = require('../models/Application');
const PDSCredentialMapping = require('../models/PDSCredentialMapping');
const { getCredentialById } = require('../services/pdsCredentialService');
const logger = require('../utils/logger');

/**
 * Apply credential field mappings to an application
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.applyCredentialToApplication = async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { credentialId, mappings } = req.body;
        const userId = req.user.id;

        if (!applicationId || !credentialId || !mappings || !Array.isArray(mappings)) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Get the application
        const application = await Application.findOne({
            _id: applicationId,
            user: userId,
        });

        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }

        // Get the credential from PDS
        const credential = await getCredentialById(userId, credentialId);

        if (!credential) {
            return res.status(404).json({ error: 'Credential not found in PDS' });
        }

        // Apply the mappings to the application data
        let updatedData = { ...application.data };
        let hasChanges = false;

        for (const mapping of mappings) {
            const { formField, value } = mapping;

            if (value !== undefined) {
                // Set value in nested object structure using path
                const fieldPath = formField.split('.');
                let current = updatedData;

                // Navigate to the proper nesting level
                for (let i = 0; i < fieldPath.length - 1; i++) {
                    const key = fieldPath[i];

                    if (!current[key] || typeof current[key] !== 'object') {
                        current[key] = {};
                    }

                    current = current[key];
                }

                // Set the actual value
                const lastKey = fieldPath[fieldPath.length - 1];
                current[lastKey] = value;
                hasChanges = true;
            }
        }

        // Update the application if changes were made
        if (hasChanges) {
            application.data = updatedData;
            application.lastUpdated = new Date();
            await application.save();

            // Record the mapping for future reference and auditing
            await PDSCredentialMapping.create({
                application: applicationId,
                user: userId,
                credential: {
                    id: credentialId,
                    type: credential.type,
                    issuer: credential.issuer
                },
                mappings: mappings.map(m => ({
                    formField: m.formField,
                    credentialField: m.credentialField,
                    source: m.source
                })),
                appliedAt: new Date()
            });

            logger.info(`Applied credential mappings for application ${applicationId} using credential ${credentialId}`);

            return res.status(200).json({
                message: 'Credential mappings applied successfully',
                updatedFields: mappings.length
            });
        } else {
            return res.status(200).json({
                message: 'No changes were made to the application',
                updatedFields: 0
            });
        }
    } catch (error) {
        logger.error('Error applying credential mappings:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Get credential mapping history for an application
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getMappingHistory = async (req, res) => {
    try {
        const { applicationId } = req.params;
        const userId = req.user.id;

        const mappingHistory = await PDSCredentialMapping.find({
            application: applicationId,
            user: userId
        }).sort({ appliedAt: -1 }); // Most recent first

        return res.status(200).json(mappingHistory);
    } catch (error) {
        logger.error('Error getting mapping history:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Get field mapping suggestions for a specific application and credential type
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getFieldMappingSuggestions = async (req, res) => {
    try {
        const { credentialType } = req.params;

        // Get the most common mappings for this credential type
        const commonMappings = await PDSCredentialMapping.aggregate([
            { $match: { 'credential.type': credentialType } },
            { $unwind: '$mappings' },
            {
                $group: {
                    _id: {
                        formField: '$mappings.formField',
                        credentialField: '$mappings.credentialField'
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 50 }, // Get top 50 common mappings
            {
                $project: {
                    _id: 0,
                    formField: '$_id.formField',
                    credentialField: '$_id.credentialField',
                    frequency: '$count'
                }
            }
        ]);

        return res.status(200).json(commonMappings);
    } catch (error) {
        logger.error('Error getting field mapping suggestions:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Normalize a credential field value based on form field type
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.normalizeFieldValue = async (req, res) => {
    try {
        const { value, targetType, format } = req.body;

        if (!value) {
            return res.status(400).json({ error: 'Missing value to normalize' });
        }

        let normalizedValue = value;

        // Perform normalization based on target type
        switch (targetType) {
            case 'date':
                // Convert various date formats to ISO or custom format
                try {
                    const date = new Date(value);
                    if (isNaN(date.getTime())) {
                        throw new Error('Invalid date');
                    }

                    if (format === 'iso') {
                        normalizedValue = date.toISOString();
                    } else if (format === 'yyyy-mm-dd') {
                        normalizedValue = date.toISOString().split('T')[0];
                    } else if (format === 'mm/dd/yyyy') {
                        normalizedValue = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
                    } else {
                        normalizedValue = date.toISOString();
                    }
                } catch (err) {
                    return res.status(400).json({ error: 'Invalid date format' });
                }
                break;

            case 'boolean':
                // Convert various boolean representations
                if (typeof value === 'string') {
                    const lowerValue = value.toLowerCase();
                    if (['true', 'yes', '1', 'y'].includes(lowerValue)) {
                        normalizedValue = true;
                    } else if (['false', 'no', '0', 'n'].includes(lowerValue)) {
                        normalizedValue = false;
                    }
                } else if (typeof value === 'number') {
                    normalizedValue = value !== 0;
                }
                break;

            case 'number':
                // Convert string numbers to actual numbers
                if (typeof value === 'string') {
                    const parsed = parseFloat(value.replace(/,/g, ''));
                    if (!isNaN(parsed)) {
                        normalizedValue = parsed;
                    }
                }
                break;

            case 'string':
                // Convert to string and optionally format
                normalizedValue = String(value);

                if (format === 'uppercase') {
                    normalizedValue = normalizedValue.toUpperCase();
                } else if (format === 'lowercase') {
                    normalizedValue = normalizedValue.toLowerCase();
                } else if (format === 'capitalize') {
                    normalizedValue = normalizedValue
                        .split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                        .join(' ');
                }
                break;
        }

        return res.status(200).json({
            original: value,
            normalized: normalizedValue,
            targetType,
            format
        });
    } catch (error) {
        logger.error('Error normalizing field value:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
