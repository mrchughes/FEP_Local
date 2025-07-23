// backend/controllers/pdsCredentialController.js
const pdsCredentialService = require('../services/pdsCredentialService');

/**
 * Store form data as a verifiable credential
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
exports.storeFormData = async (req, res) => {
    try {
        const formData = req.body;
        const customerId = req.user.id; // Assuming authentication middleware sets req.user
        const { audience } = req.query; // Get audience from query params if provided

        if (!formData) {
            return res.status(400).json({ message: 'Form data is required' });
        }

        // Process and store form data with optional audience parameter
        const result = await pdsCredentialService.processFormData(customerId, formData, audience);

        res.status(201).json({
            message: 'Form data stored successfully as a verifiable credential',
            ...result
        });
    } catch (error) {
        console.error('Store Form Data Error:', error);
        res.status(500).json({ message: 'Error storing form data', error: error.message });
    }
};

/**
 * Get form data from verifiable credentials
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
exports.getFormData = async (req, res) => {
    try {
        const customerId = req.user.id; // Assuming authentication middleware sets req.user

        // Handle multiple audiences (comma-separated in the query)
        let audience = req.query.audience;
        if (audience && audience.includes(',')) {
            audience = audience.split(',').map(a => a.trim()).filter(Boolean);
            console.log(`[CONTROLLER] Processing multiple audiences for form data: ${audience.join(', ')}`);
        }

        // Get form data from credentials with optional audience parameter(s)
        const formData = await pdsCredentialService.getFormDataFromCredentials(customerId, audience);

        if (!formData) {
            return res.status(404).json({ message: 'No form data found' });
        }

        res.status(200).json(formData);
    } catch (error) {
        console.error('Get Form Data Error:', error);
        res.status(500).json({ message: 'Error getting form data', error: error.message });
    }
};

/**
 * List all credentials for the current user
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
exports.listCredentials = async (req, res) => {
    try {
        const customerId = req.user.id; // Assuming authentication middleware sets req.user
        const { type } = req.query;

        // Handle multiple audiences (comma-separated in the query)
        let audience = req.query.audience;
        if (audience && audience.includes(',')) {
            audience = audience.split(',').map(a => a.trim()).filter(Boolean);
            console.log(`[CONTROLLER] Processing multiple audiences: ${audience.join(', ')}`);
        }

        // Get credentials with optional audience parameter(s)
        const credentials = await pdsCredentialService.getCredentials(customerId, { type, audience });

        res.status(200).json(credentials);
    } catch (error) {
        console.error('List Credentials Error:', error);
        res.status(500).json({ message: 'Error listing credentials', error: error.message });
    }
};

/**
 * Store a credential in the user's PDS
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
exports.storeCredential = async (req, res) => {
    try {
        const credential = req.body;
        const customerId = req.user.id; // Assuming authentication middleware sets req.user
        const { audience } = req.query; // Get audience from query params if provided

        if (!credential) {
            return res.status(400).json({ message: 'Credential is required' });
        }

        // Store credential with optional audience parameter
        const result = await pdsCredentialService.storeCredential(customerId, credential, audience);

        res.status(201).json({
            message: 'Credential stored successfully',
            result
        });
    } catch (error) {
        console.error('Store Credential Error:', error);
        res.status(500).json({ message: 'Error storing credential', error: error.message });
    }
};
