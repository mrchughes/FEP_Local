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
const OIDC_PROVIDER_URL = process.env.ONELOGIN_BASE_URL || 'http://onelogin-oidc:3010';
const CLIENT_ID = process.env.ONELOGIN_CLIENT_ID;
const CLIENT_SECRET = process.env.ONELOGIN_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://fep.gov.uk.local/auth/onelogin-callback';
const CONFIG_PATH = path.join(__dirname, '../../config/onelogin-oauth-client.json');
const DOMAIN = process.env.FEP_DOMAIN || 'fep.gov.uk.local';
const CLIENT_TYPE = process.env.CLIENT_TYPE || 'government';
const DNS_VERIFICATION_URL = process.env.DNS_VERIFICATION_URL || 'http://dns-verification:3011';

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
                client_name: 'Financial Evidence Provider Service',
                scope: 'openid profile email webid',
                client_type: CLIENT_TYPE
            };
            this.saveClientRegistration();
            return this.clientRegistration;
        }

        try {
            // Get a verification token for DNS verification
            const verificationToken = await this.getDomainVerificationToken();

            // Register the client with the OneLogin OIDC provider
            const response = await axios.post(`${OIDC_PROVIDER_URL}/client/register`, {
                client_name: 'Financial Evidence Provider',
                redirect_uris: [REDIRECT_URI],
                grant_types: ['authorization_code', 'refresh_token'],
                response_types: ['code'],
                scope: 'openid profile email webid',
                domain: DOMAIN,
                client_type: CLIENT_TYPE,
                verification_token: verificationToken
            });

            this.clientRegistration = response.data;
            this.saveClientRegistration();

            // Verify domain ownership if this is a government service
            if (CLIENT_TYPE === 'government') {
                await this.verifyDomain();
            }

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
     * For government services, this should return the direct WebID
     * For private sector services, this resolves the alias to the master WebID
     */
    async resolveWebId(webId) {
        try {
            // For government services, tokens already contain the direct WebID
            if (CLIENT_TYPE === 'government') {
                return { webid: webId, isAlias: false, masterWebId: webId };
            }

            // For private sector services, resolve the alias to the master WebID
            const response = await axios.get(`${OIDC_PROVIDER_URL}/api/webid/resolve`, {
                params: { webid: webId },
                headers: {
                    'Authorization': `Bearer ${this.clientRegistration.client_secret}`
                }
            });

            return response.data;
        } catch (error) {
            console.error('[ONELOGIN] Error resolving WebID:', error.response?.data || error.message);
            // If resolution fails, return the original WebID as a fallback
            return { webid: webId, isAlias: false, masterWebId: webId, error: 'Resolution failed' };
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

    /**
     * Get a domain verification token from the OneLogin OIDC provider
     */
    async getDomainVerificationToken() {
        try {
            const response = await axios.get(`${OIDC_PROVIDER_URL}/api/dns-verification/token`, {
                params: { domain: DOMAIN }
            });

            const verificationToken = response.data.token;
            const recordName = response.data.recordName || `_pds-verification.${DOMAIN}`;

            console.log(`
            ============================================================================
            IMPORTANT: Add the following DNS TXT record to your domain for verification:
            
            ${recordName} TXT "pds-verification=${verificationToken}"
            
            After adding the record, the system will verify domain ownership.
            ============================================================================
            `);

            return verificationToken;
        } catch (error) {
            console.error('[ONELOGIN] Error getting verification token:', error.response?.data || error.message);
            throw new Error('Failed to get verification token for domain verification');
        }
    }

    /**
     * Verify domain ownership with OneLogin OIDC provider
     */
    async verifyDomain() {
        try {
            if (!this.clientRegistration) {
                throw new Error('OAuth client not registered');
            }

            // Call the DNS verification service to verify the domain
            const response = await axios.post(
                `${DNS_VERIFICATION_URL}/api/verify-domain`,
                {
                    domain: DOMAIN,
                    client_id: this.clientRegistration.client_id
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.clientRegistration.client_secret}`
                    }
                }
            );

            if (response.data.verified) {
                // Update the client registration with OneLogin to mark it as verified
                await axios.post(
                    `${OIDC_PROVIDER_URL}/api/client/update-verification`,
                    {
                        client_id: this.clientRegistration.client_id,
                        verified: true
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${this.clientRegistration.client_secret}`
                        }
                    }
                );

                console.log('[ONELOGIN] Domain verification successful!');
                return true;
            } else {
                console.error('[ONELOGIN] Domain verification failed:', response.data.error);
                return false;
            }
        } catch (error) {
            console.error('[ONELOGIN] Error verifying domain:', error.response?.data || error.message);

            // If this is a development environment, we'll simulate success
            if (process.env.NODE_ENV === 'development') {
                console.log('[ONELOGIN] Development environment detected. Bypassing DNS verification.');
                return true;
            }

            return false;
        }
    }
}

module.exports = new OneLoginOAuthClientService();
