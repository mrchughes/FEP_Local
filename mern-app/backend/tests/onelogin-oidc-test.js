// Test script for OneLogin OIDC integration
const axios = require('axios');
const querystring = require('querystring');
const dotenv = require('dotenv');
const crypto = require('crypto');

// Load environment variables
dotenv.config();

// Configuration
const OIDC_PROVIDER_URL = process.env.OIDC_PROVIDER_URL || 'http://onelogin.local';
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:5000/auth/onelogin-callback';

async function testOIDCDiscovery() {
    console.log('\n--- Testing OIDC Discovery ---');
    try {
        const discoveryUrl = `${OIDC_PROVIDER_URL}/.well-known/openid-configuration`;
        console.log(`Fetching OIDC discovery from: ${discoveryUrl}`);

        const response = await axios.get(discoveryUrl);

        if (response.data && response.data.issuer) {
            console.log('✅ OIDC discovery successful');
            console.log(`Issuer: ${response.data.issuer}`);
            console.log(`Authorization endpoint: ${response.data.authorization_endpoint}`);
            console.log(`Token endpoint: ${response.data.token_endpoint}`);
            console.log(`Userinfo endpoint: ${response.data.userinfo_endpoint}`);
            return response.data;
        } else {
            console.error('❌ OIDC discovery failed: Incomplete discovery document');
            return null;
        }
    } catch (error) {
        console.error('❌ OIDC discovery failed:', error.message);
        return null;
    }
}

async function testClientCredentials() {
    console.log('\n--- Testing Client Credentials ---');

    if (!CLIENT_ID || !CLIENT_SECRET) {
        console.error('❌ Client credentials missing: Set CLIENT_ID and CLIENT_SECRET in .env file');
        return false;
    }

    console.log(`Client ID: ${CLIENT_ID.substring(0, 5)}...`);
    console.log(`Client Secret: ${CLIENT_SECRET.substring(0, 3)}...`);
    console.log('✅ Client credentials configured');
    return true;
}

async function testRedirectURI() {
    console.log('\n--- Testing Redirect URI ---');

    if (!REDIRECT_URI) {
        console.error('❌ Redirect URI missing: Set REDIRECT_URI in .env file');
        return false;
    }

    try {
        // Check if the redirect URI is a valid URL
        new URL(REDIRECT_URI);
        console.log(`Redirect URI: ${REDIRECT_URI}`);
        console.log('✅ Redirect URI is valid');
        return true;
    } catch (error) {
        console.error('❌ Redirect URI is invalid:', error.message);
        return false;
    }
}

async function testAuthorizationFlow(discoveryDoc) {
    console.log('\n--- Testing Authorization Flow (simulation) ---');

    if (!discoveryDoc || !discoveryDoc.authorization_endpoint) {
        console.error('❌ Authorization flow test failed: No discovery document or authorization endpoint');
        return false;
    }

    // Generate a random state and nonce
    const state = crypto.randomBytes(16).toString('hex');
    const nonce = crypto.randomBytes(16).toString('hex');

    // Build authorization URL
    const authParams = {
        response_type: 'code',
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: 'openid profile email webid',
        state,
        nonce
    };

    const authUrl = `${discoveryDoc.authorization_endpoint}?${querystring.stringify(authParams)}`;

    console.log('Authorization URL would be:');
    console.log(authUrl);
    console.log('✅ Authorization URL constructed successfully');

    return true;
}

async function runTests() {
    console.log('=== OneLogin OIDC Integration Test ===');

    // Test OIDC discovery
    const discoveryDoc = await testOIDCDiscovery();

    // Test client credentials
    const clientCredsValid = await testClientCredentials();

    // Test redirect URI
    const redirectURIValid = await testRedirectURI();

    // Test authorization flow
    if (discoveryDoc && clientCredsValid && redirectURIValid) {
        await testAuthorizationFlow(discoveryDoc);
    }

    console.log('\n=== Test Summary ===');
    console.log(`OIDC Discovery: ${discoveryDoc ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Client Credentials: ${clientCredsValid ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Redirect URI: ${redirectURIValid ? '✅ PASSED' : '❌ FAILED'}`);
}

// Run the tests
runTests().catch(err => {
    console.error('Error running tests:', err);
});
