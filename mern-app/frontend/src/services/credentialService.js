// frontend/src/services/credentialService.js
import api from '../api';

/**
 * Get credentials from the user's PDS
 * @param {Object} options - Options for filtering credentials
 * @param {string} options.type - Filter credentials by type
 * @param {string|string[]} options.audience - The audience(s) to use for the request
 * @returns {Promise<Array>} - Array of credentials
 */
export const getCredentials = async (options = {}) => {
    try {
        // Build query parameters
        const queryParams = new URLSearchParams();
        if (options.type) {
            queryParams.append('type', options.type);
        }

        // Handle audience parameter(s)
        if (options.audience) {
            if (Array.isArray(options.audience)) {
                // Join multiple audiences with commas
                queryParams.append('audience', options.audience.join(','));
            } else {
                queryParams.append('audience', options.audience);
            }
        }

        const queryString = queryParams.toString();
        const endpoint = queryString ? `/credentials?${queryString}` : '/credentials';

        const response = await api.get(endpoint);
        return response.data;
    } catch (error) {
        console.error('Error getting credentials:', error);
        throw new Error(error.response?.data?.message || 'Failed to get credentials');
    }
};

/**
 * Store a credential in the user's PDS
 * @param {Object} credential - The credential to store
 * @param {string} audience - The audience to use for the credential (optional)
 * @returns {Promise<Object>} - Response from the server
 */
export const storeCredential = async (credential, audience) => {
    try {
        // Build endpoint with optional audience parameter
        const endpoint = audience ? `/credentials?audience=${encodeURIComponent(audience)}` : '/credentials';

        const response = await api.post(endpoint, credential);
        return response.data;
    } catch (error) {
        console.error('Error storing credential:', error);
        throw new Error(error.response?.data?.message || 'Failed to store credential');
    }
};

/**
 * Get form data from verifiable credentials
 * @param {string|string[]} audience - The audience(s) to use for the request (optional)
 * @returns {Promise<Object>} - Form data from credentials
 */
export const getFormData = async (audience) => {
    try {
        // Build endpoint with optional audience parameter(s)
        let endpoint = '/credentials/form-data';

        if (audience) {
            const queryParams = new URLSearchParams();

            if (Array.isArray(audience)) {
                // Join multiple audiences with commas
                queryParams.append('audience', audience.join(','));
            } else {
                queryParams.append('audience', audience);
            }

            endpoint = `${endpoint}?${queryParams.toString()}`;
        }

        const response = await api.get(endpoint);
        return response.data;
    } catch (error) {
        // Return null if no form data found instead of throwing error
        if (error.response?.status === 404) {
            return null;
        }
        console.error('Error getting form data:', error);
        throw new Error(error.response?.data?.message || 'Failed to get form data');
    }
};

/**
 * Store form data as a verifiable credential
 * @param {Object} formData - The form data to store
 * @param {string} audience - The audience to use for the credential (optional)
 * @returns {Promise<Object>} - Response from the server
 */
export const storeFormData = async (formData, audience) => {
    try {
        // Build endpoint with optional audience parameter
        const endpoint = audience ? `/credentials/form-data?audience=${encodeURIComponent(audience)}` : '/credentials/form-data';

        const response = await api.post(endpoint, formData);
        return response.data;
    } catch (error) {
        console.error('Error storing form data:', error);
        throw new Error(error.response?.data?.message || 'Failed to store form data');
    }
};
