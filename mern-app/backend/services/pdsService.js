// backend/services/pdsService.js
const axios = require('axios');
const url = require('url');
const crypto = require('crypto');
const PDSRegistration = require('../models/pdsRegistration');
const { findUserByEmail } = require('./dynamodbService');
const oneloginOAuthClientService = require('./oneloginOAuthClientService');

/**
 * Extract PDS URL from WebID
 * @param {string} webId - The user's WebID
 * @returns {string} - The extracted PDS URL
 */
const extractPdsUrl = (webId) => {
    try {
        const parsedUrl = new URL(webId);
        return `${parsedUrl.protocol}//${parsedUrl.hostname}`;
    } catch (err) {
        throw new Error('Invalid WebID format');
    }
};

/**
 * Generate RSA key pair for PDS communication
 * @returns {Object} - The generated key pair
 */
const generateRsaKeyPair = async () => {
    return new Promise((resolve, reject) => {
        crypto.generateKeyPair('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem'
            }
        }, (err, publicKey, privateKey) => {
            if (err) {
                reject(err);
                return;
            }

            // Convert PEM to JWK format (in a real implementation, this would use a proper JWK library)
            const publicKeyJwk = {
                kid: "key-1",
                kty: "RSA",
                alg: "RS256",
                use: "sig",
                // In a real implementation, you would convert the public key to JWK format
                // This is a simplified version
                n: "public-key-modulus-placeholder",
                e: "AQAB"
            };

            resolve({
                publicKey,
                privateKey,
                publicKeyJwk
            });
        });
    });
};

/**
 * Register service with PDS provider
 * @param {string} pdsUrl - The PDS provider URL
 * @returns {Object} - The registration result
 */
const registerWithProvider = async (pdsUrl) => {
    try {
        // Discover PDS endpoints
        const discoveryUrl = `${pdsUrl}/.well-known/solid`;
        const discoveryResponse = await axios.get(discoveryUrl);
        const endpoints = discoveryResponse.data;

        const registrationEndpoint = endpoints.registration_endpoint || `${pdsUrl}/pds/register`;

        // Generate RSA key pair
        const keyPair = await generateRsaKeyPair();

        // Service details from environment variables
        const serviceDomain = process.env.SERVICE_DOMAIN || 'fep.example.org';
        const serviceDid = process.env.SERVICE_DID || `did:web:${serviceDomain}`;
        const serviceUrl = process.env.SERVICE_URL || `https://${serviceDomain}`;

        // Create registration request
        const registrationData = {
            serviceDid,
            domain: serviceDomain,
            description: 'Financial Entitlement Platform Application',
            capabilities: ['read:credentials', 'verify:credentials'],
            redirectUrl: `${serviceUrl}/pds/callback`,
            challengeEndpoint: `${serviceUrl}/pds/did-challenge`
        };

        // Send registration request
        const response = await axios.post(registrationEndpoint, registrationData, {
            headers: { 'Content-Type': 'application/json' }
        });

        // Check if verification is required
        const registrationResult = response.data;
        console.log('PDS Registration result:', registrationResult);

        // Store registration in database
        const registration = new PDSRegistration({
            pdsProvider: new URL(pdsUrl).hostname,
            pdsDiscoveryUrl: discoveryUrl,
            registrationId: registrationResult.registrationId,
            serviceDid,
            registrationTimestamp: new Date(),
            status: registrationResult.status || 'pending',
            publicKey: keyPair.publicKeyJwk,
            keyId: `vault:/keys/pds-${new URL(pdsUrl).hostname}`,
            endpoints: {
                token: endpoints.token_endpoint,
                authorization: endpoints.authorization_endpoint,
                credentials: endpoints.credential_endpoint
            },
            providerCapabilities: endpoints.capabilities || []
        });

        await registration.save();

        // If verification is required, we need to handle DID challenge-response
        if (registrationResult.verificationRequired && registrationResult.challenge) {
            console.log('Verification required for PDS registration. Challenge will be handled by DID challenge endpoint.');

            // The PDS will call our challenge endpoint with the challenge
            // We'll handle that in the didChallengeController

            // For testing, we'll poll the status a few times to see if verification completes
            let attempts = 0;
            const maxAttempts = 5;
            const delay = 2000; // 2 seconds initial delay

            while (attempts < maxAttempts) {
                attempts++;
                console.log(`Checking verification status (attempt ${attempts}/${maxAttempts})...`);

                try {
                    // Wait with exponential backoff
                    await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempts - 1)));

                    // Check status
                    const statusUrl = `${pdsUrl}/pds/register/${registrationResult.registrationId}/status`;
                    const statusResponse = await axios.get(statusUrl);

                    console.log('Verification status:', statusResponse.data);

                    if (statusResponse.data.status === 'verified' || statusResponse.data.status === 'active') {
                        // Update registration status
                        registration.status = statusResponse.data.status;
                        registration.verificationTimestamp = new Date();
                        await registration.save();
                        break;
                    }
                } catch (statusError) {
                    console.error('Error checking verification status:', statusError.message);
                }
            }
        }

        return registration;
    } catch (err) {
        console.error('PDS registration error:', err.message);
        throw new Error(`PDS registration failed: ${err.message}`);
    }
};

/**
 * Get registration by PDS provider
 * @param {string} pdsProvider - The PDS provider hostname
 * @returns {Object} - The registration object or null
 */
const getRegistrationByProvider = async (pdsProvider) => {
    return await PDSRegistration.findOne({ pdsProvider });
};

/**
 * Get credentials from PDS using OneLogin tokens
 * @param {string} email - The user's email
 * @param {string} credentialType - The type of credential to get
 * @returns {Object} - The credentials from the PDS
 */
const getCredentialsWithOneLogin = async (email, credentialType) => {
    try {
        // Find user by email
        const user = await findUserByEmail(email);
        if (!user) {
            throw new Error('User not found');
        }

        // Check if user has PDS tokens
        if (!user.pdsTokens || !user.pdsTokens.accessToken) {
            throw new Error('No PDS tokens found for user');
        }

        let accessToken = user.pdsTokens.accessToken;

        // Check if token is expired
        if (new Date(user.pdsTokens.expiresAt) < new Date()) {
            // Token is expired, try to refresh
            if (!user.pdsTokens.refreshToken) {
                throw new Error('No refresh token available');
            }

            try {
                const newTokens = await oneloginOAuthClientService.refreshToken(user.pdsTokens.refreshToken);

                // Update user with new tokens
                user.pdsTokens = {
                    accessToken: newTokens.access_token,
                    refreshToken: newTokens.refresh_token,
                    expiresAt: new Date(Date.now() + newTokens.expires_in * 1000).toISOString()
                };
                await user.save();

                accessToken = newTokens.access_token;
            } catch (refreshError) {
                throw new Error('Failed to refresh token: ' + refreshError.message);
            }
        }

        // Extract PDS URL from WebID
        if (!user.webId) {
            throw new Error('User has no WebID');
        }

        const pdsUrl = extractPdsUrl(user.webId);

        // Discover PDS endpoints
        const discoveryUrl = `${pdsUrl}/.well-known/solid`;
        const discoveryResponse = await axios.get(discoveryUrl);
        const endpoints = discoveryResponse.data;

        const credentialEndpoint = endpoints.credential_endpoint || `${pdsUrl}/pds/credentials`;

        // Get credentials from PDS
        const response = await axios.get(`${credentialEndpoint}?type=${credentialType}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        return response.data;
    } catch (err) {
        console.error('Error getting credentials with OneLogin:', err.message);
        throw new Error(`Failed to get credentials: ${err.message}`);
    }
};

module.exports = {
    extractPdsUrl,
    registerWithProvider,
    getRegistrationByProvider,
    getCredentialsWithOneLogin
};;
