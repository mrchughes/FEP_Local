# FEP - OneLogin Integration

This document provides information about the OneLogin OIDC integration with the Financial Entitlement Platform (FEP).

## Overview

The integration enables FEP to authenticate users via the government's OneLogin identity service. This integration allows:

1. **Federated Authentication**: Users can log in using their existing government identity
2. **WebID Support**: Users can connect to their Personal Data Store (PDS) using their OneLogin WebID
3. **Credential Access**: FEP can access user credentials stored in their PDS with user consent
4. **WebID Alias Resolution**: Support for audience-specific WebID aliases for privacy protection
5. **DNS Verification**: Domain ownership verification during client registration

## Integration Components

The integration consists of:

1. **Authentication Flow**: Standard OAuth 2.0 authorization code flow with OneLogin as the OIDC provider
2. **WebID Resolution**: Support for multiple WebID aliases based on service audience
3. **PDS Integration**: Using OneLogin tokens to access the user's PDS
4. **Client Registration**: Secure registration with OneLogin including DNS verification
5. **WebID Display**: UI components to show the user's WebID and aliases

## Key Files

- **OAuth Client Service**: `services/oneloginOAuthClientService.js` - Handles OAuth client registration, token operations, and DNS verification
- **Auth Controller**: `controllers/oneloginAuthController.js` - Authentication logic for OneLogin including WebID alias resolution
- **Auth Routes**: `routes/oneloginAuthRoutes.js` - API routes for OneLogin authentication
- **Client Routes**: `routes/clientRoutes.js` - Routes for client registration and verification
- **Auth Middleware**: `middleware/authMiddleware.js` - Authentication middleware that supports both JWT and OneLogin tokens
- **PDS Service**: `services/pdsService.js` - Updated to use OneLogin tokens for PDS operations
- **User Model**: `models/User.js` - Updated to store OneLogin-related user data including WebID aliases
- **WebID Display**: `frontend/src/components/WebIdDisplay.js` - UI component to display WebID and aliases

## WebID Alias Resolution

OneLogin provides audience-specific WebID aliases to protect user privacy across different services:

1. Each user has a master WebID that uniquely identifies them
2. When a user authenticates with a service, OneLogin generates a unique WebID alias specific to that service audience
3. This prevents tracking users across different services while maintaining a consistent identity
4. The FEP service resolves aliases to master WebIDs using OneLogin's resolution service
5. Both the master WebID and alias WebIDs are stored in the user's record

Example:
- Master WebID: `https://identity.gov.uk/users/123456`
- FEP-specific alias: `https://identity.gov.uk/users/123456/audience/fep.gov.uk`
- DRO-specific alias: `https://identity.gov.uk/users/123456/audience/dro.gov.uk`

## DNS Verification

To ensure secure client registration, FEP implements DNS-based domain verification:

1. During client registration, a unique verification token is generated
2. This token needs to be added as a TXT record to the domain's DNS settings
3. OneLogin verifies domain ownership by checking for this TXT record
4. Only after successful verification can the client be registered

Example DNS TXT record:
```
_onelogin-verify.fep.gov.uk IN TXT "onelogin-verify=abc123def456"
```

In development environments, DNS verification can be bypassed to simplify local development.

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
NODE_ENV=production # Set to 'development' to bypass DNS verification

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
   - The WebID alias is resolved to the master WebID
   - Both the master WebID and alias are stored in the user record

5. User is now authenticated and can access the FEP application
   - The dashboard displays both the master WebID and any aliases

## Client Registration Flow

1. FEP initiates client registration with OneLogin:
   ```
   POST /api/client/register
   ```

2. DNS verification is performed:
   - A verification token is generated
   - The token should be added as a TXT record to the domain's DNS
   - OneLogin verifies the token is present in DNS

3. After successful verification (or bypass in development), the client is registered
   - Client ID and secret are stored securely
   - Registration includes redirect URIs, scopes, and domain information

## PDS Access Flow

1. User authenticates with OneLogin

2. FEP stores the OneLogin tokens and WebID in the user's account
   - Both master WebID and aliases are stored for reference

3. When FEP needs to access the user's PDS, it uses the stored tokens
   - The appropriate WebID alias is used as the audience parameter for PDS requests
   - This ensures proper scoping of credential access

4. For credential operations, the audience parameter is passed through the API:
   ```
   GET /api/credentials?audience=fep.gov.uk
   POST /api/credentials?audience=fep.gov.uk
   ```

5. The credential service resolves the WebID using the audience parameter:
   - If an audience is specified, it checks for a matching WebID alias
   - If no audience is specified or no alias exists, it uses the master WebID
   - The resolved WebID is used to access the user's PDS

6. If tokens expire, FEP automatically refreshes them using the refresh token

## Testing

To test the OneLogin integration:

1. Configure the environment variables
   - Set `NODE_ENV=development` to bypass DNS verification during testing

2. Start the FEP application

3. Register the client:
   ```
   curl -X POST http://localhost:3001/api/client/register
   ```

4. Navigate to `/auth/onelogin` to initiate the login flow

5. After login, you should be redirected to the dashboard
   - The dashboard should show your WebID and any aliases

6. To test PDS access, use the credential mapping functionality to fetch and map credentials

7. To test DNS verification (in production):
   - Add the TXT record to your domain as instructed
   - Set `NODE_ENV=production`
   - Attempt client registration again

4. **Missing WebID**: If users don't have a WebID in their OneLogin profile, PDS integration won't work.

## Next Steps

1. Complete end-to-end testing with a live OneLogin instance
2. Implement complete error handling and recovery mechanisms
3. Add user interface components for the OneLogin authentication flow
4. Update frontend to work with the new authentication system
