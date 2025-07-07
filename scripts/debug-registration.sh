#!/bin/bash

# Registration Debugging Script
# Helps diagnose registration issues

set -e

echo "🔍 REGISTRATION ISSUE DEBUGGING"
echo "==============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DOMAIN="https://app1.mrchughes.site"

echo -e "\n${BLUE}1. Testing Backend API Directly${NC}"
echo "================================"

# Test 1: Valid registration
echo "Testing valid registration..."
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$DOMAIN/api/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"name":"Debug User","email":"debug@example.com","password":"debugpass123"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1 | cut -d: -f2)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "201" ]; then
    echo -e "✅ ${GREEN}Registration successful${NC}"
    echo "Response: $BODY"
else
    echo -e "❌ ${RED}Registration failed - HTTP $HTTP_CODE${NC}"
    echo "Response: $BODY"
fi

# Test 2: Duplicate registration
echo -e "\nTesting duplicate registration..."
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$DOMAIN/api/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"name":"Debug User","email":"debug@example.com","password":"debugpass123"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1 | cut -d: -f2)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "400" ]; then
    echo -e "✅ ${GREEN}Duplicate user detection working${NC}"
    echo "Response: $BODY"
else
    echo -e "❌ ${RED}Unexpected response - HTTP $HTTP_CODE${NC}"
    echo "Response: $BODY"
fi

# Test 3: Invalid email
echo -e "\nTesting invalid email..."
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$DOMAIN/api/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"name":"Test User","email":"invalid-email","password":"testpass123"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1 | cut -d: -f2)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "400" ]; then
    echo -e "✅ ${GREEN}Email validation working${NC}"
    echo "Response: $BODY"
else
    echo -e "❌ ${RED}Email validation issue - HTTP $HTTP_CODE${NC}"
    echo "Response: $BODY"
fi

# Test 4: Short password
echo -e "\nTesting short password..."
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$DOMAIN/api/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"name":"Test User","email":"test@short.com","password":"123"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1 | cut -d: -f2)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "400" ]; then
    echo -e "✅ ${GREEN}Password validation working${NC}"
    echo "Response: $BODY"
else
    echo -e "❌ ${RED}Password validation issue - HTTP $HTTP_CODE${NC}"
    echo "Response: $BODY"
fi

# Test 5: Missing fields
echo -e "\nTesting missing fields..."
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$DOMAIN/api/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@missing.com","password":"testpass123"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1 | cut -d: -f2)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "400" ]; then
    echo -e "✅ ${GREEN}Field validation working${NC}"
    echo "Response: $BODY"
else
    echo -e "❌ ${RED}Field validation issue - HTTP $HTTP_CODE${NC}"
    echo "Response: $BODY"
fi

echo -e "\n${BLUE}2. Testing Frontend Resources${NC}"
echo "=============================="

# Check if frontend is accessible
echo "Testing frontend accessibility..."
FRONTEND_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null "$DOMAIN/")
if [ "$FRONTEND_RESPONSE" = "200" ]; then
    echo -e "✅ ${GREEN}Frontend accessible${NC}"
else
    echo -e "❌ ${RED}Frontend not accessible - HTTP $FRONTEND_RESPONSE${NC}"
fi

# Check API endpoint accessibility
echo "Testing API health endpoint..."
API_HEALTH=$(curl -s "$DOMAIN/api/health" | jq -r '.status' 2>/dev/null || echo "error")
if [ "$API_HEALTH" = "healthy" ]; then
    echo -e "✅ ${GREEN}API healthy${NC}"
else
    echo -e "❌ ${RED}API not healthy${NC}"
fi

echo -e "\n${BLUE}3. Database Connectivity${NC}"
echo "========================"

# Check DynamoDB table
TABLE_STATUS=$(aws dynamodb describe-table --table-name cloud-apps-table --region eu-west-2 --query 'Table.TableStatus' --output text 2>/dev/null || echo "ERROR")
if [ "$TABLE_STATUS" = "ACTIVE" ]; then
    echo -e "✅ ${GREEN}DynamoDB table active${NC}"
else
    echo -e "❌ ${RED}DynamoDB table issue: $TABLE_STATUS${NC}"
fi

echo -e "\n${BLUE}4. Common Issues & Solutions${NC}"
echo "==========================="

echo -e "${YELLOW}If registration is failing in the browser but working via API:${NC}"
echo "1. Check browser developer console for JavaScript errors"
echo "2. Check Network tab for failed requests"
echo "3. Verify CORS headers in browser requests"
echo "4. Clear browser cache and cookies"
echo "5. Try incognito/private browsing mode"

echo -e "\n${YELLOW}Frontend debugging steps:${NC}"
echo "1. Open browser developer tools (F12)"
echo "2. Go to Console tab and look for errors"
echo "3. Go to Network tab and monitor requests"
echo "4. Try registration and watch for failed requests"

echo -e "\n${YELLOW}Expected registration flow:${NC}"
echo "1. User fills form with name, email, password"
echo "2. Frontend validates inputs"
echo "3. POST request to /api/auth/register"
echo "4. Backend validates and creates user in DynamoDB"
echo "5. Backend returns token and user data"
echo "6. Frontend stores token and redirects"

echo -e "\n${BLUE}5. Environment Variables Check${NC}"
echo "=============================="

# Check backend environment variables
echo "Backend DYNAMO_TABLE_NAME:"
aws ecs describe-task-definition --task-definition cloud-apps-mern-backend:4 --region eu-west-2 --query 'taskDefinition.containerDefinitions[0].environment[?name==`DYNAMO_TABLE_NAME`].value' --output text

echo "Frontend REACT_APP_API_URL:"
aws ecs describe-task-definition --task-definition cloud-apps-mern-frontend:6 --region eu-west-2 --query 'taskDefinition.containerDefinitions[0].environment[?name==`REACT_APP_API_URL`].value' --output text

echo -e "\n${GREEN}✅ Backend API tests completed${NC}"
echo -e "${YELLOW}💡 If API tests pass but browser registration fails, the issue is likely in the frontend JavaScript${NC}"
