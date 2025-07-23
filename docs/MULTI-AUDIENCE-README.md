# Multi-Audience Support for PDS Integration

This README provides instructions for using and testing the multi-audience support feature for WebID resolution and credential operations in the FEP application.

## Overview

The multi-audience feature allows users to:
- Connect to multiple PDS services simultaneously
- Retrieve credentials from different sources
- Select which sources to use for form filling
- See the source of each credential with visual indicators

## Setup and Installation

1. Make sure you have the latest version of the FEP application:
   ```
   git pull origin main
   ```

2. Install dependencies:
   ```
   cd mern-app/backend && npm install
   cd ../frontend && npm install
   ```

3. Start the application:
   ```
   # In one terminal
   cd mern-app/backend && npm run dev
   
   # In another terminal
   cd mern-app/frontend && npm run start
   ```

## Using Multi-Audience Features

### Enhanced Credentials Page

Navigate to `/enhanced-credentials` to use the enhanced credentials page.

This page allows you to:
- View credentials from multiple PDS sources
- Select which audiences to retrieve credentials from
- See the source of each credential with color-coded badges
- Import credential data into forms

### Multi-Audience Demo

Navigate to `/multi-audience-demo` to use the multi-audience demo page.

This interactive demo allows you to:
- Select which audiences to query
- Add custom audience names for testing
- See the source of each credential with color-coded badges
- Visualize the parallel credential retrieval process

## API Usage

The backend API now supports multi-audience operations:

### Retrieve Credentials from Multiple Audiences

```
GET /api/pds/credentials?audience=default-pds,secondary-pds
```

### Get Form Data with Multiple Audiences

```
GET /api/pds/form-data?audience=default-pds,secondary-pds
```

### Resolve WebID with Specific Audience

```
GET /api/pds/resolve-webid?webId=https://example.com/profile/card%23me&audience=default-pds
```

## Testing

Run the test script to verify multi-audience functionality:

```
./scripts/test-multi-audience.sh
```

This script tests:
- WebID resolution with different audiences
- WebID resolution caching performance
- Multi-audience credential retrieval
- Audience tagging in credentials
- Parallel credential retrieval performance
- Form data retrieval with multiple audiences

## Development Notes

### Backend Components

- `pdsCredentialService.js`: Implements WebID resolution caching and multi-audience support
- `pdsCredentialController.js`: Handles multiple audience parameters in requests

### Frontend Components

- `EnhancedPDSCredentials.js`: UI component for viewing credentials with multi-audience support
- `EnhancedPDSCredentialFieldMapping.js`: UI component for mapping credentials with multi-audience support
- `credentialService.js`: Frontend service for multi-audience API access

## Troubleshooting

1. **Credentials not showing from all audiences**
   - Check that the audiences are correctly formatted in the request (comma-separated, no spaces)
   - Verify that the user has access to all specified audiences
   - Check the backend logs for any errors in the credential retrieval process

2. **Slow performance with multiple audiences**
   - Check that the parallel processing is working correctly
   - Verify that WebID resolution caching is functioning
   - Check for any network issues affecting specific audiences

3. **WebID resolution errors**
   - Ensure the WebID is correctly URL-encoded
   - Check that the audience parameter is correctly specified
   - Verify that the oneloginOAuthClientService is properly configured

## Further Documentation

For more detailed information, see:
- [Multi-Audience Support](../docs/multi-audience-support.md)
- [PDS Integration Implementation Status](../docs/PDS-Integration-Implementation-Status.md)
