# Frontend Testing Plan - GOV.UK Task List & Form Persistence

## 🧪 Test Scenarios

### Test 1: New User Registration & Initial Form Access
1. **Navigate to:** https://app.mrchughes.site
2. **Register a new account:**
   - Click "Create an account"
   - Fill in test details (e.g., name: "Test User", email: "test@example.com")
   - Complete registration
3. **Expected Result:** Should redirect to Dashboard
4. **Verify Dashboard:**
   - Should show "Apply for funeral expenses payment" 
   - Should show "Start application" button (NOT "Continue application")
   - Progress should be 0%

### Test 2: Start Application & Partial Completion
1. **From Dashboard:** Click "Start application"
2. **Expected Result:** Should go to FormPage Step 1 (Personal Details)
3. **Fill Step 1 Partially:**
   - First name: "John"
   - Last name: "Doe" 
   - Leave other fields empty
4. **Navigate away:** Click browser back or go to Dashboard
5. **Return to Dashboard**
6. **Expected Result:** 
   - Should now show "Continue your application"
   - Should show progress percentage (25% or similar)
   - Button should say "Continue application"

### Test 3: Task List Functionality
1. **From Dashboard:** Click "Continue application"
2. **Expected Result:** Should go to `/tasks` - Task List Page
3. **Verify Task List Display:**
   - Title: "Apply for funeral expenses payment"
   - Shows progress percentage
   - Lists 4 sections:
     - Your personal details
     - Your contact details  
     - About the deceased person
     - Benefits and employment
4. **Verify Status Tags:**
   - "Your personal details" should show "In progress" (blue tag)
   - Other sections should show "Not started" (grey tags)
   - "Review and submit" should show "Cannot start yet" (grey)

### Test 4: Section Navigation from Task List
1. **From Task List:** Click "Your contact details"
2. **Expected Result:** Should go to FormPage Step 2
3. **Verify Breadcrumbs:** 
   - Should show: Your applications > Apply for funeral expenses payment > Complete section
4. **Fill Step 2 Completely:**
   - Address: "123 Test Street"
   - Postcode: "SW1A 1AA"
   - Phone: "07700900123"
   - Email: "john.doe@test.com"
5. **Navigate back:** Click "Apply for funeral expenses payment" in breadcrumbs
6. **Expected Result:** Should return to Task List
7. **Verify Updated Status:**
   - "Your contact details" should now show "Completed" (green tag)
   - Progress should have increased

### Test 5: Form Data Persistence Test
1. **From Task List:** Click "About the deceased person"
2. **Fill Step 3 Partially:**
   - Deceased first name: "Jane"
   - Leave other fields empty
3. **Close browser tab completely**
4. **Reopen:** https://app.mrchughes.site
5. **Login with same account**
6. **Expected Results:**
   - Dashboard should still show "Continue application" with progress
   - Clicking "Continue" should go to Task List
   - Task List should show saved progress:
     - Personal details: "In progress"
     - Contact details: "Completed" 
     - Deceased person: "In progress"
     - Benefits: "Not started"

### Test 6: Complete All Sections
1. **Complete remaining fields in all sections:**
   
   **Personal Details (Step 1):**
   - Date of birth: "01/01/1980"
   - National Insurance: "AB123456C"
   
   **Deceased Person Details (Step 3):**
   - Deceased last name: "Smith"
   - Relationship: "Parent"
   
   **Benefits and Employment (Step 4):**
   - Select at least one benefit (e.g., "Universal Credit")
   - Employment status: any option

2. **Return to Task List**
3. **Expected Results:**
   - All 4 sections should show "Completed" (green tags)
   - Progress should be 100%
   - "Review and submit application" should show "Ready" (blue tag)

### Test 7: Review and Submit
1. **From Task List:** Click "Review and submit application"
2. **Expected Result:** Should go to Review Page
3. **Verify Review Page:**
   - Should display all entered data
   - Should allow editing individual fields
4. **Submit Application**
5. **Expected Results:**
   - Should go to Confirmation page
   - Should clear all saved progress
   - Returning to Dashboard should show "Start application" again (not "Continue")

### Test 8: Checkbox/Radio Layout Verification
1. **Navigate to Benefits section (Step 4)**
2. **Verify Checkbox Layout:**
   - Checkboxes should appear to the LEFT of the text labels
   - NOT above the question text
   - Should follow GOV.UK pattern
3. **Navigate to Deceased Person section (Step 3)**
4. **Verify Radio Button Layout:**
   - Radio buttons should appear to the LEFT of the text labels
   - "Relationship to deceased" options should be properly aligned

## ✅ Success Criteria

### Dashboard Behavior:
- [ ] New users see "Start application"
- [ ] Users with progress see "Continue application" + percentage
- [ ] Correct navigation to form vs task list

### Task List Page:
- [ ] Shows all 4 sections with correct status
- [ ] Color-coded status tags work correctly
- [ ] Progress percentage updates accurately
- [ ] Direct section navigation works
- [ ] Review section locks until all complete

### Form Persistence:
- [ ] Data saves automatically without manual action
- [ ] Progress persists across browser restarts
- [ ] Can navigate freely between sections
- [ ] Partial completion tracked correctly

### GOV.UK Compliance:
- [ ] Checkboxes to left of labels (not above)
- [ ] Radio buttons to left of labels  
- [ ] Proper GOV.UK styling and colors
- [ ] Accessibility features work

### Navigation Flow:
- [ ] Breadcrumbs work correctly
- [ ] URL parameters for direct section access
- [ ] Smart routing based on user state
- [ ] Clean redirect flow

## 🐛 Issues to Report

If any test fails, please note:
1. Which test step failed
2. What you expected to see
3. What actually happened
4. Browser and device used
5. Any console errors (F12 > Console)

## 📝 Test Results Template

```
✅ Test 1 (New User): PASS/FAIL - Notes:
✅ Test 2 (Partial Completion): PASS/FAIL - Notes:
✅ Test 3 (Task List): PASS/FAIL - Notes:
✅ Test 4 (Section Navigation): PASS/FAIL - Notes:
✅ Test 5 (Data Persistence): PASS/FAIL - Notes:
✅ Test 6 (Complete Sections): PASS/FAIL - Notes:
✅ Test 7 (Review/Submit): PASS/FAIL - Notes:
✅ Test 8 (Checkbox/Radio Layout): PASS/FAIL - Notes:
```

This comprehensive test will validate that all the GOV.UK task list functionality, form persistence, and checkbox/radio fixes are working correctly in the deployed environment.
