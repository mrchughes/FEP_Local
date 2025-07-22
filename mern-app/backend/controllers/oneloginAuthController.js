/**
 * OneLogin Auth Controller
 * 
 * Handles authentication with OneLogin OIDC provider
 */

const jwt = require('jsonwebtoken');
const { findUserByEmail, createUser, updateUser } = require('../services/dynamodbService');
const oneloginOAuthClientService = require('../services/oneloginOAuthClientService');

const JWT_SECRET = process.env.JWT_SECRET || 'fep-service-secret-key';
const TOKEN_EXPIRY = '8h';

/**
 * Find or create a user based on OneLogin identity
 * 
 * @param {Object} userInfo - User info from OneLogin
 * @param {Object} tokens - OAuth tokens from OneLogin
 * @returns {Object} User object
 */
exports.findOrCreateUserFromOneLogin = async (userInfo, tokens) => {
    try {
        // Check if WebID exists in the userInfo
        if (!userInfo.webid) {
            throw new Error('WebID not found in OneLogin user info');
        }

        // Try to find user by email
        let user = null;
        if (userInfo.email) {
            user = await findUserByEmail(userInfo.email.toLowerCase());
        }

        // If user exists, update with OneLogin info
        if (user) {
            // Update user with OneLogin info
            const updatedUser = {
                ...user,
                webId: userInfo.webid,
                email: userInfo.email || user.email,
                name: userInfo.name || user.name,
                isOneLoginUser: true,
                oneLoginSubject: userInfo.sub,
                oneLoginMetadata: {
                    lastLogin: new Date().toISOString(),
                    tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
                }
            };

            await updateUser(updatedUser);
            return updatedUser;
        }

        // If user doesn't exist, create a new one
        const newUser = {
            name: userInfo.name,
            email: userInfo.email.toLowerCase(),
            webId: userInfo.webid,
            isOneLoginUser: true,
            oneLoginSubject: userInfo.sub,
            oneLoginMetadata: {
                lastLogin: new Date().toISOString(),
                tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
            },
            // Store the access token for PDS operations
            pdsTokens: {
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
            }
        };

        await createUser(newUser);
        return newUser;
    } catch (error) {
        console.error('[ONELOGIN] Error finding or creating user from OneLogin:', error);
        throw error;
    }
};

/**
 * Validate a OneLogin token
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.validateOneLoginToken = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                error: {
                    code: 'auth/missing-token',
                    message: 'Token is required'
                }
            });
        }

        // Verify token with OneLogin
        try {
            // Get user info using the token
            const userInfo = await oneloginOAuthClientService.getUserInfo(token);

            // Find user by email
            const user = await findUserByEmail(userInfo.email.toLowerCase());

            if (!user) {
                return res.status(404).json({
                    error: {
                        code: 'auth/user-not-found',
                        message: 'User not found'
                    }
                });
            }

            // Generate a new JWT for FEP service
            const fepToken = jwt.sign(
                {
                    email: user.email,
                    name: user.name,
                    webId: user.webId
                },
                JWT_SECRET,
                { expiresIn: TOKEN_EXPIRY }
            );

            return res.json({
                token: fepToken,
                expiresIn: parseInt(TOKEN_EXPIRY) * 3600,
                user: {
                    name: user.name,
                    email: user.email,
                    webId: user.webId
                }
            });
        } catch (error) {
            console.error('[ONELOGIN] Error validating OneLogin token:', error);
            return res.status(401).json({
                error: {
                    code: 'auth/invalid-token',
                    message: 'Invalid or expired token'
                }
            });
        }
    } catch (error) {
        console.error('[ONELOGIN] Error in validateOneLoginToken:', error);
        return res.status(500).json({
            error: {
                code: 'auth/server-error',
                message: 'Internal server error'
            }
        });
    }
};

/**
 * Check if a user is authenticated with OneLogin
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.isOneLoginAuthenticated = async (req, res) => {
    try {
        // Check if user has valid OneLogin tokens in session
        if (!req.session || !req.session.oneloginTokens || !req.session.oneloginTokens.access_token) {
            return res.json({ authenticated: false });
        }

        try {
            // Try to get user info with the access token
            await oneloginOAuthClientService.getUserInfo(req.session.oneloginTokens.access_token);
            return res.json({ authenticated: true });
        } catch (error) {
            // Token might be expired, try to refresh
            if (req.session.oneloginTokens.refresh_token) {
                try {
                    const newTokens = await oneloginOAuthClientService.refreshToken(
                        req.session.oneloginTokens.refresh_token
                    );

                    // Update session with new tokens
                    req.session.oneloginTokens = newTokens;
                    return res.json({ authenticated: true });
                } catch (refreshError) {
                    // Refresh failed, user needs to authenticate again
                    delete req.session.oneloginTokens;
                    return res.json({ authenticated: false });
                }
            } else {
                // No refresh token, user needs to authenticate again
                delete req.session.oneloginTokens;
                return res.json({ authenticated: false });
            }
        }
    } catch (error) {
        console.error('[ONELOGIN] Error in isOneLoginAuthenticated:', error);
        return res.status(500).json({
            error: {
                code: 'auth/server-error',
                message: 'Internal server error'
            }
        });
    }
};
