/**
 * Test script for multi-audience WebID handling
 * 
 * This script tests retrieving credentials from multiple audiences
 */

// Import the required services
const pdsCredentialService = require('./services/pdsCredentialService');
const oneloginOAuthClientService = require('./services/oneloginOAuthClientService');

// Backup the original resolveWebId function
const originalResolveWebId = oneloginOAuthClientService.resolveWebId;

// Create a mock resolveWebId function that returns multiple WebID aliases
oneloginOAuthClientService.resolveWebId = async (webId) => {
    console.log(`[MOCK] resolveWebId called for ${webId}`);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 30));

    // Return mock WebID data with aliases
    return {
        id: webId,
        aliases: {
            'fep.gov.uk': `${webId.split('#')[0]}/alias/fep#me`,
            'hmrc.gov.uk': `${webId.split('#')[0]}/alias/hmrc#me`,
            'dwp.gov.uk': `${webId.split('#')[0]}/alias/dwp#me`
        }
    };
};

// Create a mock for the pdsAuthService
const pdsAuthService = require('./services/pdsAuthService');
const originalGetActiveSession = pdsAuthService.getActiveSession;

pdsAuthService.getActiveSession = async (customerId) => {
    console.log(`[MOCK] getActiveSession called for ${customerId}`);
    return {
        accessToken: 'mock-token',
        webId: 'https://pod.example.org/profile/card#me'
    };
};

// Create a mock for axios
const axios = require('axios');
const originalAxiosGet = axios.get;

// Mock credentials for each audience
const mockCredentials = {
    'fep.gov.uk': [
        {
            id: 'credential-1-fep',
            type: ['VerifiableCredential', 'FormDataCredential'],
            issuanceDate: '2023-01-01T00:00:00Z',
            credentialSubject: {
                id: 'test-user',
                formData: {
                    name: 'John Smith',
                    source: 'FEP Service'
                }
            }
        }
    ],
    'hmrc.gov.uk': [
        {
            id: 'credential-1-hmrc',
            type: ['VerifiableCredential', 'FormDataCredential'],
            issuanceDate: '2023-02-01T00:00:00Z',
            credentialSubject: {
                id: 'test-user',
                formData: {
                    name: 'John Smith',
                    taxId: '123456789',
                    source: 'HMRC Service'
                }
            }
        }
    ],
    'dwp.gov.uk': [
        {
            id: 'credential-1-dwp',
            type: ['VerifiableCredential', 'FormDataCredential'],
            issuanceDate: '2023-03-01T00:00:00Z',
            credentialSubject: {
                id: 'test-user',
                formData: {
                    name: 'John Smith',
                    benefitId: 'B123456',
                    source: 'DWP Service'
                }
            }
        }
    ]
};

axios.get = async (url, options) => {
    console.log(`[MOCK] axios.get called for ${url}`);

    // Extract audience from headers
    const audience = options?.headers?.['X-WebID-Audience'];
    console.log(`[MOCK] Using audience: ${audience || 'default'}`);

    // Determine which mock credentials to return based on audience
    let credentials;
    if (audience && mockCredentials[audience]) {
        credentials = mockCredentials[audience];
    } else {
        // Default to FEP credentials for testing
        credentials = mockCredentials['fep.gov.uk'];
    }

    // Return mock response
    return {
        data: credentials
    };
};

// Utility to extract PDS URL from WebID (used in the service)
const { extractPdsUrl } = require('./services/pdsService');
const originalExtractPdsUrl = extractPdsUrl;

// Mock extractPdsUrl to always return a valid URL
if (typeof extractPdsUrl !== 'function') {
    global.extractPdsUrl = (webId) => {
        console.log(`[MOCK] extractPdsUrl called for ${webId}`);
        // For testing, just return a mock PDS URL
        return 'https://pod.example.org/data';
    };
} else {
    // Save the original function if it exists
    global.originalExtractPdsUrl = extractPdsUrl;

    // Override with our mock
    global.extractPdsUrl = (webId) => {
        console.log(`[MOCK] extractPdsUrl called for ${webId}`);
        // For testing, just return a mock PDS URL
        return 'https://pod.example.org/data';
    };
}

// Test function to run the tests
async function runTests() {
    console.log('=== TESTING MULTI-AUDIENCE WEBID HANDLING ===');

    // Force development environment to enable logs
    process.env.NODE_ENV = 'development';

    // Test 1: Get credentials from a single audience
    console.log('\nTEST 1: Get credentials from a single audience (fep.gov.uk)');
    try {
        const credentials = await pdsCredentialService.getCredentials('test-user', {
            audience: 'fep.gov.uk'
        });

        console.log(`Found ${credentials.length} credentials`);
        console.log('First credential source:', credentials[0].credentialSubject.formData.source);
    } catch (error) {
        console.error('Test 1 failed:', error);
    }

    // Test 2: Get credentials from multiple audiences
    console.log('\nTEST 2: Get credentials from multiple audiences (fep.gov.uk, hmrc.gov.uk)');
    try {
        const credentials = await pdsCredentialService.getCredentials('test-user', {
            audience: ['fep.gov.uk', 'hmrc.gov.uk']
        });

        console.log(`Found ${credentials.length} credentials from multiple audiences`);
        credentials.forEach((credential, index) => {
            console.log(`Credential ${index + 1} source:`, credential.credentialSubject.formData.source);
            if (credential._sourceAudience) {
                console.log(`Credential ${index + 1} audience:`, credential._sourceAudience);
            }
        });
    } catch (error) {
        console.error('Test 2 failed:', error);
    }

    // Test 3: Get form data from a single audience
    console.log('\nTEST 3: Get form data from a single audience (dwp.gov.uk)');
    try {
        const formData = await pdsCredentialService.getFormDataFromCredentials('test-user', 'dwp.gov.uk');

        console.log('Form data:', formData);
    } catch (error) {
        console.error('Test 3 failed:', error);
    }

    // Test 4: Get form data from multiple audiences
    console.log('\nTEST 4: Get form data from multiple audiences (fep.gov.uk, hmrc.gov.uk, dwp.gov.uk)');
    try {
        const formData = await pdsCredentialService.getFormDataFromCredentials('test-user',
            ['fep.gov.uk', 'hmrc.gov.uk', 'dwp.gov.uk']);

        console.log('Form data from multiple audiences:', formData);
        if (formData._sourceAudience) {
            console.log('Source audience:', formData._sourceAudience);
        }
    } catch (error) {
        console.error('Test 4 failed:', error);
    }

    // Restore original functions
    oneloginOAuthClientService.resolveWebId = originalResolveWebId;
    pdsAuthService.getActiveSession = originalGetActiveSession;
    axios.get = originalAxiosGet;

    // Restore extractPdsUrl if we modified it
    if (global.originalExtractPdsUrl) {
        global.extractPdsUrl = global.originalExtractPdsUrl;
    }

    console.log('\n=== TESTING COMPLETE ===');
}

// Run the tests
runTests()
    .then(() => console.log('All tests completed'))
    .catch(error => console.error('Error running tests:', error));
