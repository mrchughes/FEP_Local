const express = require('express');
const router = express.Router();
const oneloginOAuthClientService = require('../services/oneloginOAuthClientService');

/**
 * Get client registration status
 */
router.get('/status', async (req, res) => {
    try {
        const clientRegistration = oneloginOAuthClientService.clientRegistration;

        return res.json({
            registered: !!clientRegistration,
            clientRegistration: clientRegistration ? {
                client_id: clientRegistration.client_id,
                redirect_uris: clientRegistration.redirect_uris,
                client_name: clientRegistration.client_name,
                scope: clientRegistration.scope,
                domain: clientRegistration.domain || process.env.FEP_DOMAIN || 'fep.local'
            } : null
        });
    } catch (error) {
        console.error('[ONELOGIN] Error getting client status:', error);
        res.status(500).json({
            error: {
                code: 'client/status-error',
                message: 'Error getting client status'
            }
        });
    }
});

/**
 * Register client with OneLogin OIDC provider
 */
router.post('/register', async (req, res) => {
    try {
        // First try DNS verification
        try {
            await oneloginOAuthClientService.verifyDomainWithDNS();
        } catch (dnsError) {
            console.warn('[ONELOGIN] DNS verification failed:', dnsError.message);
            // In development, we'll continue despite DNS verification failure
            if (process.env.NODE_ENV !== 'development') {
                return res.status(400).json({
                    error: {
                        code: 'client/dns-verification-failed',
                        message: dnsError.message
                    }
                });
            }
        }

        // Register the client
        const clientRegistration = await oneloginOAuthClientService.registerClient();

        return res.json({
            success: true,
            clientRegistration: {
                client_id: clientRegistration.client_id,
                redirect_uris: clientRegistration.redirect_uris,
                client_name: clientRegistration.client_name,
                scope: clientRegistration.scope,
                domain: clientRegistration.domain || process.env.FEP_DOMAIN || 'fep.local'
            }
        });
    } catch (error) {
        console.error('[ONELOGIN] Error registering client:', error);
        res.status(500).json({
            error: {
                code: 'client/registration-error',
                message: 'Error registering client with OneLogin OIDC provider'
            }
        });
    }
});

module.exports = router;
