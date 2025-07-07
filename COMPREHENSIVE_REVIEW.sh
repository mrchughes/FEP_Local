#!/bin/bash

echo "🔍 COMPREHENSIVE SYSTEM REVIEW"
echo "=============================="
echo "Testing all screens, data persistence, and user isolation"
echo ""

cd mern-app/frontend

echo "1. CHECKING SCREEN LOADING AND DATA PERSISTENCE"
echo "===============================================" 

echo "✅ Checking FormPage data persistence logic:"
grep -n -A5 -B5 "Save and continue" src/pages/FormPage.js
echo ""

echo "✅ Checking FormPage auto-save logic:"
grep -n -A3 -B3 "saveFormData" src/pages/FormPage.js | head -10
echo ""

echo "✅ Checking user isolation in persistence:"
grep -n "user?.email" src/pages/FormPage.js | head -5
echo ""

echo "2. CHECKING SUMMARY/TASK LIST ACCESS"
echo "==================================="

echo "✅ Checking TaskListPage route and access:"
grep -n -A3 -B3 "/tasks" src/App.js
echo ""

echo "✅ Checking Dashboard continue button:"
grep -n -A5 -B5 "Continue application" src/pages/DashboardPage.js
echo ""

echo "✅ Checking login redirect to dashboard:"
grep -n -A3 -B3 'navigate("/dashboard")' src/auth/AuthContext.js
echo ""

echo "3. CHECKING PROGRESS STATUS ACCURACY"
echo "==================================="

echo "✅ Checking TaskListPage progress loading:"
grep -n -A5 -B5 "loadSectionProgress" src/pages/TaskListPage.js
echo ""

echo "✅ Checking DashboardPage progress calculation:"
grep -n -A5 -B5 "savedSectionProgress" src/pages/DashboardPage.js
echo ""

echo "4. CHECKING ALL DOCUMENT SECTIONS"
echo "================================"

echo "✅ Checking form structure sections (should show 9):"
grep -n "id:" src/data/formStructure.js
echo ""

echo "✅ Checking FormPage renders all steps (should show 1-9):"
grep -n "renderStep" src/pages/FormPage.js | head -9
echo ""

echo "✅ Checking ReviewPage shows all sections:"
grep -n -A3 -B3 "formSections.map" src/pages/ReviewPage.js
echo ""

echo "5. CHECKING USER-SPECIFIC DATA ISOLATION"
echo "======================================="

echo "✅ Checking localStorage keys use user.email:"
grep -n "user\.email\|user?.email" src/utils/formPersistence.js
echo ""

echo "✅ Checking progress functions use user.email:"
grep -n "user\.email\|user?.email" src/utils/formProgress.js
echo ""

echo "6. BUILD AND STRUCTURAL VALIDATION"
echo "================================="

echo "✅ Building application to check for errors..."
npm run build 2>&1 | tail -10
echo ""

echo "✅ Checking route structure:"
echo "Routes defined in App.js:"
grep -E "path=.*element=" src/App.js
echo ""

echo "📋 MANUAL TESTING CHECKLIST - EXECUTE THESE TESTS:"
echo "=================================================="
echo ""
echo "TEST 1: DATA PERSISTENCE & USER ISOLATION"
echo "  a) Login as User A"
echo "  b) Fill form data in steps 1-3 and click 'Save and continue'"
echo "  c) Navigate to other pages and return"
echo "  d) VERIFY: Data persists only after 'Save and continue'"
echo "  e) Logout, login as User B"
echo "  f) VERIFY: User B sees clean form (no User A data)"
echo "  g) Login as User A again"
echo "  h) VERIFY: User A's data is still there"
echo ""
echo "TEST 2: SUMMARY/TASK LIST ACCESS"
echo "  a) Login → VERIFY: Auto-redirect to Dashboard"
echo "  b) Click 'My applications' → VERIFY: Goes to Dashboard"
echo "  c) Dashboard with progress → Click 'Continue' → VERIFY: Goes to Task List"
echo "  d) Task List shows sections with correct status"
echo ""
echo "TEST 3: PROGRESS STATUS ACCURACY"
echo "  a) Complete sections 1, 3, 5 (skip 2, 4)"
echo "  b) Navigate to Task List"
echo "  c) VERIFY: Sections 1, 3, 5 show 'Completed'"
echo "  d) VERIFY: Sections 2, 4 show 'Not started' or 'In progress'"
echo "  e) Return to Dashboard"
echo "  f) VERIFY: Progress percentage reflects completed sections"
echo ""
echo "TEST 4: ALL DOCUMENT SECTIONS PRESENT"
echo "  a) Navigate through all 9 form steps"
echo "  b) VERIFY: All steps render correctly"
echo "  c) Go to Task List"
echo "  d) VERIFY: Shows all 9 sections:"
echo "     1. Your personal details"
echo "     2. Your contact details"
echo "     3. About the person who died"
echo "     4. Address of the person who died"
echo "     5. Responsibility"
echo "     6. Funeral details"
echo "     7. Financial circumstances"
echo "     8. Evidence and documentation"
echo "     9. Declaration"
echo "  e) Go to Review page"
echo "  f) VERIFY: All 9 sections displayed with data"
echo ""

echo "🚨 CRITICAL CHECKS:"
echo "==================="
echo "- NO data mixing between users ❌"
echo "- Data persists ONLY on 'Save and continue' ✅"
echo "- All 9 sections always visible ✅"
echo "- Progress accurate to actual completion ✅"
echo "- Login always goes to Dashboard ✅"
echo "- 'My applications' always goes to Dashboard ✅"
echo ""

echo "✅ REVIEW PREPARATION COMPLETE"
echo "Open http://localhost:3000 and execute manual tests above"
