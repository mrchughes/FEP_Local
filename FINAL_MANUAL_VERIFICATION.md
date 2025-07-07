# FINAL MANUAL VERIFICATION CHECKLIST
## MERN Funeral Expenses App - Pre-Deployment Testing

**Application URL:** http://localhost:3000  
**Backend Status:** Should be running on configured port  
**Date:** July 6, 2025

---

## ✅ CRITICAL FLOW VERIFICATION

### A) NAVIGATION & "MY APPLICATIONS" LINK TESTS

#### Test A1: Dashboard → "Your applications" Link
1. **Login** to the application with valid credentials
2. Navigate to **Dashboard** (should auto-redirect after login)
3. Click **"Your applications"** link in the top navigation
4. **EXPECTED:** Should stay on or return to Dashboard page
5. **VERIFY:** URL remains `/dashboard`

#### Test A2: Form → "Your applications" Link  
1. From Dashboard, click **"Start application"** or **"Continue application"**
2. Navigate to any form step or task list
3. Click **"Your applications"** link in the top navigation
4. **EXPECTED:** Should return to Dashboard page
5. **VERIFY:** URL changes to `/dashboard`

#### Test A3: Logout → Login Flow
1. From any page, click **"Sign out"** button
2. **EXPECTED:** Redirected to login page (`/`)
3. Login again with the same credentials
4. **EXPECTED:** Automatically redirected to Dashboard (`/dashboard`)
5. **VERIFY:** All user data and progress is preserved

---

### B) DATA PERSISTENCE & USER ISOLATION TESTS

#### Test B1: User-Specific Data Isolation
1. **Login as User A** (create test account if needed)
2. Start a new application and fill in some form data (steps 1-3)
3. **Logout** (Sign out)
4. **Login as User B** (different test account)
5. Start a new application
6. **EXPECTED:** Form should be completely empty/clean for User B
7. **Logout** and **Login as User A** again
8. **EXPECTED:** User A's previous data should still be there

#### Test B2: Dashboard Progress Display
1. **Login** and ensure some form progress exists
2. Navigate to **Dashboard**
3. **VERIFY:** Dashboard shows correct progress percentage
4. **VERIFY:** Shows "Continue application" button (not "Start application")
5. Click **"Your applications"** link
6. **EXPECTED:** Returns to Dashboard with same progress displayed

#### Test B3: Data Persistence Across Sessions
1. **Login** and start/continue an application
2. Fill in data across multiple form steps
3. Close browser completely
4. Reopen browser and navigate to application
5. **Login** with same credentials
6. **EXPECTED:** Dashboard shows correct progress
7. Continue application - **EXPECTED:** All data is preserved

---

### C) FORM SECTION COMPLETENESS TESTS

#### Test C1: All 9 Form Steps Navigation
1. Start a new application from Dashboard
2. Navigate through **ALL 9 steps** using **Next** button:
   - Step 1: Personal Details
   - Step 2: Contact Details  
   - Step 3: About the Deceased
   - Step 4: Deceased Address
   - Step 5: Responsibility
   - Step 6: Funeral Details
   - Step 7: Financial Circumstances
   - Step 8: Evidence & Documentation
   - Step 9: Declaration
3. **VERIFY:** Each step displays correctly with proper fields
4. Navigate backwards using **Previous** button through all steps
5. **VERIFY:** All data is preserved during navigation

#### Test C2: Task List Section Display
1. From Dashboard, click **"Continue application"** 
2. Navigate to **Task List** page (`/tasks`)
3. **VERIFY:** All 9 sections are listed:
   - Your personal details
   - Your contact details
   - About the person who died
   - Address of the person who died
   - Responsibility
   - Funeral details
   - Financial circumstances
   - Evidence and documentation
   - Declaration
4. **VERIFY:** Each section shows correct status (Not started/In progress/Completed)

#### Test C3: Review Page Section Display
1. Complete enough form data to access Review page
2. Navigate to **Review page** (`/review`)
3. **VERIFY:** All 9 sections are displayed with data
4. **VERIFY:** No sections are missing or filtered out
5. Click **"Change"** links to edit specific sections
6. **VERIFY:** Navigation returns to correct form step
7. Return to Review page
8. **VERIFY:** Changes are reflected and all sections still shown

---

### D) FRESH APPLICATION FLOW TESTS

#### Test D1: Fresh Start Behavior
1. From Dashboard with existing progress, click **"Start application"**
2. **EXPECTED:** URL should be `/form?fresh=true`
3. **VERIFY:** Form starts at Step 1 with completely clean data
4. **VERIFY:** Previous application data is not cleared until new data is saved

#### Test D2: Continue Application Behavior  
1. From Dashboard with existing progress, click **"Continue application"**
2. **EXPECTED:** URL should be `/tasks` (Task List page)
3. **VERIFY:** All existing progress and data is displayed
4. Continue to form from Task List
5. **VERIFY:** Form resumes from appropriate step with saved data

---

## 🔧 TECHNICAL VERIFICATION POINTS

### Authentication & Context
- [ ] Login sets user context with token
- [ ] Logout clears user context and localStorage  
- [ ] PrivateRoute protects all authenticated pages
- [ ] All API calls include authentication token

### Data Storage & Isolation
- [ ] localStorage keys use `user.email` for isolation
- [ ] Database operations use authenticated user
- [ ] No data mixing between different users
- [ ] Auto-save preserves data without affecting other users

### Navigation & Routing
- [ ] All routes defined correctly in App.js
- [ ] "Your applications" always points to `/dashboard`
- [ ] Login success redirects to `/dashboard`
- [ ] Logout redirects to `/` (login page)

### Form Implementation
- [ ] All 9 `renderStep` functions exist and work
- [ ] Form structure defines all 9 sections
- [ ] Step validation prevents skipping incomplete sections
- [ ] Progress calculation includes all sections

---

## 🚨 CRITICAL ISSUES TO WATCH FOR

1. **Data Loss:** User data disappearing when navigating or reloading
2. **Data Mixing:** User A seeing User B's data after login/logout
3. **Missing Sections:** Any of the 9 sections missing from form, task list, or review
4. **Navigation Loops:** "Your applications" not returning to Dashboard
5. **Authentication Issues:** Login not redirecting properly or logout not working
6. **Progress Calculation:** Dashboard showing incorrect progress percentage

---

## ✅ SIGN-OFF CHECKLIST

After completing all tests above:

- [ ] **A1-A3:** All navigation flows work correctly
- [ ] **B1-B3:** Data persistence and user isolation verified  
- [ ] **C1-C3:** All 9 sections present and accessible
- [ ] **D1-D2:** Fresh/continue application flows work properly
- [ ] **Technical:** No console errors during testing
- [ ] **Performance:** Application loads and responds quickly
- [ ] **Accessibility:** GOV.UK Design System compliance maintained

**Tested by:** ________________  
**Date:** ________________  
**Result:** PASS / FAIL  
**Notes:** ________________

---

## 🎯 POST-VERIFICATION ACTIONS

If all tests PASS:
1. Commit final changes
2. Deploy to production
3. Monitor production logs for any issues

If any tests FAIL:
1. Document specific failing scenarios
2. Fix identified issues
3. Re-run full test suite
4. Do not deploy until all tests pass
