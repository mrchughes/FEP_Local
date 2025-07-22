// backend/services/pdsCredentialService.js
const axios = require('axios');
const pdsAuthService = require('./pdsAuthService');
const { extractPdsUrl } = require('./pdsService');

/**
 * Build headers with authorization token
 * @param {Object} session - The PDS user session
 * @returns {Object} - The headers object
 */
const buildAuthHeaders = (session) => {
    return {
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json'
    };
};

/**
 * Store a verifiable credential in the user's PDS
 * @param {string} customerId - The user's ID 
 * @param {Object} credential - The verifiable credential to store
 * @returns {Object} - The response from the PDS
 */
const storeCredential = async (customerId, credential) => {
    // Get active session
    const session = await pdsAuthService.getActiveSession(customerId);
    if (!session) {
        throw new Error('No active PDS session found');
    }

    // Extract PDS data URL from WebID
    const pdsUrl = extractPdsUrl(session.webId);
    const credentialsEndpoint = `${pdsUrl}/credentials`;

    try {
        // Store credential in PDS
        const response = await axios.post(
            credentialsEndpoint,
            credential,
            { headers: buildAuthHeaders(session) }
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
 * @returns {Array} - Array of credentials
 */
const getCredentials = async (customerId, options = {}) => {
    // Get active session
    const session = await pdsAuthService.getActiveSession(customerId);
    if (!session) {
        throw new Error('No active PDS session found');
    }

    // Extract PDS data URL from WebID
    const pdsUrl = extractPdsUrl(session.webId);
    let credentialsEndpoint = `${pdsUrl}/credentials`;

    // Add query parameters for filtering if provided
    if (options.type) {
        const url = new URL(credentialsEndpoint);
        url.searchParams.append('type', options.type);
        credentialsEndpoint = url.toString();
    }

    try {
        // Get credentials from PDS
        const response = await axios.get(
            credentialsEndpoint,
            { headers: buildAuthHeaders(session) }
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
 * @returns {Object} - The created and stored credential
 */
const processFormData = async (customerId, formData) => {
    try {
        // Create verifiable credential from form data
        const credential = await createFormDataCredential(customerId, formData);

        // Store credential in user's PDS
        const result = await storeCredential(customerId, credential);

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
 * @returns {Object} - The form data from credentials
 */
const getFormDataFromCredentials = async (customerId) => {
    try {
        // Get form data credentials
        const credentials = await getCredentials(customerId, { type: 'FormDataCredential' });

        if (!credentials || credentials.length === 0) {
            return null;
        }

        // Sort by issuance date (newest first)
        credentials.sort((a, b) => {
            return new Date(b.issuanceDate) - new Date(a.issuanceDate);
        });

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
    getCredentialById
};

/**
 * Get a specific credential by ID from the user's PDS
 * @param {string} customerId - The user's ID
 * @param {string} credentialId - The ID of the credential to retrieve
 * @returns {Object} - The credential if found, null otherwise
 */
async function getCredentialById(customerId, credentialId) {
    try {
        // Get active session
        const session = await pdsAuthService.getActiveSession(customerId);
        if (!session) {
            throw new Error('No active PDS session found');
        }

        // Extract PDS data URL from WebID
        const pdsUrl = extractPdsUrl(session.webId);
        const credentialEndpoint = `${pdsUrl}/credentials/${encodeURIComponent(credentialId)}`;

        // Get the specific credential from PDS
        const response = await axios.get(
            credentialEndpoint,
            { headers: buildAuthHeaders(session) }
        );

        return response.data;
    } catch (error) {
        console.error(`Error retrieving credential ${credentialId} from PDS:`, error);
        // Return null instead of throwing, so caller can handle missing credential gracefully
        return null;
    }
}
