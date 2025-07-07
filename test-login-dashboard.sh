#!/bin/bash

echo "🔍 Testing login and dashboard flow..."
echo "======================================="

# Test backend health
echo "1. Testing backend health..."
API_URL="https://be-cloud-apps-mrchughes-site.up.railway.app"
curl -s "$API_URL/health" && echo " ✅ Backend is healthy" || echo " ❌ Backend health check failed"

echo ""
echo "2. Testing login endpoint..."
# Test login with known credentials
RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  "$API_URL/api/auth/login" 2>/dev/null)

echo "Login response: $RESPONSE"

if [[ $RESPONSE == *"token"* ]]; then
    echo " ✅ Login endpoint working"
    
    # Extract token for testing
    TOKEN=$(echo $RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    echo "Token extracted: ${TOKEN:0:20}..."
    
    echo ""
    echo "3. Testing resume data endpoint..."
    RESUME_RESPONSE=$(curl -s -X GET \
      -H "Authorization: Bearer $TOKEN" \
      "$API_URL/api/form/resume" 2>/dev/null)
    
    echo "Resume response: $RESUME_RESPONSE"
    
    if [[ $RESUME_RESPONSE == *"formData"* ]] || [[ $RESUME_RESPONSE == *"message"* ]]; then
        echo " ✅ Resume endpoint working"
    else
        echo " ❌ Resume endpoint failed"
    fi
else
    echo " ❌ Login endpoint failed"
fi

echo ""
echo "4. Frontend build check..."
if [ -f "/Users/chrishughes/Projects/CICD/cloud-apps-bundle/mern-app/frontend/build/index.html" ]; then
    echo " ✅ Frontend build exists"
    
    # Check for React Router configuration
    if grep -q "react-router" "/Users/chrishughes/Projects/CICD/cloud-apps-bundle/mern-app/frontend/build/static/js/"*.js 2>/dev/null; then
        echo " ✅ React Router found in build"
    else
        echo " ⚠️  React Router not clearly found in build"
    fi
else
    echo " ❌ Frontend build missing"
fi

echo ""
echo "5. Checking current deployment..."
FRONTEND_URL="https://fe-cloud-apps-mrchughes-site.up.railway.app"
FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" 2>/dev/null)

if [ "$FRONTEND_RESPONSE" = "200" ]; then
    echo " ✅ Frontend is accessible (HTTP $FRONTEND_RESPONSE)"
    
    # Check if dashboard route is accessible (should redirect to login if not authenticated)
    DASHBOARD_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/dashboard" 2>/dev/null)
    echo " Dashboard route returns: HTTP $DASHBOARD_RESPONSE"
else
    echo " ❌ Frontend not accessible (HTTP $FRONTEND_RESPONSE)"
fi

echo ""
echo "🔧 Debugging tips:"
echo "1. Open browser dev tools and check for console errors"
echo "2. Try logging in with test@example.com / password123"
echo "3. Check if you're redirected to /dashboard after login"
echo "4. Check if DashboardPage component renders properly"
echo "5. Check Network tab for failed API calls"
