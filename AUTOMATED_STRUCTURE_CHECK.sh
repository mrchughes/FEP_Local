#!/bin/bash

echo "🤖 AUTOMATED STRUCTURAL VALIDATION"
echo "=================================="
echo ""

cd mern-app/frontend

echo "1. Validating FormPage Structure..."
echo "-----------------------------------"

# Count renderStep functions
RENDERSTEP_COUNT=$(grep -c "const renderStep" src/pages/FormPage.js)
echo "✅ RenderStep functions found: $RENDERSTEP_COUNT (should be 9)"

# Count step conditionals in render
STEP_CONDITIONALS=$(grep -c "currentStep ===" src/pages/FormPage.js)
echo "✅ Step conditionals found: $STEP_CONDITIONALS (should be 9)"

# Check max step validation
MAX_STEP=$(grep -o "currentStep < [0-9]" src/pages/FormPage.js | grep -o "[0-9]")
echo "✅ Maximum step: $MAX_STEP (should be 9)"

echo ""
echo "2. Validating Form Structure..."
echo "------------------------------"

# Count form sections
SECTION_COUNT=$(grep -c "id:" src/data/formStructure.js)
echo "✅ Form sections defined: $SECTION_COUNT (should be 9)"

# List all section IDs
echo "✅ Section IDs:"
grep "id:" src/data/formStructure.js | sed "s/.*id: '/   - /" | sed "s/',//"

echo ""
echo "3. Validating Navigation Components..."
echo "------------------------------------"

# Check dashboard link in navbar
DASHBOARD_LINK=$(grep -c 'to="/dashboard"' src/components/Navbar.js)
echo "✅ Dashboard links in navbar: $DASHBOARD_LINK (should be 1)"

# Check login redirect
LOGIN_REDIRECT=$(grep -c 'navigate("/dashboard")' src/auth/AuthContext.js)
echo "✅ Login redirects to dashboard: $LOGIN_REDIRECT (should be 1)"

# Check logout redirect  
LOGOUT_REDIRECT=$(grep -c 'navigate("/")' src/auth/AuthContext.js)
echo "✅ Logout redirects to root: $LOGOUT_REDIRECT (should be 1)"

echo ""
echo "4. Validating User Isolation..."
echo "------------------------------"

# Check user.email usage in persistence
EMAIL_USAGE_PERSIST=$(grep -c "user\.email" src/utils/formPersistence.js 2>/dev/null || echo "0")
echo "✅ user.email usage in formPersistence: $EMAIL_USAGE_PERSIST"

# Check user.email usage in form progress
EMAIL_USAGE_PROGRESS=$(grep -c "user\.email" src/utils/formProgress.js 2>/dev/null || echo "0")
echo "✅ user.email usage in formProgress: $EMAIL_USAGE_PROGRESS"

# Check localStorage key generation
STORAGE_KEY_CHECK=$(grep -c "getFormStorageKey" src/utils/formPersistence.js)
echo "✅ Storage key generation functions: $STORAGE_KEY_CHECK (should be > 0)"

echo ""
echo "5. Validating Routes..."
echo "----------------------"

# Count protected routes
PROTECTED_ROUTES=$(grep -c "PrivateRoute" src/App.js)
echo "✅ Protected routes: $PROTECTED_ROUTES (should be 5: dashboard, form, tasks, review, confirmation)"

# List all routes
echo "✅ All routes defined:"
grep "path=" src/App.js | sed 's/.*path="/   - /' | sed 's/" element.*//'

echo ""
echo "6. Build Status Check..."
echo "-----------------------"

# Quick build check (already done in previous test)
if [ -d "build" ]; then
    echo "✅ Build directory exists (from previous build)"
    echo "✅ Build size:"
    du -sh build/ 2>/dev/null || echo "   Unable to check build size"
else
    echo "⚠️  No build directory found - run 'npm run build' to verify"
fi

echo ""
echo "🎯 STRUCTURAL VALIDATION SUMMARY"
echo "==============================="
echo ""

# Calculate overall score
TOTAL_CHECKS=6
PASSED_CHECKS=0

[ "$RENDERSTEP_COUNT" = "9" ] && ((PASSED_CHECKS++))
[ "$SECTION_COUNT" = "9" ] && ((PASSED_CHECKS++))
[ "$DASHBOARD_LINK" -ge "1" ] && ((PASSED_CHECKS++))
[ "$LOGIN_REDIRECT" -ge "1" ] && ((PASSED_CHECKS++))
[ "$LOGOUT_REDIRECT" -ge "1" ] && ((PASSED_CHECKS++))
[ "$PROTECTED_ROUTES" -ge "5" ] && ((PASSED_CHECKS++))

echo "Structural validation: $PASSED_CHECKS/$TOTAL_CHECKS checks passed"

if [ "$PASSED_CHECKS" = "$TOTAL_CHECKS" ]; then
    echo "✅ ALL STRUCTURAL CHECKS PASSED - Ready for manual testing"
else
    echo "⚠️  Some structural issues detected - review before manual testing"
fi

echo ""
echo "📋 Next Steps:"
echo "1. Start application: npm start (already running)"
echo "2. Open browser: http://localhost:3000"
echo "3. Follow FINAL_MANUAL_VERIFICATION.md checklist"
echo "4. Complete all test scenarios A1-D2"
echo "5. Sign off on verification before deployment"
