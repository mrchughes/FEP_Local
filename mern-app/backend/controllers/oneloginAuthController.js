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
 * Resolve a WebID alias to its master WebID
 * If the WebID is already a master WebID, it will be returned unchanged
 * 
 * @param {string} webId - The WebID or WebID alias to resolve
 * @returns {string} The master WebID
 */
const resolveWebIdAlias = async (webId) => {
    try {
        // Government services receive direct WebIDs, no need to resolve
        if (process.env.CLIENT_TYPE === 'government') {
            console.log(`[ONELOGIN] Government service using direct WebID: ${webId}`);
            return webId;
        }

        // For private services, resolve the WebID alias
        const response = await oneloginOAuthClientService.resolveWebId(webId);

        // If resolution was successful, return the master WebID
        if (response && response.masterWebId) {
            console.log(`[ONELOGIN] Resolved alias WebID ${webId} to master WebID ${response.masterWebId}`);
            return response.masterWebId;
        }

        // If there's no master WebID in the response, assume the WebID is already a master WebID
        return webId;
    } catch (error) {
        console.error(`[ONELOGIN] Error resolving WebID alias ${webId}:`, error);
        // If resolution fails, just return the original WebID
        return webId;
    }
};

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

        // For government services, use the direct WebID
        // For private services, resolve the WebID alias
        const webId = await resolveWebIdAlias(userInfo.webid);

        // Track if this is an alias
        const isAlias = webId !== userInfo.webid;

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
                webId: webId,
                email: userInfo.email || user.email,
                name: userInfo.name || user.name,
                isOneLoginUser: true,
                oneLoginSubject: userInfo.sub,
                oneLoginMetadata: {
                    lastLogin: new Date().toISOString(),
                    tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
                    serviceType: process.env.CLIENT_TYPE || 'unknown'
                },
                webIdAliases: user.webIdAliases || []
            };

            // Add the alias WebID to the user's aliases if it's not already there and it's different from the master WebID
            if (isAlias && !updatedUser.webIdAliases.includes(userInfo.webid)) {
                updatedUser.webIdAliases = [...(updatedUser.webIdAliases || []), userInfo.webid];

                // If there's metadata about the alias, store it
                if (!updatedUser.webIdAliasMetadata) {
                    updatedUser.webIdAliasMetadata = {};
                }

                updatedUser.webIdAliasMetadata[userInfo.webid] = {
                    createdAt: new Date().toISOString(),
                    serviceType: process.env.CLIENT_TYPE || 'unknown',
                    serviceName: process.env.SERVICE_NAME || 'FEP Service',
                    lastUsed: new Date().toISOString()
                };
            }

            await updateUser(updatedUser);
            return updatedUser;
        }

        // If user doesn't exist, create a new one
        const newUser = {
            name: userInfo.name,
            email: userInfo.email.toLowerCase(),
            webId: webId,
            isOneLoginUser: true,
            oneLoginSubject: userInfo.sub,
            oneLoginMetadata: {
                lastLogin: new Date().toISOString(),
                tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
                serviceType: process.env.CLIENT_TYPE || 'unknown'
            },
            // Store the access token for PDS operations
            pdsTokens: {
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
            }
        };

        // Initialize WebID aliases array with the alias if it's different from the master WebID
        if (isAlias) {
            newUser.webIdAliases = [userInfo.webid];
            newUser.webIdAliasMetadata = {
                [userInfo.webid]: {
                    createdAt: new Date().toISOString(),
                    serviceType: process.env.CLIENT_TYPE || 'unknown',
                    serviceName: process.env.SERVICE_NAME || 'FEP Service',
                    lastUsed: new Date().toISOString()
                }
            };
        } else {
            newUser.webIdAliases = [];
        }

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

            // Resolve WebID alias if needed
            const webId = await resolveWebIdAlias(userInfo.webid);

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

            // Update user's WebID and aliases if needed
            let updatedUser = { ...user };
            let needsUpdate = false;

            if (user.webId !== webId) {
                updatedUser.webId = webId;
                needsUpdate = true;
            }

            // Add the alias WebID to the user's aliases if it's not already there and it's different from the master WebID
            if (webId !== userInfo.webid && (!user.webIdAliases || !user.webIdAliases.includes(userInfo.webid))) {
                updatedUser.webIdAliases = [...(user.webIdAliases || []), userInfo.webid];
                needsUpdate = true;
            }

            if (needsUpdate) {
                await updateUser(updatedUser);
            }

            // Generate a new JWT for FEP service
            const fepToken = jwt.sign(
                {
                    email: updatedUser.email,
                    name: updatedUser.name,
                    webId: updatedUser.webId
                },
                JWT_SECRET,
                { expiresIn: TOKEN_EXPIRY }
            );

            return res.json({
                token: fepToken,
                expiresIn: parseInt(TOKEN_EXPIRY) * 3600,
                user: {
                    name: updatedUser.name,
                    email: updatedUser.email,
                    webId: updatedUser.webId,
                    webIdAliases: updatedUser.webIdAliases || []
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
