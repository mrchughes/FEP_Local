# PDS Integration for Funeral Expenses Application

This document describes the implementation of Personal Data Store (PDS) integration in the Funeral Expenses Application.

## Overview

The PDS integration allows users to:

1. Connect to their Personal Data Store (SOLID-based)
2. Store form data as verifiable credentials
3. Retrieve form data from verifiable credentials
4. Manage their PDS connection

## Architecture

The PDS integration follows the SOLID OIDC authentication flow and consists of:

1. **Backend Components**:
   - PDS Service: Handles WebID resolution, PDS URL extraction, and key management
   - PDS Auth Service: Manages authentication flow with PDS providers
   - PDS Credentials Service: Handles storage and retrieval of verifiable credentials
   - Controllers and Routes: Expose PDS functionality through REST API

2. **Frontend Components**:
   - PDS Connection Component: UI for connecting to and disconnecting from PDS
   - PDS Credentials Component: UI for viewing stored credentials
   - PDS Settings Page: Container for PDS-related components

## Authentication Flow

The authentication flow with PDS providers follows these steps:

1. User enters their WebID on the frontend
2. Backend extracts the PDS URL from the WebID
3. Backend generates a state parameter and authorization URL
4. User is redirected to the PDS provider for authentication
5. PDS provider redirects back to our callback URL with an authorization code
6. Backend exchanges the code for access and refresh tokens
7. Tokens are stored securely in the database
8. Frontend displays the connection status

## Credentials Management

Verifiable credentials are used to store and retrieve form data:

1. Form data is converted to a verifiable credential format
2. Credentials are stored in the user's PDS
3. Credentials can be retrieved from the PDS to pre-fill forms
4. Users can view their stored credentials through the UI

## Security Considerations

1. All PDS tokens are encrypted before storage in the database
2. Authentication uses HTTPS for all communications
3. State parameters are used to prevent CSRF attacks
4. Token refresh is handled automatically when tokens expire
5. WebID alias handling protects user privacy across different services

## WebID Alias Handling

With the integration of OneLogin as an identity provider, the system now supports audience-specific WebID aliases:

1. **WebID Aliases**: Each user can have multiple WebID aliases, specific to different service audiences
2. **Resolution**: The system resolves these aliases to the master WebID when needed
3. **Privacy Protection**: Aliases prevent tracking users across different services
4. **Credential Operations**: When storing or retrieving credentials, the appropriate WebID is used based on the audience
5. **API Support**: All credential endpoints support the `audience` parameter to specify which WebID alias to use
6. **Performance Optimization**: WebID resolution results are cached with TTL expiration for improved performance
7. **Race Condition Handling**: Concurrent requests for the same WebID efficiently share resolution results
8. **Multiple Audience Support**: Retrieve credentials from multiple services with a single request

For detailed information about WebID alias handling, see [WebID-Alias-Handling.md](./WebID-Alias-Handling.md), [WebID-Caching.md](./WebID-Caching.md), and [Multiple-Audience-Support.md](./Multiple-Audience-Support.md).

## Testing

A test script is provided to verify PDS integration:

```bash
./scripts/test-pds-integration.sh --url http://localhost:5000/api
```

This script tests:
- PDS provider registration
- PDS connection
- Credential creation and retrieval
- Form data storage and retrieval

## Configuration

The PDS integration can be configured through environment variables:

```
# PDS Integration Settings
REACT_APP_PDS_ENABLED=true
SERVICE_URL=https://your-service-url.com
PDS_KEY_ENCRYPTION_SECRET=your-secret-key
```

## Future Enhancements

1. Support for additional PDS providers
2. Improved credential validation
3. Multi-device synchronization through PDS
4. Integration with verifiable credential wallets
