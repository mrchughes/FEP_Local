#!/bin/bash

echo "🔍 COMPREHENSIVE FLOW VERIFICATION TEST"
echo "======================================"
echo ""

# Ensure we're in the correct directory
cd mern-app/frontend

echo "1. Checking Key Navigation Components..."
echo "----------------------------------------"

# Check AuthContext login function
echo "✅ AuthContext login function:"
grep -n "const login = " src/auth/AuthContext.js
echo ""

# Check Navbar 'my applications' link  
echo "✅ Navbar 'Your applications' link:"
grep -n -A2 -B2 "Your applications" src/components/Navbar.js
echo ""

# Check logout function
echo "✅ Navbar logout function:"
grep -n -A5 -B2 "onClick={logout}" src/components/Navbar.js
echo ""

echo "2. Checking Dashboard and TaskList Data Loading..."
echo "------------------------------------------------"

# Check DashboardPage useEffect for user data loading
echo "✅ DashboardPage user data loading:"
grep -n -A10 "useEffect.*loadProgressFromDatabase" src/pages/DashboardPage.js
echo ""

# Check TaskListPage useEffect for user data loading
echo "✅ TaskListPage user data loading:"
grep -n -A10 "useEffect.*loadDataFromDatabase" src/pages/TaskListPage.js
echo ""

echo "3. Checking FormPage Section Implementation..."
echo "----------------------------------------------"

# Check that all 9 steps are rendered
echo "✅ FormPage step rendering (should show steps 1-9):"
grep -n "currentStep ===" src/pages/FormPage.js | head -9
echo ""

# Check renderStep functions exist for all 9 steps
echo "✅ FormPage renderStep functions (should show 9 functions):"
grep -n "const renderStep" src/pages/FormPage.js
echo ""

echo "4. Checking Form Structure Sections..."
echo "-------------------------------------"

# Check all 9 sections are defined in formStructure
echo "✅ Form structure sections (should show 9 sections):"
grep -n "id:" src/data/formStructure.js
echo ""

echo "5. Checking User Isolation in Persistence..."
echo "-------------------------------------------"

# Check formPersistence uses user.email
echo "✅ FormPersistence user.email usage:"
grep -n "user\.email" src/utils/formPersistence.js
echo ""

# Check formProgress uses user.email
echo "✅ FormProgress user.email usage:"
grep -n "user\.email" src/utils/formProgress.js
echo ""

echo "6. Checking Authentication Flow..."
echo "--------------------------------"

# Check login navigation
echo "✅ Login navigation to dashboard:"
grep -n -A3 -B3 'navigate("/dashboard")' src/auth/AuthContext.js
echo ""

# Check logout navigation
echo "✅ Logout navigation to root:"
grep -n -A3 -B3 'navigate("/")' src/auth/AuthContext.js
echo ""

echo "7. Running Build Test..."
echo "-----------------------"

echo "Building application to verify no compilation errors..."
npm run build 2>&1 | head -20
echo ""

echo "8. Checking Critical Routes..."
echo "-----------------------------"

echo "✅ App.js routes:"
grep -n -A1 'path=' src/App.js
echo ""

echo "9. Checking Review Page Section Display..."
echo "-----------------------------------------"

echo "✅ ReviewPage section rendering:"
grep -n -A5 -B5 "formSections\.map" src/pages/ReviewPage.js
echo ""

echo "🎯 MANUAL VERIFICATION CHECKLIST:"
echo "================================="
echo ""
echo "A) NAVIGATION FLOW TESTS:"
echo "   1. Login → Dashboard → 'Your applications' link → Should stay on Dashboard"
echo "   2. Login → Dashboard → Start/Continue application → 'Your applications' link → Dashboard"
echo "   3. Login → Dashboard → Sign out → Login again → Should go to Dashboard"
echo ""
echo "B) DATA PERSISTENCE TESTS:"
echo "   1. Login as User A → Start application → Fill some data → Logout"
echo "   2. Login as User B → Start application → Should see clean form"
echo "   3. Login as User A again → Should see User A's previous data"
echo ""
echo "C) SECTION COMPLETENESS TESTS:"
echo "   1. Navigate through all 9 form steps (1-9) using Next/Previous"
echo "   2. Check TaskList shows all 9 sections with correct status"
echo "   3. Check Review page shows all 9 sections with data"
echo "   4. Navigate from Review page back to specific steps and return"
echo ""
echo "D) CRITICAL USER FLOWS:"
echo "   1. Fresh application: Dashboard → Start application → Should clear data and start at step 1"
echo "   2. Continue application: Dashboard → Continue → Should resume from saved progress"
echo "   3. Navigation: Any page → 'Your applications' → Always goes to Dashboard"
echo ""

echo "✅ VERIFICATION COMPLETE - Please run manual tests above"
