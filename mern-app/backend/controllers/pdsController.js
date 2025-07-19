// backend/controllers/pdsController.js
const pdsService = require('../services/pdsService');
const pdsAuthService = require('../services/pdsAuthService');
const PDSRegistration = require('../models/pdsRegistration');
const PDSUserSession = require('../models/pdsUserSession');

/**
 * Register a new PDS provider
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
exports.registerPDSProvider = async (req, res) => {
    try {
        const { name, providerUrl, discoveryUrl } = req.body;

        if (!name || !providerUrl) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Check if provider already exists
        const existingProvider = await PDSRegistration.findOne({ providerUrl });
        if (existingProvider) {
            return res.status(400).json({ message: 'Provider already registered' });
        }

        // Register the provider
        const registration = await pdsService.registerWithPDSProvider(name, providerUrl, discoveryUrl);

        res.status(201).json({
            message: 'Provider registered successfully',
            providerId: registration._id
        });
    } catch (error) {
        console.error('PDS Provider Registration Error:', error);
        res.status(500).json({ message: 'Error registering PDS provider', error: error.message });
    }
};

/**
 * Get a list of registered PDS providers
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
exports.listPDSProviders = async (req, res) => {
    try {
        const providers = await PDSRegistration.find().select('name providerUrl discoveryUrl createdAt');
        res.status(200).json(providers);
    } catch (error) {
        console.error('List PDS Providers Error:', error);
        res.status(500).json({ message: 'Error listing PDS providers', error: error.message });
    }
};

/**
 * Connect user to their PDS
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
exports.connectToPDS = async (req, res) => {
    try {
        const { webId } = req.body;
        const customerId = req.user.id; // Assuming authentication middleware sets req.user

        if (!webId) {
            return res.status(400).json({ message: 'WebID is required' });
        }

        // Extract PDS URL from WebID
        let pdsUrl;
        try {
            pdsUrl = await pdsService.extractPdsUrl(webId);
        } catch (error) {
            return res.status(400).json({ message: 'Invalid WebID or unable to extract PDS URL', error: error.message });
        }

        // Get PDS provider hostname
        const pdsHostname = new URL(pdsUrl).hostname;

        // Find registration for this provider
        const registration = await PDSRegistration.findOne({
            providerUrl: { $regex: new RegExp(pdsHostname, 'i') }
        });

        if (!registration) {
            // Auto-register this provider if not found
            try {
                const newRegistration = await pdsService.registerWithPDSProvider(
                    pdsHostname, // Use hostname as name
                    pdsUrl, // Use PDS URL as provider URL
                    null // No discovery URL, will use WebFinger discovery
                );

                registration = newRegistration;
            } catch (err) {
                return res.status(400).json({
                    message: 'PDS provider not registered and auto-registration failed',
                    error: err.message
                });
            }
        }

        // Generate authorization URL
        const authUrl = pdsAuthService.generateAuthUrl(registration, webId);

        res.status(200).json({ authUrl });
    } catch (error) {
        console.error('Connect to PDS Error:', error);
        res.status(500).json({ message: 'Error connecting to PDS', error: error.message });
    }
};

/**
 * Handle the callback from PDS provider
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
exports.pdsCallback = async (req, res) => {
    try {
        const { code, state } = req.query;
        const customerId = req.user.id; // Assuming authentication middleware sets req.user

        if (!code || !state) {
            return res.status(400).json({ message: 'Missing required parameters' });
        }

        // Handle the callback
        await pdsAuthService.handleCallback(code, state, customerId);

        // Redirect to success page
        res.redirect('/pds-connected-success');
    } catch (error) {
        console.error('PDS Callback Error:', error);
        res.status(500).json({ message: 'Error handling PDS callback', error: error.message });
    }
};

/**
 * Get PDS connection status for the current user
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
exports.getPDSStatus = async (req, res) => {
    try {
        const customerId = req.user.id; // Assuming authentication middleware sets req.user

        // Check if user has an active session
        const session = await pdsAuthService.getActiveSession(customerId);

        if (!session) {
            return res.status(200).json({
                connected: false,
                message: 'No active PDS connection found'
            });
        }

        res.status(200).json({
            connected: true,
            webId: session.webId,
            pdsProvider: session.pdsProvider,
            connectedSince: session.createdAt
        });
    } catch (error) {
        console.error('PDS Status Error:', error);
        res.status(500).json({ message: 'Error getting PDS status', error: error.message });
    }
};

/**
 * Disconnect user from PDS
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
exports.disconnectPDS = async (req, res) => {
    try {
        const customerId = req.user.id; // Assuming authentication middleware sets req.user

        // Remove PDS session for this user
        await PDSUserSession.deleteOne({ customerId });

        res.status(200).json({
            message: 'Successfully disconnected from PDS'
        });
    } catch (error) {
        console.error('PDS Disconnect Error:', error);
        res.status(500).json({ message: 'Error disconnecting from PDS', error: error.message });
    }
};
