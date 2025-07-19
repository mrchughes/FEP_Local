// backend/routes/pdsCredentialRoutes.js
const express = require('express');
const router = express.Router();
const pdsCredentialController = require('../controllers/pdsCredentialController');
const authMiddleware = require('../middlewares/auth');

// Routes that require authentication
router.use(authMiddleware);

// Credential management
router.get('/', pdsCredentialController.listCredentials);
router.post('/', pdsCredentialController.storeCredential);

// Form data specific endpoints
router.post('/form-data', pdsCredentialController.storeFormData);
router.get('/form-data', pdsCredentialController.getFormData);

module.exports = router;
