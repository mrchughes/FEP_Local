#!/bin/bash

# Test script for OneLogin integration with PDS
# This script tests the ability to access PDS using OneLogin tokens

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "❌ jq is not installed. Please install jq to run this test."
    echo "   On macOS: brew install jq"
    echo "   On Ubuntu: sudo apt-get install jq"
    exit 1
fi

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ensure environment variables are loaded
if [ -f ".env" ]; then
    echo -e "${BLUE}Loading environment variables from .env${NC}"
    export $(grep -v '^#' .env | xargs)
else
    echo -e "${YELLOW}Warning: No .env file found. Using environment variables as is.${NC}"
fi

# Variables
BASE_URL=${API_URL:-"http://localhost:5000"}
TEST_EMAIL="test.user@example.com"
TEST_PASSWORD="TestPassword123!"
JWT_TOKEN=""
WEBID=""

echo -e "${BLUE}=== Testing OneLogin PDS Integration ===${NC}"

# Step 1: Create a test user account via regular authentication
echo -e "\n${BLUE}Step 1: Creating test user account${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\",\"name\":\"Test User\"}")

if echo "$REGISTER_RESPONSE" | grep -q "already exists"; then
    echo -e "${YELLOW}User already exists, logging in instead${NC}"
    # Log in instead
    LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/users/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}")
    
    JWT_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')
else
    echo -e "${GREEN}User created successfully${NC}"
    JWT_TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.token')
fi

if [ -z "$JWT_TOKEN" ] || [ "$JWT_TOKEN" == "null" ]; then
    echo -e "${RED}❌ Failed to get JWT token${NC}"
    exit 1
fi

echo -e "${GREEN}✅ JWT token obtained${NC}"

# Step 2: Simulate OneLogin authentication (since we can't do actual OneLogin auth in test)
echo -e "\n${BLUE}Step 2: Simulating OneLogin authentication${NC}"
echo -e "${YELLOW}Note: This is a simulation since we can't do actual OneLogin auth in test${NC}"

# Generate a simulated WebID
WEBID="https://fake-pds.gov.uk/profile/card#me"

# Update user with simulated OneLogin data
UPDATE_RESPONSE=$(curl -s -X PUT "${BASE_URL}/api/users/update" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${JWT_TOKEN}" \
    -d "{\"webid\":\"${WEBID}\",\"oneloginEnabled\":true}")

if echo "$UPDATE_RESPONSE" | grep -q "error"; then
    echo -e "${RED}❌ Failed to update user with OneLogin data: $(echo $UPDATE_RESPONSE | jq -r '.error')${NC}"
    exit 1
fi

echo -e "${GREEN}✅ User updated with simulated OneLogin data${NC}"

# Step 3: Get user profile to confirm WebID was saved
echo -e "\n${BLUE}Step 3: Verifying user profile has WebID${NC}"
PROFILE_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/users/profile" \
    -H "Authorization: Bearer ${JWT_TOKEN}")

SAVED_WEBID=$(echo $PROFILE_RESPONSE | jq -r '.webid')

if [ -z "$SAVED_WEBID" ] || [ "$SAVED_WEBID" == "null" ]; then
    echo -e "${RED}❌ WebID not found in user profile${NC}"
    exit 1
fi

echo -e "${GREEN}✅ WebID confirmed in user profile: ${SAVED_WEBID}${NC}"

# Step 4: Test PDS access with JWT token
echo -e "\n${BLUE}Step 4: Testing PDS access with JWT token${NC}"
PDS_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/pds/status" \
    -H "Authorization: Bearer ${JWT_TOKEN}")

if echo "$PDS_RESPONSE" | grep -q "error"; then
    echo -e "${RED}❌ Failed to access PDS: $(echo $PDS_RESPONSE | jq -r '.error')${NC}"
else
    echo -e "${GREEN}✅ Successfully accessed PDS with JWT token${NC}"
    echo "PDS status: $(echo $PDS_RESPONSE | jq -r '.status')"
fi

# Step 5: Test PDS credential operations (simulate)
echo -e "\n${BLUE}Step 5: Testing credential operations${NC}"
CREDS_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/pds/credentials" \
    -H "Authorization: Bearer ${JWT_TOKEN}")

echo -e "${YELLOW}Credential operation response:${NC}"
echo "$CREDS_RESPONSE" | jq '.'

# Summary
echo -e "\n${BLUE}=== Test Summary ===${NC}"
echo -e "${GREEN}✅ OneLogin PDS integration test completed${NC}"
echo -e "JWT Token: ${YELLOW}...$(echo $JWT_TOKEN | cut -c -10)...${NC}"
echo -e "WebID: ${YELLOW}${SAVED_WEBID}${NC}"
echo -e "\n${BLUE}Note: This was a simulation. For a real test, you need an actual OneLogin instance.${NC}"
