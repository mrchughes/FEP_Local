/**
 * OAuth Client Service for FEP - OneLogin Integration
 * 
 * Implements OIDC authentication flow with OneLogin OIDC provider
 * Supports WebID alias resolution
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

// Configuration - these should be set as environment variables in production
const OIDC_PROVIDER_URL = process.env.OIDC_PROVIDER_URL || 'http://onelogin.local';
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://fep.local/auth/onelogin-callback';
const CONFIG_PATH = path.join(__dirname, '../../config/onelogin-oauth-client.json');
const DOMAIN = process.env.FEP_DOMAIN || 'fep.local';

class OneLoginOAuthClientService {
    constructor() {
        this.clientRegistration = null;
        this.loadClientRegistration();
    }

    /**
     * Load client registration from config file if it exists
     */
    loadClientRegistration() {
        try {
            if (fs.existsSync(CONFIG_PATH)) {
                this.clientRegistration = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
                console.log('[ONELOGIN] Loaded existing OneLogin OAuth client registration');
            } else if (CLIENT_ID && CLIENT_SECRET) {
                // If environment variables are provided, use them
                this.clientRegistration = {
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    redirect_uris: [REDIRECT_URI],
                    client_name: 'FEP Service',
                    scope: 'openid profile email webid'
                };
                this.saveClientRegistration();
            } else {
                console.log('[ONELOGIN] No client registration found');
            }
        } catch (error) {
            console.error('[ONELOGIN] Error loading OneLogin client registration:', error);
        }
    }

    /**
     * Save client registration to config file
     */
    saveClientRegistration() {
        try {
            // Ensure config directory exists
            const configDir = path.dirname(CONFIG_PATH);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }

            fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.clientRegistration, null, 2));
            console.log('[ONELOGIN] Saved OneLogin OAuth client registration');
        } catch (error) {
            console.error('[ONELOGIN] Error saving OneLogin client registration:', error);
        }
    }

    /**
     * Register the FEP as an OAuth client with OneLogin OIDC provider
     */
    async registerClient() {
        // If client is already registered, return the registration
        if (this.clientRegistration) {
            return this.clientRegistration;
        }

        // If environment variables are provided, use them
        if (CLIENT_ID && CLIENT_SECRET) {
            this.clientRegistration = {
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                redirect_uris: [REDIRECT_URI],
                client_name: 'FEP Service',
                scope: 'openid profile email webid'
            };
            this.saveClientRegistration();
            return this.clientRegistration;
        }

        try {
            // Register the client with the OneLogin OIDC provider
            const response = await axios.post(`${OIDC_PROVIDER_URL}/client/register`, {
                client_name: 'FEP Service',
                redirect_uris: [REDIRECT_URI],
                grant_types: ['authorization_code', 'refresh_token'],
                response_types: ['code'],
                scope: 'openid profile email webid',
                domain: DOMAIN
            });

            this.clientRegistration = response.data;
            this.saveClientRegistration();
            return this.clientRegistration;
        } catch (error) {
            console.error('[ONELOGIN] Error registering OAuth client with OneLogin:', error.response?.data || error.message);
            throw new Error('Failed to register OAuth client with OneLogin OIDC provider');
        }
    }

    /**
     * Get the authorization URL for redirecting the user to OneLogin
     */
    getAuthorizationUrl(state, options = {}) {
        if (!this.clientRegistration) {
            throw new Error('OAuth client not registered');
        }

        const params = {
            response_type: 'code',
            client_id: this.clientRegistration.client_id,
            redirect_uri: REDIRECT_URI,
            scope: options.scope || 'openid profile email webid',
            state: state,
            nonce: this.generateNonce()
        };

        return `${OIDC_PROVIDER_URL}/auth/authorize?${querystring.stringify(params)}`;
    }

    /**
     * Exchange authorization code for tokens
     */
    async exchangeCodeForTokens(code) {
        if (!this.clientRegistration) {
            throw new Error('OAuth client not registered');
        }

        try {
            const response = await axios.post(`${OIDC_PROVIDER_URL}/auth/token`,
                querystring.stringify({
                    grant_type: 'authorization_code',
                    code: code,
                    client_id: this.clientRegistration.client_id,
                    client_secret: this.clientRegistration.client_secret,
                    redirect_uri: REDIRECT_URI
                }),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('[ONELOGIN] Error exchanging code for tokens:', error.response?.data || error.message);
            throw new Error('Failed to exchange authorization code for tokens');
        }
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshToken(refreshToken) {
        if (!this.clientRegistration) {
            throw new Error('OAuth client not registered');
        }

        try {
            const response = await axios.post(`${OIDC_PROVIDER_URL}/auth/token`,
                querystring.stringify({
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken,
                    client_id: this.clientRegistration.client_id,
                    client_secret: this.clientRegistration.client_secret
                }),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('[ONELOGIN] Error refreshing token:', error.response?.data || error.message);
            throw new Error('Failed to refresh token');
        }
    }

    /**
     * Get user info using access token
     */
    async getUserInfo(accessToken) {
        try {
            const response = await axios.get(`${OIDC_PROVIDER_URL}/auth/userinfo`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            return response.data;
        } catch (error) {
            console.error('[ONELOGIN] Error fetching user info:', error.response?.data || error.message);
            throw new Error('Failed to fetch user info');
        }
    }

    /**
     * Resolve a WebID alias to its master WebID
     */
    async resolveWebId(webId) {
        try {
            const response = await axios.get(`${OIDC_PROVIDER_URL}/webid/resolve`, {
                params: { webid: webId }
            });

            return response.data;
        } catch (error) {
            console.error('[ONELOGIN] Error resolving WebID:', error.response?.data || error.message);
            throw new Error('Failed to resolve WebID');
        }
    }

    /**
     * Verify token with OneLogin
     */
    async verifyToken(token) {
        try {
            // Get user info using the token - if successful, token is valid
            const userInfo = await this.getUserInfo(token);
            return userInfo;
        } catch (error) {
            console.error('[ONELOGIN] Error verifying token:', error.response?.data || error.message);
            throw new Error('Failed to verify token');
        }
    }

    /**
     * Generate a random nonce for OIDC flow
     */
    generateNonce() {
        return Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);
    }
}

module.exports = new OneLoginOAuthClientService();
