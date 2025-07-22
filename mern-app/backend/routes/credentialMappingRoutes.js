// backend/routes/credentialMappingRoutes.js
const express = require('express');
const router = express.Router();
const credentialMappingController = require('../controllers/credentialMappingController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Protect all routes with authentication
router.use(authenticateToken);

// Apply credential mappings to an application
router.post('/applications/:applicationId/apply-credential', credentialMappingController.applyCredentialToApplication);

// Get mapping history for an application
router.get('/applications/:applicationId/mapping-history', credentialMappingController.getMappingHistory);

// Get field mapping suggestions for a credential type
router.get('/mapping-suggestions/:credentialType', credentialMappingController.getFieldMappingSuggestions);

// Normalize a field value based on target type
router.post('/normalize-field', credentialMappingController.normalizeFieldValue);

module.exports = router;
