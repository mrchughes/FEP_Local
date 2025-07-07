# Frontend Task List Testing Report

## Test Plan: GOV.UK Task List Implementation

### Objective
Test the complete user journey including:
1. User registration/login
2. Form data persistence  
3. Task list functionality
4. Section navigation
5. Progress tracking
6. Pause and resume functionality

### Test Cases

#### Test Case 1: New User Registration
**Steps:**
1. Navigate to https://mrchughes.site
2. Click "Register" 
3. Create test account with email: `tasktest@example.com`
4. Complete registration process
5. Verify successful login

**Expected Result:**
- Dashboard shows "Start application" button
- No existing progress shown
- Clean slate for new application

#### Test Case 2: Start New Application  
**Steps:**
1. From dashboard, click "Start application"
2. Fill in partial personal details (first name, last name only)
3. Navigate away from the page
4. Return to dashboard

**Expected Result:**
- Dashboard now shows "Continue application" 
- Progress percentage visible
- User can continue where they left off

#### Test Case 3: Task List Navigation
**Steps:**
1. Click "Continue application" from dashboard
2. Should land on Task List page (/tasks)
3. Verify section status indicators
4. Test direct navigation to different sections

**Expected Result:**
- Task list shows 4 main sections
- Personal details shows "In progress" (blue tag)
- Other sections show "Not started" (grey tags) 
- Can click to jump to specific sections

#### Test Case 4: Section Completion Tracking
**Steps:**
1. Complete Personal Details section entirely
2. Return to task list
3. Complete Contact Details section
4. Verify progress updates

**Expected Result:**
- Completed sections show green "Completed" tags
- Progress percentage increases
- Breadcrumb navigation works
- Can jump between completed sections

#### Test Case 5: Pause and Resume Functionality
**Steps:**
1. Fill partial data in Deceased Person Details
2. Close browser entirely
3. Reopen browser and login
4. Verify data persistence

**Expected Result:**
- Dashboard shows "Continue application" with correct progress
- Task list shows accurate section statuses
- All previously entered data is preserved
- Can continue from where left off

#### Test Case 6: Review Section Access
**Steps:**
1. Complete all 4 main sections
2. Return to task list
3. Verify "Review and submit" section is enabled

**Expected Result:**
- Review section shows "Ready" status (blue tag)
- Can access review page
- All form data displayed correctly

#### Test Case 7: Submission and Cleanup
**Steps:**
1. Complete and submit application
2. Return to dashboard after submission
3. Verify progress is cleared

**Expected Result:**
- Successful submission and confirmation
- Dashboard resets to "Start application" 
- No saved progress remains
- Clean state for new application

### Browser Testing
- Test on Chrome, Firefox, Safari
- Test responsive design on mobile
- Verify accessibility features work
- Test keyboard navigation

### Performance Checks
- Page load times
- Form data saving responsiveness  
- Task list rendering speed
- Navigation smoothness

---

## Test Execution Log

**Date:** July 6, 2025
**Environment:** Production (https://mrchughes.site)
**Browser:** Chrome/Safari
**Test Account:** tasktest@example.com

### Execution Results:

[Test results will be documented here during execution]
