/**
 * Test script for WebID alias handling
 * 
 * This script tests the functionality of the WebID alias resolution
 * in the pdsCredentialService.js file.
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
axios.get = async () => ({ data: [] });
axios.post = async () => ({ data: { id: 'mock-credential-id' } });

// Mock the extractPdsUrl function
const pdsService = require('./services/pdsService');
pdsService.extractPdsUrl = (webId) => {
    console.log(`[MOCK] Extracting PDS URL from WebID: ${webId}`);
    return 'https://pod.example.org/data';
};

// Test function to run the tests
async function runTests() {
    console.log('=== TESTING WEBID ALIAS HANDLING ===');

    // Test 1: No audience specified - should use master WebID
    console.log('\nTEST 1: No audience specified');
    try {
        const resolvedWebId = await pdsCredentialService.resolveWebId(mockSession.webId);
        console.log(`Resolved WebID: ${resolvedWebId}`);
        console.assert(resolvedWebId === mockSession.webId, 'Should return the master WebID');
    } catch (error) {
        console.error('Test 1 failed:', error);
    }

    // Test 2: Audience specified, alias exists
    console.log('\nTEST 2: Audience specified, alias exists');
    try {
        const resolvedWebId = await pdsCredentialService.resolveWebId(mockSession.webId, 'fep.gov.uk');
        console.log(`Resolved WebID: ${resolvedWebId}`);
        console.assert(
            resolvedWebId === 'https://identity.gov.uk/users/123456/audience/fep.gov.uk',
            'Should return the alias WebID for fep.gov.uk'
        );
    } catch (error) {
        console.error('Test 2 failed:', error);
    }

    // Test 3: Audience specified, alias doesn't exist
    console.log('\nTEST 3: Audience specified, alias doesn\'t exist');
    try {
        const resolvedWebId = await pdsCredentialService.resolveWebId(mockSession.webId, 'unknown.gov.uk');
        console.log(`Resolved WebID: ${resolvedWebId}`);
        console.assert(
            resolvedWebId === mockSession.webId,
            'Should return the master WebID when alias doesn\'t exist'
        );
    } catch (error) {
        console.error('Test 3 failed:', error);
    }

    // Test 4: Store credential with audience
    console.log('\nTEST 4: Store credential with audience');
    try {
        const mockCredential = {
            "@context": ["https://www.w3.org/2018/credentials/v1"],
            "type": ["VerifiableCredential", "TestCredential"],
            "credentialSubject": { "id": "test-user", "test": "data" }
        };

        const result = await pdsCredentialService.storeCredential('test-user', mockCredential, 'fep.gov.uk');
        console.log('Store credential result:', result);
    } catch (error) {
        console.error('Test 4 failed:', error);
    }

    // Test 5: Get credentials with audience
    console.log('\nTEST 5: Get credentials with audience');
    try {
        const credentials = await pdsCredentialService.getCredentials('test-user', { audience: 'fep.gov.uk' });
        console.log('Get credentials result:', credentials);
    } catch (error) {
        console.error('Test 5 failed:', error);
    }

    console.log('\n=== TESTING COMPLETE ===');
}

// Run the tests
runTests()
    .then(() => console.log('All tests completed'))
    .catch(error => console.error('Error running tests:', error));
