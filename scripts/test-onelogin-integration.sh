#!/bin/bash
# Test script for OneLogin integration

echo "FEP OneLogin Integration Test Script"
echo "-----------------------------------"

# Set variables
BASE_URL=${1:-"http://localhost:5000"}
ONELOGIN_URL="${BASE_URL}/auth/onelogin"
CLIENT_STATUS_URL="${BASE_URL}/auth/client-status"
AUTH_VALIDATE_URL="${BASE_URL}/auth/onelogin-validate"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test endpoints
test_endpoint() {
    local url=$1
    local description=$2
    local method=${3:-"GET"}
    local data=$4

    echo -e "\n${YELLOW}Testing ${description}${NC}"
    echo "URL: ${url}"
    echo "Method: ${method}"
    
    if [ "$method" == "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "${url}")
    else
        response=$(curl -s -w "\n%{http_code}" -X "${method}" -H "Content-Type: application/json" -d "${data}" "${url}")
    fi
    
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    echo "Status Code: ${status_code}"
    echo "Response: ${body}"
    
    if [[ "$status_code" == 2* ]]; then
        echo -e "${GREEN}Test passed!${NC}"
        return 0
    else
        echo -e "${RED}Test failed!${NC}"
        return 1
    fi
}

# Check if the OneLogin client is registered
check_client_registration() {
    echo -e "\n${YELLOW}Checking OneLogin client registration${NC}"
    
    # First, check if environment variables are set
    if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ]; then
        echo -e "${YELLOW}CLIENT_ID or CLIENT_SECRET not set in environment. Client registration may fail.${NC}"
    fi
    
    # This requires authentication in the real app, but we'll simplify for testing
    response=$(curl -s "${CLIENT_STATUS_URL}")
    if [[ "$response" == *"registered"* ]]; then
        echo -e "${GREEN}Client is registered${NC}"
        return 0
    else
        echo -e "${RED}Client is not registered${NC}"
        return 1
    fi
}

# Main test sequence
echo -e "\n${YELLOW}Starting OneLogin integration tests${NC}"

# Check client registration
check_client_registration

# Test OneLogin redirect endpoint
test_endpoint "${ONELOGIN_URL}" "OneLogin authentication redirect"

# Explain the next steps that would happen in a real flow (but can't be automated)
echo -e "\n${YELLOW}Manual flow steps:${NC}"
echo "1. User is redirected to OneLogin for authentication"
echo "2. User authenticates and consents to permissions"
echo "3. OneLogin redirects to callback URL with authorization code"
echo "4. Server exchanges code for tokens and creates/updates user"
echo "5. User is redirected to dashboard"

# Test token validation endpoint
echo -e "\n${YELLOW}Testing token validation (will fail without valid token)${NC}"
test_endpoint "${AUTH_VALIDATE_URL}" "OneLogin token validation" "POST" '{"token":"invalid-token"}'

echo -e "\n${YELLOW}Integration test complete${NC}"
echo "For complete testing, follow the manual flow in a browser:"
echo "1. Visit ${ONELOGIN_URL}"
echo "2. Complete the authentication flow"
echo "3. Check that you are redirected back to the application"

echo -e "\n${YELLOW}Documentation${NC}"
echo "See docs/ONELOGIN-INTEGRATION.md for detailed implementation information."
