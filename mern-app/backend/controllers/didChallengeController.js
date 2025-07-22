// backend/controllers/didChallengeController.js
const didChallengeService = require('../services/didChallengeService');

/**
 * Handle DID challenge requests from PDS providers
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
exports.handleChallenge = async (req, res) => {
    try {
        // Extract challenge data from request body
        const challengeRequest = req.body;

        // Log the challenge request (for debugging purposes)
        console.log('Received DID challenge:', JSON.stringify(challengeRequest, null, 2));

        // Process the challenge
        const response = await didChallengeService.processChallenge(challengeRequest);

        // Return the challenge response
        res.status(200).json(response);
    } catch (error) {
        console.error('DID Challenge Error:', error);
        res.status(500).json({
            message: 'Error processing DID challenge',
            error: error.message
        });
    }
};

/**
 * Check verification status for a registration
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
exports.checkVerificationStatus = async (req, res) => {
    try {
        const { registrationId } = req.params;
        const { pdsUrl } = req.query;

        if (!registrationId || !pdsUrl) {
            return res.status(400).json({
                message: 'Missing required parameters: registrationId and pdsUrl'
            });
        }

        // Check verification status
        const status = await didChallengeService.checkVerificationStatus(registrationId, pdsUrl);

        res.status(200).json(status);
    } catch (error) {
        console.error('Verification Status Check Error:', error);
        res.status(500).json({
            message: 'Error checking verification status',
            error: error.message
        });
    }
};
