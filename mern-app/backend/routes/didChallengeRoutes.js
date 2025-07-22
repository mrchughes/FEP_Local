// backend/routes/didChallengeRoutes.js
const express = require('express');
const router = express.Router();
const didChallengeController = require('../controllers/didChallengeController');

// POST /pds/did-challenge - Handle DID challenge requests from PDS providers
router.post('/did-challenge', didChallengeController.handleChallenge);

// GET /pds/register/:registrationId/status - Check verification status for a registration
router.get('/register/:registrationId/status', didChallengeController.checkVerificationStatus);

module.exports = router;
