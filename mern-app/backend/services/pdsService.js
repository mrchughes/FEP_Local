// backend/services/pdsService.js
const axios = require('axios');
const url = require('url');
const crypto = require('crypto');
const PDSRegistration = require('../models/pdsRegistration');

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

            // Convert PEM to JWK format
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

        // Store registration in database
        const registration = new PDSRegistration({
            pdsProvider: new URL(pdsUrl).hostname,
            pdsDiscoveryUrl: discoveryUrl,
            registrationId: response.data.registrationId,
            serviceDid,
            registrationTimestamp: new Date(),
            status: response.data.status,
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

module.exports = {
    extractPdsUrl,
    registerWithProvider,
    getRegistrationByProvider
};
