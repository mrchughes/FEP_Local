// backend/services/didChallengeService.js
const crypto = require('crypto');
const axios = require('axios');
const PDSRegistration = require('../models/pdsRegistration');

/**
 * Handle DID Challenge-Response verification
 * Implements the challenge-response protocol for DID verification
 */

/**
 * Process and sign a challenge from a PDS provider
 * @param {Object} challengeRequest - The challenge request from the PDS provider
 * @returns {Object} - The signed challenge response
 */
const processChallenge = async (challengeRequest) => {
    try {
        const { registrationId, challenge, timestamp, pdsUrl } = challengeRequest;

        // Validate the challenge request
        if (!registrationId || !challenge) {
            throw new Error('Invalid challenge request: missing required fields');
        }

        // Find the registration for this challenge
        const registration = await PDSRegistration.findOne({ registrationId });
        if (!registration) {
            throw new Error(`No registration found with ID: ${registrationId}`);
        }

        // In a real implementation, we would get the private key from secure storage
        // and use it to sign the challenge
        // This is a simplified mock implementation
        const mockPrivateKey = process.env.MOCK_PRIVATE_KEY || 'mock-private-key';

        // Format the challenge for signing
        let formattedChallenge;
        if (typeof challenge === 'string') {
            // Simple string challenge
            formattedChallenge = challenge;
        } else if (typeof challenge === 'object') {
            // Structured JSON challenge
            formattedChallenge = JSON.stringify(challenge);
        } else {
            throw new Error('Unsupported challenge format');
        }

        // Sign the challenge (mock implementation)
        const signedChallenge = signChallenge(formattedChallenge, mockPrivateKey);

        // Create the response based on the challenge format
        return formatChallengeResponse(registrationId, challenge, signedChallenge, registration.serviceDid);
    } catch (error) {
        console.error('Error processing DID challenge:', error);
        throw error;
    }
};

/**
 * Sign a challenge with the private key
 * @param {string} challenge - The challenge to sign
 * @param {string} privateKey - The private key to sign with
 * @returns {string} - The signature
 */
const signChallenge = (challenge, privateKey) => {
    // This is a mock implementation
    // In a real implementation, this would use proper cryptographic signing

    // For Ed25519 signature example:
    // const sign = crypto.createSign('ed25519');
    // sign.update(challenge);
    // return sign.sign(privateKey, 'base64');

    // For testing, we'll just create a mock signature
    return `mock_signature_for_${challenge}_${Date.now()}`;
};

/**
 * Format the challenge response based on the challenge format
 * @param {string} registrationId - The registration ID
 * @param {string|Object} challenge - The original challenge
 * @param {string} signature - The challenge signature
 * @param {string} serviceDid - The service DID
 * @returns {Object} - The formatted response
 */
const formatChallengeResponse = (registrationId, challenge, signature, serviceDid) => {
    // Standard response format
    const response = {
        registrationId,
        serviceDid,
        signature: {
            type: 'Ed25519Signature2020',
            created: new Date().toISOString(),
            verificationMethod: `${serviceDid}#key-1`,
            proofPurpose: 'authentication',
            proofValue: signature
        }
    };

    // If the challenge was a structured object, include it in the response
    if (typeof challenge === 'object') {
        response.challenge = challenge;
    }

    return response;
};

/**
 * Check registration verification status
 * @param {string} registrationId - The registration ID
 * @param {string} pdsUrl - The PDS URL
 * @returns {Object} - The verification status
 */
const checkVerificationStatus = async (registrationId, pdsUrl) => {
    try {
        // Find the registration
        const registration = await PDSRegistration.findOne({ registrationId });
        if (!registration) {
            throw new Error(`No registration found with ID: ${registrationId}`);
        }

        // Call the PDS verification status endpoint
        const statusEndpoint = `${pdsUrl}/pds/register/${registrationId}/status`;
        const response = await axios.get(statusEndpoint);

        // Update the registration status
        registration.status = response.data.status;

        if (response.data.status === 'verified') {
            registration.verificationTimestamp = new Date();
        }

        await registration.save();

        return response.data;
    } catch (error) {
        console.error('Error checking verification status:', error);
        throw error;
    }
};

module.exports = {
    processChallenge,
    checkVerificationStatus
};
