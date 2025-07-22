#!/bin/bash
# /Users/chrishughes/Projects/FEP_Local/FEP/scripts/test-credential-mapping.sh

# Set variables
TOKEN=""
API_URL="http://localhost:3001"
APPLICATION_ID=""

# Text colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=========================================${NC}"
echo -e "${YELLOW}  PDS Credential Mapping Test Script    ${NC}"
echo -e "${YELLOW}=========================================${NC}\n"

# Login to get a token
echo -e "${YELLOW}Logging in to get auth token...${NC}"
response=$(curl -s -X POST $API_URL/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}')

TOKEN=$(echo $response | grep -o '"token":"[^"]*' | grep -o '[^"]*$')

if [ -z "$TOKEN" ]; then
  echo -e "${RED}Failed to get auth token. Response: $response${NC}"
  exit 1
else
  echo -e "${GREEN}Successfully obtained auth token${NC}\n"
fi

# Create a test application
echo -e "${YELLOW}Creating test application...${NC}"
response=$(curl -s -X POST $API_URL/api/forms/applications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"formId":"63f5e9b7c2f2d83c9c8b4567","data":{"personalInfo":{"firstName":"","lastName":"","email":"","phoneNumber":""},"address":{"street":"","city":"","state":"","zipCode":""}}}')

APPLICATION_ID=$(echo $response | grep -o '"_id":"[^"]*' | grep -o '[^"]*$')

if [ -z "$APPLICATION_ID" ]; then
  echo -e "${RED}Failed to create application. Response: $response${NC}"
  exit 1
else
  echo -e "${GREEN}Successfully created test application with ID: $APPLICATION_ID${NC}\n"
fi

# Test PDS connection status
echo -e "${YELLOW}Testing PDS connection status...${NC}"
response=$(curl -s -X GET $API_URL/api/pds/status \
  -H "Authorization: Bearer $TOKEN")

echo -e "PDS Status: $response\n"

# Create a sample verifiable credential
echo -e "${YELLOW}Creating sample verifiable credential...${NC}"
CREDENTIAL_ID="urn:uuid:$(date +%s)-test"
response=$(curl -s -X POST $API_URL/api/credentials/test-credential \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"id\":\"$CREDENTIAL_ID\",\"type\":\"IdentityCredential\",\"data\":{\"credentialSubject\":{\"firstName\":\"John\",\"lastName\":\"Doe\",\"email\":\"john.doe@example.com\",\"phoneNumber\":\"555-123-4567\",\"address\":{\"street\":\"123 Main St\",\"city\":\"Anytown\",\"state\":\"CA\",\"zipCode\":\"12345\"}}}}")

echo -e "Created test credential: $response\n"

# Test field normalization
echo -e "${YELLOW}Testing field normalization...${NC}"
response=$(curl -s -X POST $API_URL/api/mapping/normalize-field \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"value":"2023-05-15T00:00:00.000Z","targetType":"date","format":"yyyy-mm-dd"}')

echo -e "Field normalization result: $response\n"

# Apply credential mapping to application
echo -e "${YELLOW}Applying credential mapping to application...${NC}"
response=$(curl -s -X POST $API_URL/api/mapping/applications/$APPLICATION_ID/apply-credential \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"credentialId\":\"$CREDENTIAL_ID\",\"mappings\":[
    {\"formField\":\"personalInfo.firstName\",\"credentialField\":\"credentialSubject.firstName\",\"value\":\"John\",\"source\":\"IdentityCredential.credentialSubject.firstName\"},
    {\"formField\":\"personalInfo.lastName\",\"credentialField\":\"credentialSubject.lastName\",\"value\":\"Doe\",\"source\":\"IdentityCredential.credentialSubject.lastName\"},
    {\"formField\":\"personalInfo.email\",\"credentialField\":\"credentialSubject.email\",\"value\":\"john.doe@example.com\",\"source\":\"IdentityCredential.credentialSubject.email\"},
    {\"formField\":\"personalInfo.phoneNumber\",\"credentialField\":\"credentialSubject.phoneNumber\",\"value\":\"555-123-4567\",\"source\":\"IdentityCredential.credentialSubject.phoneNumber\"},
    {\"formField\":\"address.street\",\"credentialField\":\"credentialSubject.address.street\",\"value\":\"123 Main St\",\"source\":\"IdentityCredential.credentialSubject.address.street\"},
    {\"formField\":\"address.city\",\"credentialField\":\"credentialSubject.address.city\",\"value\":\"Anytown\",\"source\":\"IdentityCredential.credentialSubject.address.city\"},
    {\"formField\":\"address.state\",\"credentialField\":\"credentialSubject.address.state\",\"value\":\"CA\",\"source\":\"IdentityCredential.credentialSubject.address.state\"},
    {\"formField\":\"address.zipCode\",\"credentialField\":\"credentialSubject.address.zipCode\",\"value\":\"12345\",\"source\":\"IdentityCredential.credentialSubject.address.zipCode\"}
  ]}")

echo -e "Credential mapping result: $response\n"

# Verify application data after mapping
echo -e "${YELLOW}Verifying application data after mapping...${NC}"
response=$(curl -s -X GET $API_URL/api/forms/applications/$APPLICATION_ID \
  -H "Authorization: Bearer $TOKEN")

echo -e "Application data after mapping: $response\n"

# Get mapping history
echo -e "${YELLOW}Getting mapping history...${NC}"
response=$(curl -s -X GET $API_URL/api/mapping/applications/$APPLICATION_ID/mapping-history \
  -H "Authorization: Bearer $TOKEN")

echo -e "Mapping history: $response\n"

# Get mapping suggestions
echo -e "${YELLOW}Getting mapping suggestions...${NC}"
response=$(curl -s -X GET $API_URL/api/mapping/mapping-suggestions/IdentityCredential \
  -H "Authorization: Bearer $TOKEN")

echo -e "Mapping suggestions: $response\n"

# Clean up
echo -e "${YELLOW}Cleaning up test application...${NC}"
response=$(curl -s -X DELETE $API_URL/api/forms/applications/$APPLICATION_ID \
  -H "Authorization: Bearer $TOKEN")

echo -e "Cleanup result: $response\n"

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  Test script completed successfully     ${NC}"
echo -e "${GREEN}=========================================${NC}"
