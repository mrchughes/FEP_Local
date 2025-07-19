#!/bin/bash

# Evidence Upload Test Script
# This script tests the evidence upload and extraction functionality

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting Evidence Upload and Extraction Tests${NC}"
echo "======================================================"

# Check if services are running
echo "Checking if services are running..."

# Check backend
echo -n "Backend service: "
if curl -s http://localhost:5200/api/health > /dev/null; then
    echo -e "${GREEN}Running${NC}"
else
    echo -e "${RED}Not running${NC}"
    echo -e "${RED}ERROR: Backend service is not running. Please start the services using 'docker-compose up'.${NC}"
    exit 1
fi

# Check AI agent
echo -n "AI agent service: "
if curl -s http://localhost:5100/ai-agent/health > /dev/null; then
    echo -e "${GREEN}Running${NC}"
else
    echo -e "${RED}Not running${NC}"
    echo -e "${RED}ERROR: AI agent service is not running. Please start the services using 'docker-compose up'.${NC}"
    exit 1
fi

echo -e "\n${YELLOW}1. Testing Authentication${NC}"
echo "------------------------"

# Generate a test token
echo "Generating test authentication token..."
TOKEN=$(node scripts/generate-test-token.js)

if [[ -z "$TOKEN" ]]; then
    echo -e "${RED}ERROR: Failed to generate test token.${NC}"
    exit 1
else
    echo -e "${GREEN}Successfully generated test token.${NC}"
fi

echo -e "\n${YELLOW}2. Testing Evidence Upload${NC}"
echo "------------------------"

# Test file paths
TEST_FILE="shared-evidence/A_scanned_death_certificate_for_Brian_Hughes_is_pr.png"

# Check if test file exists
if [[ ! -f "$TEST_FILE" ]]; then
    echo -e "${RED}ERROR: Test file $TEST_FILE not found.${NC}"
    exit 1
fi

# Test evidence upload
echo "Uploading test file..."
UPLOAD_RESPONSE=$(curl -s -X POST \
  http://localhost:5200/api/evidence/upload \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: multipart/form-data" \
  -F "evidence=@$TEST_FILE")

echo "Upload response: $UPLOAD_RESPONSE"

# Check if upload was successful
if echo "$UPLOAD_RESPONSE" | grep -q "name"; then
    echo -e "${GREEN}Successfully uploaded test file.${NC}"
    UPLOADED_FILE=$(echo "$UPLOAD_RESPONSE" | grep -o '"name":"[^"]*"' | sed 's/"name":"//g' | sed 's/"//g')
    echo "Uploaded file: $UPLOADED_FILE"
else
    echo -e "${RED}ERROR: Failed to upload test file.${NC}"
    exit 1
fi

echo -e "\n${YELLOW}3. Testing Evidence Extraction${NC}"
echo "----------------------------"

# Test extraction
echo "Extracting data from uploaded file..."
EXTRACT_RESPONSE=$(curl -s -X POST \
  http://localhost:5200/api/ai-agent/extract \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"fileId\":\"$UPLOADED_FILE\"}")

echo "Extraction response: $EXTRACT_RESPONSE"

# Check if extraction was successful
if echo "$EXTRACT_RESPONSE" | grep -q "extracted"; then
    echo -e "${GREEN}Successfully extracted data from test file.${NC}"
    
    # Check if specific fields were extracted
    if echo "$EXTRACT_RESPONSE" | grep -q "deceasedFirstName\|deceasedLastName\|dateOfDeath"; then
        echo -e "${GREEN}Successfully extracted key fields from the document.${NC}"
    else
        echo -e "${YELLOW}WARNING: Extraction succeeded but key fields may be missing.${NC}"
    fi
else
    echo -e "${RED}ERROR: Failed to extract data from test file.${NC}"
    exit 1
fi

echo -e "\n${YELLOW}4. Testing Evidence List${NC}"
echo "------------------------"

# Test listing evidence
echo "Listing uploaded evidence..."
LIST_RESPONSE=$(curl -s -X GET \
  http://localhost:5200/api/evidence/list \
  -H "Authorization: Bearer $TOKEN")

echo "List response: $LIST_RESPONSE"

# Check if list includes our uploaded file
if echo "$LIST_RESPONSE" | grep -q "$UPLOADED_FILE"; then
    echo -e "${GREEN}Successfully listed evidence including our test file.${NC}"
else
    echo -e "${RED}ERROR: Evidence list does not include our test file.${NC}"
    exit 1
fi

echo -e "\n${YELLOW}5. Testing Evidence Deletion${NC}"
echo "----------------------------"

# Test deleting evidence
echo "Deleting test file..."
DELETE_RESPONSE=$(curl -s -X DELETE \
  "http://localhost:5200/api/evidence/$UPLOADED_FILE" \
  -H "Authorization: Bearer $TOKEN")

echo "Delete response: $DELETE_RESPONSE"

# Check if deletion was successful
if echo "$DELETE_RESPONSE" | grep -q "File deleted"; then
    echo -e "${GREEN}Successfully deleted test file.${NC}"
else
    echo -e "${RED}ERROR: Failed to delete test file.${NC}"
    exit 1
fi

# Verify file is gone from the list
echo "Verifying file was deleted..."
LIST_RESPONSE_AFTER=$(curl -s -X GET \
  http://localhost:5200/api/evidence/list \
  -H "Authorization: Bearer $TOKEN")

if echo "$LIST_RESPONSE_AFTER" | grep -q "$UPLOADED_FILE"; then
    echo -e "${RED}ERROR: File still appears in evidence list after deletion.${NC}"
    exit 1
else
    echo -e "${GREEN}File successfully removed from evidence list.${NC}"
fi

echo -e "\n${GREEN}All tests completed successfully!${NC}"
echo "Evidence upload, extraction, and deletion functionality is working correctly."
