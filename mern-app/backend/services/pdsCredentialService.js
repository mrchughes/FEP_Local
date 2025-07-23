// backend/services/pdsCredentialService.js
const axios = require('axios');
const pdsAuthService = require('./pdsAuthService');
const { extractPdsUrl } = require('./pdsService');
const oneloginOAuthClientService = require('./oneloginOAuthClientService');

// WebID resolution cache
// Using a simple in-memory cache with TTL (Time To Live)
const webIdCache = {
    cache: {},
    pendingPromises: {}, // Track in-flight resolutions
    // TTL in milliseconds (default: 5 minutes)
    ttl: process.env.WEBID_CACHE_TTL || 5 * 60 * 1000,

    // Get a cached WebID
    get: function (key) {
        // Check if there's a pending promise for this key
        if (this.pendingPromises[key]) {
            if (process.env.NODE_ENV === 'development') {
                console.log(`[CACHE] Using pending promise for ${key}`);
            }
            return { pending: this.pendingPromises[key] };
        }

        const item = this.cache[key];
        if (!item) return null;

        // Check if cache entry has expired
        if (Date.now() > item.expires) {
            delete this.cache[key];
            return null;
        }

        return item.value;
    },

    // Store a WebID in cache
    set: function (key, value) {
        const expires = Date.now() + this.ttl;
        this.cache[key] = { value, expires };

        // Log cache operation if in verbose mode
        if (process.env.NODE_ENV === 'development') {
            console.log(`[CACHE] WebID cached for ${key}, expires in ${this.ttl / 1000}s`);
        }
    },

    // Track a pending promise for a key
    setPending: function (key, promise) {
        this.pendingPromises[key] = promise;

        // Remove from pending once resolved or rejected
        promise.finally(() => {
            delete this.pendingPromises[key];
        });
    },

    // Generate a cache key from webId and audience
    generateKey: function (webId, audience) {
        return `${webId}:${audience || 'default'}`;
    },

    // Clear the entire cache or a specific key
    clear: function (key) {
        if (key) {
            delete this.cache[key];
            delete this.pendingPromises[key];
        } else {
            this.cache = {};
            this.pendingPromises = {};
        }

        if (process.env.NODE_ENV === 'development') {
            console.log(`[CACHE] WebID cache ${key ? `for ${key} ` : ''}cleared`);
        }
    }
};

/**
 * Build headers with authorization token
 * @param {Object} session - The PDS user session
 * @param {string} audience - The audience to use for the request (optional)
 * @returns {Object} - The headers object
 */
const buildAuthHeaders = (session, audience) => {
    const headers = {
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json'
    };

    // Add audience header if provided
    if (audience) {
        headers['X-WebID-Audience'] = audience;
    }

    return headers;
};

/**
 * Resolve the WebID to use for credential operations
 * @param {string} webId - The WebID to resolve
 * @param {string|string[]} audience - The audience(s) to use for the request (optional)
 * @returns {Promise<string|string[]>} - The resolved WebID(s)
 */
const resolveWebId = async (webId, audience) => {
    // If no audience specified, use the master WebID
    if (!audience) {
        return webId;
    }

    // Handle array of audiences (return array of resolved WebIDs)
    if (Array.isArray(audience)) {
        if (audience.length === 0) {
            return webId;
        }

        // Resolve each audience and return array of WebIDs
        const resolvedWebIds = await Promise.all(
            audience.map(singleAudience => resolveWebId(webId, singleAudience))
        );

        return resolvedWebIds;
    }

    // Single audience handling (original behavior)
    // Generate cache key and check cache first
    const cacheKey = webIdCache.generateKey(webId, audience);
    const cacheResult = webIdCache.get(cacheKey);

    // Handle different cache results
    if (cacheResult) {
        // If there's a pending promise, reuse it
        if (cacheResult.pending) {
            if (process.env.NODE_ENV === 'development') {
                console.log(`[PDS CREDENTIAL] Waiting for in-progress WebID resolution for audience ${audience}`);
            }
            return cacheResult.pending;
        }

        // If we have a cached value, use it
        if (process.env.NODE_ENV === 'development') {
            console.log(`[PDS CREDENTIAL] Using cached WebID for audience ${audience}: ${cacheResult}`);
        }
        return cacheResult;
    }

    // Create a promise for the resolution and track it
    const resolutionPromise = (async () => {
        try {
            // If audience is specified, check if we need to use an alias WebID
            const resolvedWebId = await oneloginOAuthClientService.resolveWebId(webId);
            if (resolvedWebId && resolvedWebId.aliases && resolvedWebId.aliases[audience]) {
                const aliasWebId = resolvedWebId.aliases[audience];
                console.log(`[PDS CREDENTIAL] Using alias WebID for audience ${audience}: ${aliasWebId}`);

                // Cache the resolved WebID
                webIdCache.set(cacheKey, aliasWebId);

                return aliasWebId;
            }

            // Cache the original WebID as fallback
            webIdCache.set(cacheKey, webId);
            return webId;
        } catch (error) {
            console.error(`[PDS CREDENTIAL] Error resolving WebID alias: ${error.message}`);
            // Fall back to the original WebID if resolution fails
            return webId;
        }
    })();

    // Track this promise in the cache
    webIdCache.setPending(cacheKey, resolutionPromise);

    return resolutionPromise;
};

/**
 * Store a verifiable credential in the user's PDS
 * @param {string} customerId - The user's ID 
 * @param {Object} credential - The verifiable credential to store
 * @param {string} audience - The audience to use for the credential (optional)
 * @returns {Object} - The response from the PDS
 */
const storeCredential = async (customerId, credential, audience) => {
    // Get active session
    const session = await pdsAuthService.getActiveSession(customerId);
    if (!session) {
        throw new Error('No active PDS session found');
    }

    // Resolve WebID for the appropriate audience if needed
    const effectiveWebId = await resolveWebId(session.webId, audience);

    // Extract PDS data URL from the effective WebID
    const pdsUrl = extractPdsUrl(effectiveWebId);
    const credentialsEndpoint = `${pdsUrl}/credentials`;

    try {
        // Store credential in PDS with appropriate audience headers
        const response = await axios.post(
            credentialsEndpoint,
            credential,
            { headers: buildAuthHeaders(session, audience) }
        );

        return response.data;
    } catch (error) {
        console.error('Error storing credential in PDS:', error);
        throw new Error(`Failed to store credential: ${error.message}`);
    }
};

/**
 * Retrieve verifiable credentials from the user's PDS
 * @param {string} customerId - The user's ID
 * @param {Object} options - Options for filtering credentials
 * @param {string} options.type - Filter credentials by type
 * @param {string|string[]} options.audience - The audience(s) to use for the request
 * @returns {Array} - Array of credentials
 */
const getCredentials = async (customerId, options = {}) => {
    // Get active session
    const session = await pdsAuthService.getActiveSession(customerId);
    if (!session) {
        throw new Error('No active PDS session found');
    }

    // Handle multiple audiences if provided
    if (Array.isArray(options.audience) && options.audience.length > 0) {
        console.log(`[PDS CREDENTIAL] Retrieving credentials for multiple audiences: ${options.audience.join(', ')}`);

        // Resolve WebIDs for all audiences
        const resolvedWebIds = await resolveWebId(session.webId, options.audience);

        // Retrieve credentials from each PDS endpoint
        const allCredentialsPromises = resolvedWebIds.map(async (webId, index) => {
            try {
                const currentAudience = options.audience[index];
                const pdsUrl = extractPdsUrl(webId);
                let credentialsEndpoint = `${pdsUrl}/credentials`;

                // Add query parameters for filtering if provided
                if (options.type) {
                    const url = new URL(credentialsEndpoint);
                    url.searchParams.append('type', options.type);
                    credentialsEndpoint = url.toString();
                }

                // Get credentials from PDS with appropriate audience headers
                const response = await axios.get(
                    credentialsEndpoint,
                    { headers: buildAuthHeaders(session, currentAudience) }
                );

                // Tag credentials with their source audience
                return response.data.map(credential => ({
                    ...credential,
                    _sourceAudience: currentAudience
                }));
            } catch (error) {
                console.error(`[PDS CREDENTIAL] Error retrieving credentials for audience ${options.audience[index]}: ${error.message}`);
                return []; // Return empty array for failed requests
            }
        });

        // Combine results from all PDSs and deduplicate
        const allCredentialsArrays = await Promise.all(allCredentialsPromises);
        const allCredentials = allCredentialsArrays.flat();

        // Deduplicate by credential ID if needed
        const uniqueCredentials = allCredentials.reduce((unique, credential) => {
            // If credential already exists, keep the one with more information or the first one
            const existingIndex = unique.findIndex(c => c.id === credential.id);
            if (existingIndex >= 0) {
                // Keep credential with more properties or more recent issuanceDate
                if (Object.keys(credential).length > Object.keys(unique[existingIndex]).length ||
                    (credential.issuanceDate && unique[existingIndex].issuanceDate &&
                        new Date(credential.issuanceDate) > new Date(unique[existingIndex].issuanceDate))) {
                    unique[existingIndex] = credential;
                }
            } else {
                unique.push(credential);
            }
            return unique;
        }, []);

        return uniqueCredentials;
    }

    // Single audience or no audience handling (original behavior)
    // Resolve WebID for the appropriate audience if needed
    const effectiveWebId = await resolveWebId(session.webId, options.audience);

    // Extract PDS data URL from the effective WebID
    const pdsUrl = extractPdsUrl(effectiveWebId);
    let credentialsEndpoint = `${pdsUrl}/credentials`;

    // Add query parameters for filtering if provided
    if (options.type) {
        const url = new URL(credentialsEndpoint);
        url.searchParams.append('type', options.type);
        credentialsEndpoint = url.toString();
    }

    try {
        // Get credentials from PDS with appropriate audience headers
        const response = await axios.get(
            credentialsEndpoint,
            { headers: buildAuthHeaders(session, options.audience) }
        );

        return response.data;
    } catch (error) {
        console.error('Error retrieving credentials from PDS:', error);
        throw new Error(`Failed to retrieve credentials: ${error.message}`);
    }
};

/**
 * Create a verifiable credential for form data
 * @param {string} customerId - The user's ID
 * @param {Object} formData - The form data to create a credential for
 * @returns {Object} - The created credential
 */
const createFormDataCredential = async (customerId, formData) => {
    // This is a placeholder for actual credential creation
    // In a real implementation, you would use a proper VC library

    const credential = {
        "@context": [
            "https://www.w3.org/2018/credentials/v1",
            "https://www.w3.org/2018/credentials/examples/v1"
        ],
        "id": `urn:uuid:${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
        "type": ["VerifiableCredential", "FormDataCredential"],
        "issuer": process.env.SERVICE_URL || "https://funeral-expense-service.example.org",
        "issuanceDate": new Date().toISOString(),
        "credentialSubject": {
            "id": customerId,
            "formData": formData
        }
    };

    return credential;
};

/**
 * Process and store form data as a verifiable credential
 * @param {string} customerId - The user's ID
 * @param {Object} formData - The form data to process
 * @param {string} audience - The audience to use for the credential (optional)
 * @returns {Object} - The created and stored credential
 */
const processFormData = async (customerId, formData, audience) => {
    try {
        // Create verifiable credential from form data
        const credential = await createFormDataCredential(customerId, formData);

        // Store credential in user's PDS with optional audience parameter
        const result = await storeCredential(customerId, credential, audience);

        return {
            success: true,
            credentialId: credential.id,
            result
        };
    } catch (error) {
        console.error('Error processing form data:', error);
        throw new Error(`Failed to process form data: ${error.message}`);
    }
};

/**
 * Get form data from verifiable credentials
 * @param {string} customerId - The user's ID
 * @param {string|string[]} audience - The audience(s) to use for the request (optional)
 * @returns {Object} - The form data from credentials
 */
const getFormDataFromCredentials = async (customerId, audience) => {
    try {
        // Get form data credentials with optional audience parameter(s)
        const credentials = await getCredentials(customerId, {
            type: 'FormDataCredential',
            audience
        });

        if (!credentials || credentials.length === 0) {
            return null;
        }

        // Sort by issuance date (newest first)
        credentials.sort((a, b) => {
            return new Date(b.issuanceDate) - new Date(a.issuanceDate);
        });

        // For multiple audiences, we may want to include source audience info
        if (Array.isArray(audience) && audience.length > 1 && credentials[0]._sourceAudience) {
            // Include the source audience in the form data
            const formData = credentials[0].credentialSubject.formData;
            return {
                ...formData,
                _sourceAudience: credentials[0]._sourceAudience
            };
        }

        // Return the form data from the most recent credential
        return credentials[0].credentialSubject.formData;
    } catch (error) {
        console.error('Error getting form data from credentials:', error);
        throw new Error(`Failed to get form data from credentials: ${error.message}`);
    }
};

module.exports = {
    storeCredential,
    getCredentials,
    createFormDataCredential,
    processFormData,
    getFormDataFromCredentials,
    getCredentialById,
    // Export resolveWebId for testing
    resolveWebId
};

/**
 * Get a specific credential by ID from the user's PDS
 * @param {string} customerId - The user's ID
 * @param {string} credentialId - The ID of the credential to retrieve
 * @param {string} audience - The audience to use for the request (optional)
 * @returns {Object} - The credential if found, null otherwise
 */
async function getCredentialById(customerId, credentialId, audience) {
    try {
        // Get active session
        const session = await pdsAuthService.getActiveSession(customerId);
        if (!session) {
            throw new Error('No active PDS session found');
        }

        // Resolve WebID for the appropriate audience if needed
        const effectiveWebId = await resolveWebId(session.webId, audience);

        // Extract PDS data URL from the effective WebID
        const pdsUrl = extractPdsUrl(effectiveWebId);
        const credentialEndpoint = `${pdsUrl}/credentials/${encodeURIComponent(credentialId)}`;

        // Get the specific credential from PDS with appropriate audience headers
        const response = await axios.get(
            credentialEndpoint,
            { headers: buildAuthHeaders(session, audience) }
        );

        return response.data;
    } catch (error) {
        console.error(`Error retrieving credential ${credentialId} from PDS:`, error);
        // Return null instead of throwing, so caller can handle missing credential gracefully
        return null;
    }
}
