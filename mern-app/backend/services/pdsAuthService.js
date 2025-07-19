// backend/services/pdsAuthService.js
const axios = require('axios');
const crypto = require('crypto');
const PDSUserSession = require('../models/pdsUserSession');
const { extractPdsUrl } = require('./pdsService');

/**
 * Generate a secure random state for OIDC authentication
 * @returns {string} - Random state string
 */
const generateRandomState = () => {
    return crypto.randomBytes(32).toString('hex');
};

/**
 * Store state in session storage (to be implemented in a real system)
 * This is a placeholder for storing the state in a secure session storage
 * @param {string} state - The state to store
 * @param {Object} data - Data to associate with the state
 */
const storeStateInSession = (state, data) => {
    // In a real implementation, this would store the state in a secure session storage
    // For now, we'll just log it
    console.log(`[PDS AUTH] Storing state ${state} with data:`, data);
};

/**
 * Get data from state
 * @param {string} state - The state to retrieve
 * @returns {Object} - The data associated with the state
 */
const getDataFromState = (state) => {
    // In a real implementation, this would retrieve the data from secure session storage
    // and validate the state
    console.log(`[PDS AUTH] Retrieving data for state ${state}`);
    return { valid: true, webId: 'placeholder' };
};

/**
 * Generate authorization URL for PDS provider
 * @param {Object} registration - The PDS registration
 * @param {string} webId - The user's WebID
 * @returns {string} - The authorization URL
 */
const generateAuthUrl = (registration, webId) => {
    // Generate secure random state
    const state = generateRandomState();

    // Store state in session with webId
    storeStateInSession(state, { webId });

    // Get authorization endpoint from registration
    const authEndpoint = registration.endpoints.authorization;

    // Build the authorization URL
    const authUrl = new URL(authEndpoint);
    authUrl.searchParams.append('client_id', registration.serviceDid);
    authUrl.searchParams.append('redirect_uri', `${process.env.SERVICE_URL}/pds/callback`);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', 'openid profile offline_access');
    authUrl.searchParams.append('state', state);

    return authUrl.toString();
};

/**
 * Handle OIDC callback
 * @param {string} code - The authorization code
 * @param {string} state - The state parameter
 * @param {string} customerId - The user's ID
 * @returns {Object} - The created session
 */
const handleCallback = async (code, state, customerId) => {
    // Validate state
    const stateData = getDataFromState(state);
    if (!stateData || !stateData.valid) {
        throw new Error('Invalid state parameter');
    }

    const webId = stateData.webId;
    const pdsUrl = extractPdsUrl(webId);

    // Get PDS registration by hostname
    const pdsProvider = new URL(pdsUrl).hostname;
    // In a real implementation, you would look up the registration in the database
    const registration = {
        endpoints: { token: `${pdsUrl}/token` },
        serviceDid: 'did:web:fep.example.org'
    };

    // Exchange code for tokens
    const tokenEndpoint = registration.endpoints.token;
    const response = await axios.post(tokenEndpoint,
        new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: `${process.env.SERVICE_URL}/pds/callback`,
            client_id: registration.serviceDid
        }),
        {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
    );

    const tokens = response.data;

    // Store tokens securely
    const session = new PDSUserSession({
        customerId,
        pdsProvider,
        webId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000)
    });

    await session.save();
    return session;
};

/**
 * Refresh access token
 * @param {Object} session - The PDS user session
 * @returns {Object} - The updated session
 */
const refreshToken = async (session) => {
    try {
        // Get PDS registration
        const pdsUrl = extractPdsUrl(session.webId);
        const pdsProvider = new URL(pdsUrl).hostname;

        // In a real implementation, you would look up the registration in the database
        const registration = {
            endpoints: { token: `${pdsUrl}/token` },
            serviceDid: 'did:web:fep.example.org'
        };

        // Exchange refresh token for new access token
        const tokenEndpoint = registration.endpoints.token;
        const response = await axios.post(tokenEndpoint,
            new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: session.refreshToken,
                client_id: registration.serviceDid
            }),
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            }
        );

        const tokens = response.data;

        // Update session with new tokens
        session.accessToken = tokens.access_token;
        if (tokens.refresh_token) {
            session.refreshToken = tokens.refresh_token;
        }
        session.expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
        session.updatedAt = new Date();

        await session.save();
        return session;
    } catch (err) {
        console.error('Token refresh error:', err.message);
        throw new Error(`Token refresh failed: ${err.message}`);
    }
};

/**
 * Get active session for user
 * @param {string} customerId - The user's ID
 * @returns {Object} - The active session or null
 */
const getActiveSession = async (customerId) => {
    const session = await PDSUserSession.findOne({ customerId });
    if (!session) {
        return null;
    }

    // Check if session is expired
    if (new Date() > session.expiresAt) {
        try {
            // Try to refresh the token
            return await refreshToken(session);
        } catch (err) {
            console.error('Session refresh error:', err.message);
            return null;
        }
    }

    return session;
};

module.exports = {
    generateAuthUrl,
    handleCallback,
    refreshToken,
    getActiveSession
};
