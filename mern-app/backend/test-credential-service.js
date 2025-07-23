/**
 * Test script for WebID alias handling
 * 
 * This script tests the credential service functions with WebID alias handling
 */

// Import the required services
const pdsCredentialService = require('./services/pdsCredentialService');
const oneloginOAuthClientService = require('./services/oneloginOAuthClientService');

// Mock the session object
const mockSession = {
    webId: 'https://identity.gov.uk/users/123456',
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token'
};

// Mock the resolveWebId function in the oneloginOAuthClientService
oneloginOAuthClientService.resolveWebId = async (webId) => {
    console.log(`[MOCK] Resolving WebID: ${webId}`);
    return {
        masterWebId: 'https://identity.gov.uk/users/123456',
        aliases: {
            'fep.gov.uk': 'https://identity.gov.uk/users/123456/audience/fep.gov.uk',
            'dro.gov.uk': 'https://identity.gov.uk/users/123456/audience/dro.gov.uk'
        }
    };
};

// Mock the pdsAuthService.getActiveSession function
const pdsAuthService = require('./services/pdsAuthService');
pdsAuthService.getActiveSession = async (customerId) => {
    console.log(`[MOCK] Getting active session for user: ${customerId}`);
    return mockSession;
};

// Mock axios for HTTP requests
const axios = require('axios');
// Create mock functions manually instead of using Jest
axios.get = async (url) => {
    if (url.includes('/credentials?type=FormDataCredential')) {
        return {
            data: [{
                id: 'mock-form-credential',
                issuanceDate: new Date().toISOString(),
                credentialSubject: {
                    id: 'test-user',
                    formData: { name: "John Doe", field1: "value1", field2: "value2" }
                }
            }]
        };
    }
    return { data: [{ id: 'mock-credential-1' }] };
};
axios.post = async () => ({ data: { id: 'mock-credential-id' } });

// Mock the extractPdsUrl function
const pdsService = require('./services/pdsService');
pdsService.extractPdsUrl = (webId) => {
    console.log(`[MOCK] Extracting PDS URL from WebID: ${webId}`);
    return 'https://pod.example.org/data';
};

// Disable MongoDB connection in dynamodbService.js
const mongoose = require('mongoose');
mongoose.connect = () => {
    console.log('[MOCK] Mocked MongoDB connection');
    return { connection: { on: () => { } } };
};

// Test function to run the tests
async function runTests() {
    console.log('=== TESTING WEBID ALIAS HANDLING ===');

    // Test 1: Store credential with no audience
    console.log('\nTEST 1: Store credential with no audience');
    try {
        const mockCredential = {
            "@context": ["https://www.w3.org/2018/credentials/v1"],
            "type": ["VerifiableCredential", "TestCredential"],
            "credentialSubject": { "id": "test-user", "test": "data-1" }
        };

        const result = await pdsCredentialService.storeCredential('test-user', mockCredential);
        console.log('Store credential result:', result);
        console.log('SUCCESS: Stored credential without audience');
    } catch (error) {
        console.error('Test 1 failed:', error);
    }

    // Test 2: Store credential with audience
    console.log('\nTEST 2: Store credential with audience');
    try {
        const mockCredential = {
            "@context": ["https://www.w3.org/2018/credentials/v1"],
            "type": ["VerifiableCredential", "TestCredential"],
            "credentialSubject": { "id": "test-user", "test": "data-2" }
        };

        const result = await pdsCredentialService.storeCredential('test-user', mockCredential, 'fep.gov.uk');
        console.log('Store credential result:', result);
        console.log('SUCCESS: Stored credential with audience');
    } catch (error) {
        console.error('Test 2 failed:', error);
    }

    // Test 3: Get credentials with no audience
    console.log('\nTEST 3: Get credentials with no audience');
    try {
        const credentials = await pdsCredentialService.getCredentials('test-user');
        console.log('Get credentials result:', credentials);
        console.log('SUCCESS: Retrieved credentials without audience');
    } catch (error) {
        console.error('Test 3 failed:', error);
    }

    // Test 4: Get credentials with audience
    console.log('\nTEST 4: Get credentials with audience');
    try {
        const credentials = await pdsCredentialService.getCredentials('test-user', { audience: 'fep.gov.uk' });
        console.log('Get credentials result:', credentials);
        console.log('SUCCESS: Retrieved credentials with audience');
    } catch (error) {
        console.error('Test 4 failed:', error);
    }

    // Test 5: Process form data with audience
    console.log('\nTEST 5: Process form data with audience');
    try {
        const formData = { name: "John Doe", field1: "value1", field2: "value2" };
        const result = await pdsCredentialService.processFormData('test-user', formData, 'fep.gov.uk');
        console.log('Process form data result:', result);
        console.log('SUCCESS: Processed form data with audience');
    } catch (error) {
        console.error('Test 5 failed:', error);
    }

    // Test 6: Get form data with audience
    console.log('\nTEST 6: Get form data with audience');
    try {
        const formData = await pdsCredentialService.getFormDataFromCredentials('test-user', 'fep.gov.uk');
        console.log('Get form data result:', formData);
        console.log('SUCCESS: Retrieved form data with audience');
    } catch (error) {
        console.error('Test 6 failed:', error);
    }

    console.log('\n=== TESTING COMPLETE ===');
}

// Run the tests
runTests()
    .then(() => console.log('All tests completed'))
    .catch(error => console.error('Error running tests:', error));
