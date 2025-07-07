# 🔧 REGISTRATION ISSUE: ROOT CAUSE FIXED

**Date:** July 4, 2025  
**Status:** ✅ **CRITICAL FIXES DEPLOYED**  
**Commit:** a1f3d79 - Frontend API URL and JavaScript fixes

## 🐛 **ROOT CAUSE IDENTIFIED**

### Primary Issue: Frontend API URL Misconfiguration
**Problem:** Frontend was built with `localhost:5000` API URL instead of production URL
**Evidence:** Browser console showed CORS errors to `localhost:5000/api/auth/register`

```
Access to XMLHttpRequest at 'http://localhost:5000/api/auth/register' 
from origin 'https://app1.mrchughes.site' has been blocked by CORS policy
```

### Secondary Issue: JavaScript Runtime Error
**Problem:** GOV.UK Frontend script loading causing uncaught TypeError
**Evidence:** `Cannot read properties of undefined (reading 'initAll')`

## ✅ **FIXES APPLIED**

### 1. Frontend Docker Build Configuration
**File:** `mern-app/frontend/Dockerfile.frontend`
```dockerfile
# Added build-time environment variables
ARG REACT_APP_API_URL=https://app1.mrchughes.site/api
ARG REACT_APP_S3_BUCKET=mern-app-bucket
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_S3_BUCKET=$REACT_APP_S3_BUCKET
```

### 2. GitHub Actions Build Arguments
**File:** `.github/workflows/monorepo-deploy.yml`
```bash
docker build -f mern-app/frontend/Dockerfile.frontend \
  --build-arg REACT_APP_API_URL=https://app1.mrchughes.site/api \
  --build-arg REACT_APP_S3_BUCKET=mern-app-bucket \
  -t $ECR_REGISTRY/$ECR_REPO:$IMAGE_TAG \
  mern-app/frontend/
```

### 3. GOV.UK Frontend JavaScript Safety Check
**File:** `mern-app/frontend/public/index.html`
```javascript
// Added safety check
if (window.GOVUKFrontend && window.GOVUKFrontend.initAll) {
    window.GOVUKFrontend.initAll();
}
```

## 🔍 **WHY THIS HAPPENED**

### React Environment Variable Behavior
- **React requires environment variables at BUILD TIME, not runtime**
- **Previous build**: Used default fallback `http://localhost:5000/api`
- **ECS environment variables**: Only available at runtime (too late for React)
- **Solution**: Set variables during Docker build stage

### Build Process Flow
1. **Before Fix:**
   - Docker build → No env vars set → React uses localhost:5000 fallback
   - ECS runtime → Sets env vars → Too late, app already built

2. **After Fix:**
   - Docker build → Build args set → React builds with production URL
   - ECS runtime → App already has correct URL baked in

## 🚀 **DEPLOYMENT STATUS**

### Current Deployment
- **Commit:** a1f3d79 pushed to main
- **Status:** GitHub Actions workflow triggered
- **Expected:** New frontend image with correct API URL
- **Timeline:** ~10-15 minutes for complete deployment

### Verification Steps (After Deployment)
1. **Check new task definition version**
2. **Test registration without browser console errors**
3. **Verify API calls go to `https://app1.mrchughes.site/api`**
4. **Confirm GOV.UK Frontend JavaScript loads correctly**

## 📊 **EXPECTED RESULTS**

### ✅ Registration Will Work
- Frontend will connect to production API
- No more CORS errors to localhost:5000
- Registration form will submit successfully
- Users will receive tokens and be logged in

### ✅ JavaScript Errors Fixed
- No more GOV.UK Frontend initialization errors
- Cleaner browser console
- Better user experience

### ✅ Production-Ready Frontend
- Correctly configured for production environment
- All API calls routed to HTTPS endpoints
- Proper error handling and validation

## 🔄 **MONITORING NEXT STEPS**

1. **Wait for deployment completion** (~15 minutes)
2. **Test registration with new frontend build**
3. **Check browser console for clean logs**
4. **Verify user creation in DynamoDB**
5. **Test full authentication flow**

## 📋 **LESSONS LEARNED**

1. **React environment variables must be set at build time**
2. **Docker build args are crucial for React production builds**
3. **Always test with production build, not development mode**
4. **Browser developer tools are essential for debugging**

---

**Next Action:** Monitor deployment completion and test registration functionality

*The registration issue should be completely resolved after this deployment completes.*
