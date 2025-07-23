# FEP Service - OneLogin Integration

This document provides a guide for integrating the FEP (Financial Evidence Provider) service with the OneLogin OIDC provider in the PDS 2.2 architecture.

## Integration Components

The integration consists of:

1. **Authentication Flow**: Standard OAuth 2.0 authorization code flow with OneLogin as the OIDC provider
2. **Direct WebID Usage**: As a government service, FEP uses direct WebIDs (not aliases)
3. **Government Domain Verification**: Verification of government domains using DNS TXT records
4. **PDS Integration**: Accessing the user's PDS to retrieve and store financial evidence

## Key Files

- **Routes**: `/src/routes/oneloginAuthRoutes.js` - Authentication routes for OneLogin
- **Services**: `/src/services/oneloginOAuthClientService.js` - OAuth client registration and API calls
- **Controllers**: `/src/controllers/oneloginAuthController.js` - Authentication logic
- **Database**: Uses DynamoDB via the dynamodbService for user management

## Authentication Flow

As a government service, FEP follows the government authentication flow:

1. User accesses FEP service
2. FEP redirects to OneLogin OIDC provider with `client_type=government`
3. OneLogin presents the GOV.UK styled login interface
4. User authenticates and provides consent
5. OneLogin issues tokens with the user's direct WebID (not an alias)
6. FEP validates the tokens and creates a session
7. User can now use FEP services with their direct WebID

## DNS Verification

As a government service, FEP must verify domain ownership:

1. During client registration, FEP requests a verification token from OneLogin
2. A DNS TXT record must be added to the FEP domain:
   ```
   _pds-verification.fep.gov.uk.local TXT "pds-verification=<token>"
   ```
3. The DNS verification service checks for this record
4. OneLogin marks the client as verified once the domain is confirmed

## Environment Configuration

Required environment variables:

```
# OneLogin OIDC Provider Configuration
ONELOGIN_BASE_URL=http://onelogin-oidc:3010
ONELOGIN_CLIENT_ID=your-client-id
ONELOGIN_CLIENT_SECRET=your-client-secret
REDIRECT_URI=http://fep.gov.uk.local/auth/onelogin-callback
FEP_DOMAIN=fep.gov.uk.local

# Client Type (government or private)
CLIENT_TYPE=government
SERVICE_NAME=Financial Evidence Provider

# DNS Verification Service
DNS_VERIFICATION_URL=http://dns-verification:3011

# Session and Token Security
JWT_SECRET=your-jwt-secret
SESSION_SECRET=your-session-secret
```

## Authentication Endpoints

### Initiate OneLogin Authentication
```
GET /auth/onelogin
```
Redirects the user to the OneLogin OIDC provider for authentication.

### OneLogin Callback
```
GET /auth/onelogin-callback
```
Handles the authorization code from OneLogin and establishes a session.

### Get JWT Token
```
GET /auth/onelogin-token
```
Returns a JWT token for frontend use when authenticated with OneLogin.

### Refresh Token
```
POST /auth/onelogin-refresh
{
  "refreshToken": "refresh_token_from_onelogin"
}
```
Refreshes an expired OneLogin access token.

### Validate Token
```
POST /auth/onelogin-validate
{
  "token": "access_token_from_onelogin"
}
```
Validates a OneLogin access token.

### Check Authentication Status
```
GET /auth/onelogin-status
```
Checks if the user is authenticated with OneLogin.

## Implementation Notes

1. As a government service, FEP uses direct WebIDs not aliases
2. Domain verification is required for government services
3. The service is registered with `client_type=government`
4. The GOV.UK styled login interface is presented to users
