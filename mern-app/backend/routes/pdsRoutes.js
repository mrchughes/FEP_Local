// backend/routes/pdsRoutes.js
const express = require('express');
const router = express.Router();
const pdsController = require('../controllers/pdsController');
const authMiddleware = require('../middlewares/auth');

// Routes that require authentication
router.use(authMiddleware);

// PDS Provider Management
router.post('/providers', pdsController.registerPDSProvider);
router.get('/providers', pdsController.listPDSProviders);

// User PDS Connection
router.post('/connect', pdsController.connectToPDS);
router.get('/callback', pdsController.pdsCallback);
router.get('/status', pdsController.getPDSStatus);
router.post('/disconnect', pdsController.disconnectPDS);

module.exports = router;
