/**
 * OneLogin Auth Routes for FEP
 * 
 * Handles authentication flow with the OneLogin OIDC provider
 */

const express = require('express');
const router = express.Router();
const { findOrCreateUserFromOneLogin, validateOneLoginToken, isOneLoginAuthenticated } = require('../controllers/oneloginAuthController');
const oneloginOAuthClientService = require('../services/oneloginOAuthClientService');
const crypto = require('crypto');

// Initiate OneLogin login - redirects user to OneLogin for authentication
router.get('/onelogin', async (req, res) => {
    try {
        // First ensure OAuth client is registered
        await oneloginOAuthClientService.registerClient();

        // Generate state parameter to prevent CSRF
        const state = crypto.randomBytes(16).toString('hex');

        // Store state in session for validation later
        req.session = req.session || {};
        req.session.oneloginOauthState = state;

        // Generate authorization URL and redirect user
        const authorizationUrl = oneloginOAuthClientService.getAuthorizationUrl(state, {
            scope: 'openid profile email webid'
        });

        res.redirect(authorizationUrl);
    } catch (error) {
        console.error('[ONELOGIN] Error initiating OneLogin login:', error);
        res.status(500).json({
            error: {
                code: 'auth/onelogin-login-error',
                message: 'Error initiating OneLogin login'
            }
        });
    }
});

// OneLogin OAuth callback - handles the authorization code from OneLogin
router.get('/onelogin-callback', async (req, res) => {
    try {
        const { code, state } = req.query;

        // Validate state parameter to prevent CSRF
        if (!state || !req.session || state !== req.session.oneloginOauthState) {
            return res.status(400).json({
                error: {
                    code: 'auth/invalid-state',
                    message: 'Invalid state parameter'
                }
            });
        }

        // Clear the state from session
        delete req.session.oneloginOauthState;

        // Exchange authorization code for tokens
        const tokens = await oneloginOAuthClientService.exchangeCodeForTokens(code);

        // Get user info from OneLogin
        const userInfo = await oneloginOAuthClientService.getUserInfo(tokens.access_token);

        // Find or create user based on the OneLogin identity
        const user = await findOrCreateUserFromOneLogin(userInfo, tokens);

        // Set session and cookies
        req.session.userEmail = user.email;
        req.session.oneloginTokens = tokens;

        // Redirect to user dashboard or home
        res.redirect('/dashboard');
    } catch (error) {
        console.error('[ONELOGIN] Error processing OneLogin OAuth callback:', error);
        res.status(500).json({
            error: {
                code: 'auth/callback-error',
                message: 'Error processing authentication callback'
            }
        });
    }
});

// Refresh OneLogin token
router.post('/onelogin-refresh', async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({
            error: {
                code: 'auth/missing-refresh-token',
                message: 'Refresh token is required'
            }
        });
    }

    try {
        // Refresh the OneLogin token
        const newTokens = await oneloginOAuthClientService.refreshToken(refreshToken);

        // Update session with new tokens
        req.session.oneloginTokens = newTokens;

        return res.json({
            token: newTokens.access_token,
            refreshToken: newTokens.refresh_token,
            expiresIn: newTokens.expires_in
        });
    } catch (error) {
        console.error('[ONELOGIN] Error refreshing OneLogin token:', error);
        res.status(500).json({
            error: {
                code: 'auth/refresh-error',
                message: 'Error refreshing token'
            }
        });
    }
});

// Get JWT token for frontend when authenticated with OneLogin
router.get('/onelogin-token', async (req, res) => {
    try {
        // Check if user has a valid OneLogin session
        if (!req.session || !req.session.oneloginTokens || !req.session.oneloginTokens.access_token) {
            return res.status(401).json({
                error: {
                    code: 'auth/not-authenticated',
                    message: 'Not authenticated with OneLogin'
                }
            });
        }

        try {
            // Get user info from OneLogin
            const userInfo = await oneloginOAuthClientService.getUserInfo(req.session.oneloginTokens.access_token);

            // Generate JWT token for frontend
            const jwt = require('jsonwebtoken');
            const JWT_SECRET = process.env.JWT_SECRET || 'fep-service-secret-key';

            const token = jwt.sign(
                {
                    email: userInfo.email,
                    name: userInfo.name,
                    webId: userInfo.webid
                },
                JWT_SECRET,
                { expiresIn: '8h' }
            );

            return res.json({
                token,
                user: {
                    name: userInfo.name,
                    email: userInfo.email,
                    webId: userInfo.webid
                }
            });
        } catch (error) {
            console.error('[ONELOGIN] Error generating token:', error);
            return res.status(401).json({
                error: {
                    code: 'auth/token-generation-error',
                    message: 'Error generating authentication token'
                }
            });
        }
    } catch (error) {
        console.error('[ONELOGIN] Error in onelogin-token:', error);
        return res.status(500).json({
            error: {
                code: 'auth/server-error',
                message: 'Internal server error'
            }
        });
    }
});

// Validate OneLogin token
router.post('/onelogin-validate', validateOneLoginToken);

// Check if user is authenticated with OneLogin
router.get('/onelogin-status', isOneLoginAuthenticated);

// Get client registration status
router.get('/client-status', async (req, res) => {
    try {
        const clientRegistration = oneloginOAuthClientService.clientRegistration;

        return res.json({
            registered: !!clientRegistration,
            clientRegistration: clientRegistration ? {
                client_id: clientRegistration.client_id,
                redirect_uris: clientRegistration.redirect_uris,
                client_name: clientRegistration.client_name,
                scope: clientRegistration.scope
            } : null
        });
    } catch (error) {
        console.error('[ONELOGIN] Error getting client status:', error);
        res.status(500).json({
            error: {
                code: 'auth/client-status-error',
                message: 'Error getting client status'
            }
        });
    }
});

module.exports = router;
