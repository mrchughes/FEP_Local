/**
 * Authentication Middleware
 * 
 * Middleware to authenticate requests using JWT or OneLogin tokens
 */

const jwt = require('jsonwebtoken');
const { findUserByEmail } = require('../services/dynamodbService');
const oneloginOAuthClientService = require('../services/oneloginOAuthClientService');

const JWT_SECRET = process.env.JWT_SECRET || 'fep-service-secret-key';

/**
 * Middleware to authenticate JWT tokens
 */
exports.authenticate = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: {
                    code: 'auth/no-token',
                    message: 'No token provided'
                }
            });
        }

        const token = authHeader.split(' ')[1];

        try {
            // Verify token
            const decoded = jwt.verify(token, JWT_SECRET);

            // Find user by email
            const user = await findUserByEmail(decoded.email);
            if (!user) {
                return res.status(401).json({
                    error: {
                        code: 'auth/user-not-found',
                        message: 'User not found'
                    }
                });
            }

            // Set user on request
            req.user = user;
            next();
        } catch (error) {
            console.error('[AUTH] JWT verification error:', error);
            return res.status(401).json({
                error: {
                    code: 'auth/invalid-token',
                    message: 'Invalid or expired token'
                }
            });
        }
    } catch (error) {
        console.error('[AUTH] Authentication error:', error);
        return res.status(500).json({
            error: {
                code: 'auth/server-error',
                message: 'Internal server error'
            }
        });
    }
};

/**
 * Middleware to authenticate OneLogin tokens
 */
exports.authenticateOneLogin = async (req, res, next) => {
    try {
        // First check if user has a session with OneLogin tokens
        if (req.session && req.session.oneloginTokens && req.session.oneloginTokens.access_token) {
            try {
                // Verify the token with OneLogin
                const userInfo = await oneloginOAuthClientService.getUserInfo(req.session.oneloginTokens.access_token);

                // Find user by email
                const user = await findUserByEmail(userInfo.email.toLowerCase());
                if (!user) {
                    return res.status(401).json({
                        error: {
                            code: 'auth/user-not-found',
                            message: 'User not found'
                        }
                    });
                }

                // Set user on request
                req.user = user;
                next();
                return;
            } catch (error) {
                // Token might be expired, try to refresh
                if (req.session.oneloginTokens.refresh_token) {
                    try {
                        const newTokens = await oneloginOAuthClientService.refreshToken(
                            req.session.oneloginTokens.refresh_token
                        );

                        // Update session with new tokens
                        req.session.oneloginTokens = newTokens;

                        // Verify the new token with OneLogin
                        const userInfo = await oneloginOAuthClientService.getUserInfo(newTokens.access_token);

                        // Find user by email
                        const user = await findUserByEmail(userInfo.email.toLowerCase());
                        if (!user) {
                            return res.status(401).json({
                                error: {
                                    code: 'auth/user-not-found',
                                    message: 'User not found'
                                }
                            });
                        }

                        // Set user on request
                        req.user = user;
                        next();
                        return;
                    } catch (refreshError) {
                        // Refresh failed, continue to check bearer token
                        delete req.session.oneloginTokens;
                    }
                }
            }
        }

        // If no session or session validation failed, check for bearer token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: {
                    code: 'auth/no-token',
                    message: 'No token provided'
                }
            });
        }

        const token = authHeader.split(' ')[1];

        // First try to validate as a OneLogin token
        try {
            const userInfo = await oneloginOAuthClientService.getUserInfo(token);

            // Find user by email
            const user = await findUserByEmail(userInfo.email.toLowerCase());
            if (!user) {
                return res.status(401).json({
                    error: {
                        code: 'auth/user-not-found',
                        message: 'User not found'
                    }
                });
            }

            // Set user on request
            req.user = user;
            next();
            return;
        } catch (oneloginError) {
            // Not a valid OneLogin token, try as JWT token
            try {
                // Verify token
                const decoded = jwt.verify(token, JWT_SECRET);

                // Find user by email
                const user = await findUserByEmail(decoded.email);
                if (!user) {
                    return res.status(401).json({
                        error: {
                            code: 'auth/user-not-found',
                            message: 'User not found'
                        }
                    });
                }

                // Set user on request
                req.user = user;
                next();
            } catch (jwtError) {
                console.error('[AUTH] Token verification error:', jwtError);
                return res.status(401).json({
                    error: {
                        code: 'auth/invalid-token',
                        message: 'Invalid or expired token'
                    }
                });
            }
        }
    } catch (error) {
        console.error('[AUTH] Authentication error:', error);
        return res.status(500).json({
            error: {
                code: 'auth/server-error',
                message: 'Internal server error'
            }
        });
    }
};
