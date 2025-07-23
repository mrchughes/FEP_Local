#!/bin/bash

# Test script for multi-audience WebID resolution and credential operations

echo "🧪 Testing Multi-Audience WebID Resolution and Credential Operations"
echo "===================================================================="

# Configuration
API_URL="http://localhost:3001/api"
AUTH_TOKEN="" # Will be set after login
USER_EMAIL="test@example.com"
USER_PASSWORD="password123"
DEFAULT_AUDIENCE="default-pds"
SECONDARY_AUDIENCE="secondary-pds"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
RESET='\033[0m'

# Function for API calls with authentication
call_api() {
    local method=$1
    local endpoint=$2
    local data=$3
    local url="${API_URL}${endpoint}"
    
    if [ -z "$data" ]; then
        curl -s -X "$method" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            "$url"
    else
        curl -s -X "$method" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -d "$data" \
            "$url"
    fi
}

# Function to check if a test passed or failed
check_result() {
    local result=$1
    local expected=$2
    local message=$3
    
    if [ "$result" == "$expected" ]; then
        echo -e "${GREEN}✓ PASS: $message${RESET}"
        return 0
    else
        echo -e "${RED}✗ FAIL: $message${RESET}"
        echo "  Expected: $expected"
        echo "  Got: $result"
        return 1
    fi
}

# Step 1: Login to get authentication token
echo -e "${BLUE}Step 1: Logging in to get authentication token${RESET}"
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$USER_EMAIL\",\"password\":\"$USER_PASSWORD\"}")

AUTH_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$AUTH_TOKEN" ]; then
    echo -e "${RED}Failed to get authentication token. Aborting tests.${RESET}"
    echo "Login response: $LOGIN_RESPONSE"
    exit 1
else
    echo -e "${GREEN}Authentication successful!${RESET}"
fi

# Step 2: Test WebID resolution with default audience
echo -e "\n${BLUE}Step 2: Testing WebID resolution with default audience${RESET}"
WEBID_TEST_RESPONSE=$(call_api "GET" "/pds/resolve-webid?webId=https://example.com/profile/card%23me&audience=$DEFAULT_AUDIENCE")
HAS_RESOLVED_WEBID=$(echo "$WEBID_TEST_RESPONSE" | grep -c "resolvedWebId")

check_result "$HAS_RESOLVED_WEBID" "1" "WebID resolution with default audience"

# Step 3: Test WebID resolution with secondary audience
echo -e "\n${BLUE}Step 3: Testing WebID resolution with secondary audience${RESET}"
WEBID_TEST_RESPONSE=$(call_api "GET" "/pds/resolve-webid?webId=https://example.com/profile/card%23me&audience=$SECONDARY_AUDIENCE")
HAS_RESOLVED_WEBID=$(echo "$WEBID_TEST_RESPONSE" | grep -c "resolvedWebId")

check_result "$HAS_RESOLVED_WEBID" "1" "WebID resolution with secondary audience"

# Step 4: Test WebID resolution caching (should be faster)
echo -e "\n${BLUE}Step 4: Testing WebID resolution caching${RESET}"
echo "First request (uncached):"
time call_api "GET" "/pds/resolve-webid?webId=https://example.com/profile/card%23me&audience=$DEFAULT_AUDIENCE" > /dev/null

echo "Second request (should be cached):"
time call_api "GET" "/pds/resolve-webid?webId=https://example.com/profile/card%23me&audience=$DEFAULT_AUDIENCE" > /dev/null

# Step 5: Test multi-audience credential retrieval
echo -e "\n${BLUE}Step 5: Testing multi-audience credential retrieval${RESET}"
MULTI_AUDIENCE_RESPONSE=$(call_api "GET" "/pds/credentials?audience=$DEFAULT_AUDIENCE,$SECONDARY_AUDIENCE")
HAS_CREDENTIALS=$(echo "$MULTI_AUDIENCE_RESPONSE" | grep -c "credentials")

check_result "$HAS_CREDENTIALS" "1" "Multi-audience credential retrieval"

# Step 6: Test audience tagging in credentials
echo -e "\n${BLUE}Step 6: Testing audience tagging in credentials${RESET}"
HAS_AUDIENCE_TAG=$(echo "$MULTI_AUDIENCE_RESPONSE" | grep -c "audience")

check_result "$HAS_AUDIENCE_TAG" "1" "Audience tagging in credentials"

# Step 7: Test parallel credential retrieval performance
echo -e "\n${BLUE}Step 7: Testing parallel credential retrieval performance${RESET}"
echo "Single audience request:"
time call_api "GET" "/pds/credentials?audience=$DEFAULT_AUDIENCE" > /dev/null

echo "Multiple audience request (should use parallel processing):"
time call_api "GET" "/pds/credentials?audience=$DEFAULT_AUDIENCE,$SECONDARY_AUDIENCE" > /dev/null

# Step 8: Test form data retrieval with multi-audience
echo -e "\n${BLUE}Step 8: Testing form data retrieval with multi-audience${RESET}"
FORM_DATA_RESPONSE=$(call_api "GET" "/pds/form-data?audience=$DEFAULT_AUDIENCE,$SECONDARY_AUDIENCE")
HAS_FORM_DATA=$(echo "$FORM_DATA_RESPONSE" | grep -c "formData")

check_result "$HAS_FORM_DATA" "1" "Form data retrieval with multi-audience"

echo -e "\n${GREEN}Tests completed!${RESET}"
