# OneLogin Integration with FEP - Implementation Summary

This document summarizes the changes made to integrate the FEP (Financial Evidence Provider) service with the OneLogin OIDC provider in the PDS 2.2 architecture.

## Changes Implemented

### 1. OAuth Client Service Updates

The `oneloginOAuthClientService.js` file was updated with:

- Updated configuration to use the new OneLogin OIDC provider URL (`http://onelogin-oidc:3010`)
- Added client type configuration (`CLIENT_TYPE=government`)
- Added DNS verification service URL configuration
- Enhanced client registration to include client type
- Added domain verification token retrieval from the OneLogin OIDC provider
- Updated domain verification process to work with the DNS verification service
- Modified WebID resolution to handle both direct WebIDs (for government services) and WebID aliases (for private services)

### 2. Authentication Controller Updates

The `oneloginAuthController.js` was updated to:

- Add handling for direct WebIDs for government services
- Track WebID alias usage with metadata (service type, creation date, last used)
- Store both master WebIDs and aliases in the user profile
- Handle WebID resolution based on client type
- Update user records with enhanced WebID information

### 3. Documentation

Added `README-ONELOGIN.md` to:

- Explain the government authentication flow
- Detail the DNS verification process
- List required environment variables
- Document the authentication endpoints
- Provide implementation notes specific to government services

## Environment Variables

The following environment variables were updated:

- `ONELOGIN_BASE_URL`: URL of the OneLogin OIDC provider (replaces `OIDC_PROVIDER_URL`)
- `ONELOGIN_CLIENT_ID`: Client ID for the FEP service (replaces `CLIENT_ID`)
- `ONELOGIN_CLIENT_SECRET`: Client secret for the FEP service (replaces `CLIENT_SECRET`)
- `CLIENT_TYPE`: Set to "government" for the FEP service
- `SERVICE_NAME`: Set to "Financial Evidence Provider"
- `DNS_VERIFICATION_URL`: URL of the DNS verification service
- `REDIRECT_URI`: Updated to use the government domain (`fep.gov.uk.local`)

## DNS Verification Process

The DNS verification process now follows these steps:

1. The FEP service requests a verification token from the OneLogin OIDC provider
2. A DNS TXT record must be added to the FEP domain
3. The DNS verification service checks for this record
4. OneLogin marks the client as verified once the domain is confirmed

## Authentication Flow

The government authentication flow now follows these steps:

1. User accesses the FEP service
2. FEP redirects to OneLogin with `client_type=government`
3. OneLogin presents the GOV.UK styled login interface
4. User authenticates and provides consent
5. OneLogin issues tokens with the user's direct WebID
6. FEP validates the tokens and creates a session
7. User can now use FEP services with their direct WebID

## WebID Handling

As a government service, FEP now uses direct WebIDs instead of aliases. However, the system is capable of:

1. Determining the appropriate WebID based on client type
2. Tracking WebID aliases associated with a user
3. Storing metadata about WebID aliases (creation date, service type, last used)
4. Supporting both government services (direct WebIDs) and private services (alias WebIDs)

## Next Steps

1. Complete end-to-end testing of the integration
2. Update frontend components to work with the new authentication flow
3. Add monitoring and logging for authentication flows
4. Create user-facing documentation for the authentication process
