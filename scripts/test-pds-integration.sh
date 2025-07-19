#!/bin/bash
# PDS Integration Test Script
# This script tests the PDS integration functionality

# Set up colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Set default variables
API_URL="http://localhost:5000/api"
TOKEN=""
WEBID="https://testuser.solidcommunity.net/profile/card#me"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --url)
      API_URL="$2"
      shift 2
      ;;
    --token)
      TOKEN="$2"
      shift 2
      ;;
    --webid)
      WEBID="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo -e "${YELLOW}PDS Integration Test Script${NC}"
echo "API URL: $API_URL"

if [ -z "$TOKEN" ]; then
  echo -e "${YELLOW}No token provided. Attempting to log in...${NC}"
  
  # Attempt to log in and get a token
  LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/users/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"password123"}')
  
  TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | sed 's/"token":"//')
  
  if [ -z "$TOKEN" ]; then
    echo -e "${RED}Failed to get token. Please provide a valid token using --token.${NC}"
    exit 1
  else
    echo -e "${GREEN}Successfully logged in and got token.${NC}"
  fi
fi

echo -e "\n${YELLOW}=== Testing PDS Provider Registration ===${NC}"

# Register a test PDS provider
echo -e "\n${YELLOW}Registering test PDS provider...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/pds/providers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test PDS Provider",
    "providerUrl": "https://solidcommunity.net",
    "discoveryUrl": "https://solidcommunity.net/.well-known/openid-configuration"
  }')

echo "Response: $REGISTER_RESPONSE"

# List registered PDS providers
echo -e "\n${YELLOW}Listing registered PDS providers...${NC}"
LIST_RESPONSE=$(curl -s -X GET "$API_URL/pds/providers" \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $LIST_RESPONSE"

# Check PDS connection status
echo -e "\n${YELLOW}Checking PDS connection status...${NC}"
STATUS_RESPONSE=$(curl -s -X GET "$API_URL/pds/status" \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $STATUS_RESPONSE"

# Initiate PDS connection (this would normally redirect to PDS provider)
echo -e "\n${YELLOW}Initiating PDS connection (simulation only)...${NC}"
CONNECT_RESPONSE=$(curl -s -X POST "$API_URL/pds/connect" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"webId\": \"$WEBID\"}")

echo "Response: $CONNECT_RESPONSE"

# Create a test credential (since we can't complete the OAuth flow in a script)
echo -e "\n${YELLOW}Creating test credential...${NC}"
CRED_RESPONSE=$(curl -s -X POST "$API_URL/credentials" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "@context": [
      "https://www.w3.org/2018/credentials/v1"
    ],
    "id": "urn:uuid:test-credential-123",
    "type": ["VerifiableCredential", "TestCredential"],
    "issuer": "https://test-issuer.example.org",
    "issuanceDate": "2023-01-01T00:00:00Z",
    "credentialSubject": {
      "id": "test-subject",
      "name": "Test User"
    }
  }')

echo "Response: $CRED_RESPONSE"

# Create test form data credential
echo -e "\n${YELLOW}Creating test form data credential...${NC}"
FORM_CRED_RESPONSE=$(curl -s -X POST "$API_URL/credentials/form-data" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "applicant": {
      "fullName": "Test User",
      "dateOfBirth": "1980-01-01"
    },
    "deceased": {
      "fullName": "John Doe",
      "dateOfDeath": "2023-01-01"
    },
    "relationship": "spouse"
  }')

echo "Response: $FORM_CRED_RESPONSE"

# List credentials
echo -e "\n${YELLOW}Listing credentials...${NC}"
LIST_CRED_RESPONSE=$(curl -s -X GET "$API_URL/credentials" \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $LIST_CRED_RESPONSE"

# Get form data from credentials
echo -e "\n${YELLOW}Getting form data from credentials...${NC}"
GET_FORM_RESPONSE=$(curl -s -X GET "$API_URL/credentials/form-data" \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $GET_FORM_RESPONSE"

# Disconnect from PDS
echo -e "\n${YELLOW}Disconnecting from PDS...${NC}"
DISCONNECT_RESPONSE=$(curl -s -X POST "$API_URL/pds/disconnect" \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $DISCONNECT_RESPONSE"

echo -e "\n${GREEN}PDS Integration Tests Completed${NC}"
