/**
 * Test script for WebID alias handling in the credential controller
 * 
 * This script tests the credential controller functions with WebID alias handling
 */

// Import the required controller
const pdsCredentialController = require('./controllers/pdsCredentialController');
const pdsCredentialService = require('./services/pdsCredentialService');

// Mock the pdsCredentialService methods
const originalStoreCredential = pdsCredentialService.storeCredential;
const originalGetCredentials = pdsCredentialService.getCredentials;
const originalProcessFormData = pdsCredentialService.processFormData;
const originalGetFormDataFromCredentials = pdsCredentialService.getFormDataFromCredentials;

pdsCredentialService.storeCredential = async (customerId, credential, audience) => {
    console.log(`[MOCK SERVICE] storeCredential called with audience: ${audience}`);
    return { id: 'mock-credential-id', audience };
};

pdsCredentialService.getCredentials = async (customerId, options) => {
    console.log(`[MOCK SERVICE] getCredentials called with audience: ${options?.audience}`);
    return [{ id: 'mock-credential-1', audience: options?.audience }];
};

pdsCredentialService.processFormData = async (customerId, formData, audience) => {
    console.log(`[MOCK SERVICE] processFormData called with audience: ${audience}`);
    return { success: true, credentialId: 'mock-credential-id', audience };
};

pdsCredentialService.getFormDataFromCredentials = async (customerId, audience) => {
    console.log(`[MOCK SERVICE] getFormDataFromCredentials called with audience: ${audience}`);
    return { name: "John Doe", field1: "value1", field2: "value2", audience };
};

// Create mock req, res objects
const createMockReq = (query = {}, body = {}) => ({
    user: { id: 'test-user' },
    query,
    body
});

const createMockRes = () => {
    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
    return res;
};

// Helper function to create a mock response
function createRes() {
    const res = {};
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data) => {
        res.body = data;
        return res;
    };
    return res;
}

// Test function to run the tests
async function runTests() {
    console.log('=== TESTING CREDENTIAL CONTROLLER WEBID ALIAS HANDLING ===');

    // Test 1: List credentials with no audience
    console.log('\nTEST 1: List credentials with no audience');
    try {
        const req = createMockReq({ type: 'TestCredential' });
        const res = createRes();

        await pdsCredentialController.listCredentials(req, res);
        console.log('Response:', res.body);
        console.log('SUCCESS: Listed credentials without audience');
    } catch (error) {
        console.error('Test 1 failed:', error);
    }

    // Test 2: List credentials with audience
    console.log('\nTEST 2: List credentials with audience');
    try {
        const req = createMockReq({ type: 'TestCredential', audience: 'fep.gov.uk' });
        const res = createRes();

        await pdsCredentialController.listCredentials(req, res);
        console.log('Response:', res.body);
        console.log('SUCCESS: Listed credentials with audience');
    } catch (error) {
        console.error('Test 2 failed:', error);
    }

    // Test 3: Store credential with no audience
    console.log('\nTEST 3: Store credential with no audience');
    try {
        const credential = {
            "@context": ["https://www.w3.org/2018/credentials/v1"],
            "type": ["VerifiableCredential", "TestCredential"],
            "credentialSubject": { "id": "test-user", "test": "data" }
        };
        const req = createMockReq({}, credential);
        const res = createRes();

        await pdsCredentialController.storeCredential(req, res);
        console.log('Response:', res.body);
        console.log('SUCCESS: Stored credential without audience');
    } catch (error) {
        console.error('Test 3 failed:', error);
    }

    // Test 4: Store credential with audience
    console.log('\nTEST 4: Store credential with audience');
    try {
        const credential = {
            "@context": ["https://www.w3.org/2018/credentials/v1"],
            "type": ["VerifiableCredential", "TestCredential"],
            "credentialSubject": { "id": "test-user", "test": "data" }
        };
        const req = createMockReq({ audience: 'fep.gov.uk' }, credential);
        const res = createRes();

        await pdsCredentialController.storeCredential(req, res);
        console.log('Response:', res.body);
        console.log('SUCCESS: Stored credential with audience');
    } catch (error) {
        console.error('Test 4 failed:', error);
    }

    // Test 5: Store form data with no audience
    console.log('\nTEST 5: Store form data with no audience');
    try {
        const formData = { name: "John Doe", field1: "value1", field2: "value2" };
        const req = createMockReq({}, formData);
        const res = createRes();

        await pdsCredentialController.storeFormData(req, res);
        console.log('Response:', res.body);
        console.log('SUCCESS: Stored form data without audience');
    } catch (error) {
        console.error('Test 5 failed:', error);
    }

    // Test 6: Store form data with audience
    console.log('\nTEST 6: Store form data with audience');
    try {
        const formData = { name: "John Doe", field1: "value1", field2: "value2" };
        const req = createMockReq({ audience: 'fep.gov.uk' }, formData);
        const res = createRes();

        await pdsCredentialController.storeFormData(req, res);
        console.log('Response:', res.body);
        console.log('SUCCESS: Stored form data with audience');
    } catch (error) {
        console.error('Test 6 failed:', error);
    }

    // Test 7: Get form data with no audience
    console.log('\nTEST 7: Get form data with no audience');
    try {
        const req = createMockReq();
        const res = createRes();

        await pdsCredentialController.getFormData(req, res);
        console.log('Response:', res.body);
        console.log('SUCCESS: Got form data without audience');
    } catch (error) {
        console.error('Test 7 failed:', error);
    }

    // Test 8: Get form data with audience
    console.log('\nTEST 8: Get form data with audience');
    try {
        const req = createMockReq({ audience: 'fep.gov.uk' });
        const res = createRes();

        await pdsCredentialController.getFormData(req, res);
        console.log('Response:', res.body);
        console.log('SUCCESS: Got form data with audience');
    } catch (error) {
        console.error('Test 8 failed:', error);
    }

    console.log('\n=== TESTING COMPLETE ===');

    // Restore original service methods
    pdsCredentialService.storeCredential = originalStoreCredential;
    pdsCredentialService.getCredentials = originalGetCredentials;
    pdsCredentialService.processFormData = originalProcessFormData;
    pdsCredentialService.getFormDataFromCredentials = originalGetFormDataFromCredentials;
}

// Run the tests
runTests()
    .then(() => console.log('All tests completed'))
    .catch(error => console.error('Error running tests:', error));
