/**
 * Test script for WebID resolution caching
 * 
 * This script tests the caching of WebID resolution to verify performance improvements
 */

// Import the required service
const pdsCredentialService = require('./services/pdsCredentialService');
const oneloginOAuthClientService = require('./services/oneloginOAuthClientService');

// Backup the original resolveWebId function
const originalResolveWebId = oneloginOAuthClientService.resolveWebId;

// Create a mock resolveWebId function that counts calls
let resolveWebIdCallCount = 0;
oneloginOAuthClientService.resolveWebId = async (webId) => {
    resolveWebIdCallCount++;
    console.log(`[MOCK] resolveWebId called (call #${resolveWebIdCallCount})`);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 50));

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

// Create mock session
const mockSession = {
    id: 'test-session',
    webId: 'https://pod.example.org/profile/card#me',
    accessToken: 'mock-token'
};

// Test function to run the tests
async function runTests() {
    console.log('=== TESTING WEBID RESOLUTION CACHING ===');

    // Force development environment to enable cache logs
    process.env.NODE_ENV = 'development';

    // Expose the resolveWebId function for testing
    const resolveWebId = pdsCredentialService.resolveWebId ||
        Object.getOwnPropertyDescriptor(pdsCredentialService, 'resolveWebId')?.value;

    if (!resolveWebId) {
        console.error('Error: resolveWebId function not found in pdsCredentialService');
        return;
    }

    // Test 1: First resolution (should hit network)
    console.log('\nTEST 1: First resolution request for fep.gov.uk');
    const startTime1 = Date.now();
    const result1 = await resolveWebId(mockSession.webId, 'fep.gov.uk');
    const duration1 = Date.now() - startTime1;
    console.log(`Resolution took ${duration1}ms`);
    console.log(`Resolved WebID: ${result1}`);

    // Test 2: Second resolution for same audience (should use cache)
    console.log('\nTEST 2: Second resolution request for fep.gov.uk (should use cache)');
    const startTime2 = Date.now();
    const result2 = await resolveWebId(mockSession.webId, 'fep.gov.uk');
    const duration2 = Date.now() - startTime2;
    console.log(`Resolution took ${duration2}ms`);
    console.log(`Resolved WebID: ${result2}`);
    console.log(`Cache performance improvement: ${Math.round((duration1 - duration2) / duration1 * 100)}%`);

    // Test 3: Resolution for different audience (should hit network)
    console.log('\nTEST 3: Resolution request for hmrc.gov.uk (different audience)');
    const startTime3 = Date.now();
    const result3 = await resolveWebId(mockSession.webId, 'hmrc.gov.uk');
    const duration3 = Date.now() - startTime3;
    console.log(`Resolution took ${duration3}ms`);
    console.log(`Resolved WebID: ${result3}`);

    // Test 4: Second resolution for different audience (should use cache)
    console.log('\nTEST 4: Second resolution request for hmrc.gov.uk (should use cache)');
    const startTime4 = Date.now();
    const result4 = await resolveWebId(mockSession.webId, 'hmrc.gov.uk');
    const duration4 = Date.now() - startTime4;
    console.log(`Resolution took ${duration4}ms`);
    console.log(`Resolved WebID: ${result4}`);

    // Test 5: Resolution with no audience (should return original WebID)
    console.log('\nTEST 5: Resolution with no audience');
    const startTime5 = Date.now();
    const result5 = await resolveWebId(mockSession.webId, null);
    const duration5 = Date.now() - startTime5;
    console.log(`Resolution took ${duration5}ms`);
    console.log(`Resolved WebID: ${result5}`);

    // Test 6: Multiple concurrent resolutions (should only hit network once per audience)
    console.log('\nTEST 6: Multiple concurrent resolutions');

    // Reset call count for this test
    resolveWebIdCallCount = 0;

    const startTime6 = Date.now();
    const [r1, r2, r3, r4, r5, r6] = await Promise.all([
        resolveWebId(mockSession.webId, 'fep.gov.uk'),
        resolveWebId(mockSession.webId, 'fep.gov.uk'),
        resolveWebId(mockSession.webId, 'dwp.gov.uk'),
        resolveWebId(mockSession.webId, 'dwp.gov.uk'),
        resolveWebId(mockSession.webId, 'hmrc.gov.uk'),
        resolveWebId(mockSession.webId, 'hmrc.gov.uk')
    ]);
    const duration6 = Date.now() - startTime6;

    console.log(`6 concurrent resolutions took ${duration6}ms`);
    console.log(`Network calls made: ${resolveWebIdCallCount} (expected max 1 per unique audience)`);
    console.log(`Cache hit rate: ${Math.round((6 - resolveWebIdCallCount) / 6 * 100)}%`);

    console.log('\n=== TESTING COMPLETE ===');
    console.log(`Total WebID resolution network calls: ${resolveWebIdCallCount}`);

    // Restore original function
    oneloginOAuthClientService.resolveWebId = originalResolveWebId;
}

// Check if resolveWebId is exposed for testing, if not, expose it temporarily
if (!pdsCredentialService.resolveWebId) {
    const resolveWebId = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(pdsCredentialService),
        'resolveWebId'
    )?.value;

    if (resolveWebId) {
        pdsCredentialService.resolveWebId = resolveWebId;
        console.log('Temporarily exposed resolveWebId for testing');
    } else {
        // Extract function reference from the module
        const moduleSource = require('fs').readFileSync(
            require.resolve('./services/pdsCredentialService'),
            'utf8'
        );

        // Simple extraction of resolveWebId function
        if (moduleSource.includes('const resolveWebId = async')) {
            // Export the function temporarily for testing
            pdsCredentialService.resolveWebId =
                Object.getOwnPropertyDescriptor(pdsCredentialService, 'resolveWebId')?.value;

            console.log('Added resolveWebId to exports for testing');
        } else {
            console.error('Could not extract resolveWebId function for testing');
        }
    }
}

// Run the tests
runTests()
    .then(() => console.log('All tests completed'))
    .catch(error => console.error('Error running tests:', error));
