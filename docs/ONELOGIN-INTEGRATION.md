# FEP - OneLogin Integration

This document provides information about the OneLogin OIDC integration with the Financial Entitlement Platform (FEP).

## Overview

The integration enables FEP to authenticate users via the government's OneLogin identity service. This integration allows:

1. **Federated Authentication**: Users can log in using their existing government identity
2. **WebID Support**: Users can connect to their Personal Data Store (PDS) using their OneLogin WebID
3. **Credential Access**: FEP can access user credentials stored in their PDS with user consent

## Integration Components

The integration consists of:

1. **Authentication Flow**: Standard OAuth 2.0 authorization code flow with OneLogin as the OIDC provider
2. **WebID Resolution**: Support for multiple WebID aliases based on service audience
3. **PDS Integration**: Using OneLogin tokens to access the user's PDS

## Key Files

- **OAuth Client Service**: `services/oneloginOAuthClientService.js` - Handles OAuth client registration and token operations
- **Auth Controller**: `controllers/oneloginAuthController.js` - Authentication logic for OneLogin
- **Auth Routes**: `routes/oneloginAuthRoutes.js` - API routes for OneLogin authentication
- **Auth Middleware**: `middleware/authMiddleware.js` - Authentication middleware that supports both JWT and OneLogin tokens
- **PDS Service**: `services/pdsService.js` - Updated to use OneLogin tokens for PDS operations
- **User Model**: `models/User.js` - Updated to store OneLogin-related user data

## Configuration

The following environment variables should be set:

```
# OneLogin Integration
OIDC_PROVIDER_URL=https://your-onelogin-instance.gov.uk
CLIENT_ID=your-client-id
CLIENT_SECRET=your-client-secret
REDIRECT_URI=https://your-fep-service.gov.uk/auth/onelogin-callback
FEP_DOMAIN=your-fep-service.gov.uk
JWT_SECRET=your-jwt-secret
SESSION_SECRET=your-session-secret

# PDS Integration
SERVICE_DOMAIN=your-fep-service.gov.uk
SERVICE_DID=did:web:your-fep-service.gov.uk
SERVICE_URL=https://your-fep-service.gov.uk
```

## Authentication Flow

1. User initiates login via OneLogin:
   ```
   GET /auth/onelogin
   ```

2. User is redirected to OneLogin for authentication

3. OneLogin redirects back to FEP with an authorization code:
   ```
   GET /auth/onelogin-callback?code=...&state=...
   ```

4. FEP exchanges the code for tokens and creates or updates the user account

5. User is now authenticated and can access the FEP application

## PDS Access Flow

1. User authenticates with OneLogin

2. FEP stores the OneLogin tokens and WebID in the user's account

3. When FEP needs to access the user's PDS, it uses the stored tokens

4. If tokens expire, FEP automatically refreshes them using the refresh token

## Testing

To test the OneLogin integration:

1. Configure the environment variables

2. Start the FEP application

3. Navigate to `/auth/onelogin` to initiate the login flow

4. After login, you should be redirected to the dashboard

5. To test PDS access, use the credential mapping functionality to fetch and map credentials

## Troubleshooting

Common issues:

1. **Redirect URI Mismatch**: Ensure the redirect URI in your OneLogin configuration matches the one in your environment variables.

2. **Token Expiry**: If users are being logged out unexpectedly, check token expiry times and refresh token functionality.

3. **CORS Issues**: Ensure OneLogin is configured to allow your FEP domain.

4. **Missing WebID**: If users don't have a WebID in their OneLogin profile, PDS integration won't work.

## Next Steps

1. Complete end-to-end testing with a live OneLogin instance
2. Implement complete error handling and recovery mechanisms
3. Add user interface components for the OneLogin authentication flow
4. Update frontend to work with the new authentication system
