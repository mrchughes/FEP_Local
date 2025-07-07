# Database Persistence Verification Test

## Test Scenario: Complete End-to-End Flow

### Phase 1: Data Persistence on Save and Continue
1. **Login/Register** and navigate to form
2. **Fill Step 1 partially** (first name, last name only)
3. **Click "Save and Continue"** → Should trigger auto-save to database
4. **Navigate to Dashboard** → Should show "Continue application" with progress
5. **Check Network Tab** → Should see POST request to `/api/forms/submit` with `isAutoSave: true`

### Phase 2: Logout and Login Back
1. **Logout completely** from the application
2. **Login again** with same credentials
3. **Dashboard should show:**
   - "Continue your application"
   - Progress percentage (e.g., 25%)
   - Button: "Continue application"

### Phase 3: Summary Page (Task List)
1. **Click "Continue application"** from dashboard
2. **Should navigate to `/tasks`**
3. **Verify Task List shows:**
   - "Your personal details" → "In progress" (blue tag)
   - "Your contact details" → "Not started" (grey tag)
   - "About the deceased person" → "Not started" (grey tag)
   - "Benefits and employment" → "Not started" (grey tag)
   - "Review and submit" → "Cannot start yet" (grey tag)

### Phase 4: Section Navigation from Task List
1. **Click "Your personal details"** → Should go to `/form?step=1`
2. **Complete all fields in Step 1** → Save and continue
3. **Return to task list** → Should show "Completed" (green tag)
4. **Click "Your contact details"** → Should go to `/form?step=2`
5. **Fill partial data** → Save and return to task list
6. **Should show "In progress"** for contact details

## Expected API Calls

### Auto-Save on Step Navigation:
```
POST /api/forms/submit
{
  "firstName": "John",
  "lastName": "Doe",
  "isAutoSave": true,
  ...otherFields
}
```

### Loading Data on Login:
```
GET /api/forms/resume
Response: {
  "formData": {
    "firstName": "John",
    "lastName": "Doe",
    ...
  }
}
```

## Backend Verification

### Check DynamoDB Table
The backend should store form data in DynamoDB with:
- Primary key: user email
- Data: form fields
- Timestamp: last updated
- Status: "in_progress" (vs "submitted")

### Check Form Controller
- `isAutoSave: true` → Save to database only
- `isAutoSave: false` → Save to database + upload to S3

## Potential Issues to Check

### Issue 1: API Route Mismatch
- Frontend calls `/api/forms/submit`
- Backend route might be `/api/forms/` vs `/api/form/`
- Check `mern-app/backend/app.js` for correct route mounting

### Issue 2: Authentication Token
- Verify JWT token is passed correctly in headers
- Check if token expires during testing

### Issue 3: CORS Issues
- Verify CORS allows credentials
- Check if API_URL is correctly set for production

## Manual Testing Checklist

- [ ] Form auto-saves on step navigation
- [ ] Dashboard shows progress after logout/login
- [ ] Task list loads saved progress from database
- [ ] Can navigate to specific sections via task list
- [ ] Section completion status updates correctly
- [ ] Data persists across browser sessions
- [ ] Can edit completed sections
- [ ] Progress percentage calculates correctly

## Debug Steps if Issues Found

1. **Check browser Network tab** for API calls
2. **Check browser Console** for JavaScript errors
3. **Check backend logs** for database operations
4. **Verify DynamoDB table** has correct data structure
5. **Test API endpoints directly** with Postman/curl
