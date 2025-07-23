# Multiple Audience Support for WebID Alias Handling

## Overview

This document describes the implementation of multiple audience support for WebID alias handling in the FEP service. This feature allows retrieving credentials from multiple sources with a single request.

## Key Features

1. **Multiple Audience Queries**: The API now supports specifying multiple audiences in a single request
2. **Consolidated Results**: Results from multiple PDSs are combined and deduplicated
3. **Source Tracking**: Each credential is tagged with its source audience
4. **Optimized Resolution**: WebID resolution leverages caching for optimal performance
5. **Consistent API**: The API remains backwards-compatible with single audience requests

## Implementation Details

### API Endpoints

All credential endpoints now support multiple audiences using comma-separated values:

```
GET /api/credentials?audience=fep.gov.uk,hmrc.gov.uk,dwp.gov.uk
GET /api/credentials/form-data?audience=fep.gov.uk,hmrc.gov.uk,dwp.gov.uk
```

### Controller Implementation

The controller parses comma-separated audience parameters into arrays:

```javascript
// Handle multiple audiences (comma-separated in the query)
let audience = req.query.audience;
if (audience && audience.includes(',')) {
    audience = audience.split(',').map(a => a.trim()).filter(Boolean);
    console.log(`[CONTROLLER] Processing multiple audiences: ${audience.join(', ')}`);
}
```

### Service Implementation

The credential service handles arrays of audiences:

```javascript
// Handle multiple audiences if provided
if (Array.isArray(options.audience) && options.audience.length > 0) {
    // Resolve WebIDs for all audiences
    const resolvedWebIds = await resolveWebId(session.webId, options.audience);
    
    // Retrieve credentials from each PDS endpoint
    const allCredentialsPromises = resolvedWebIds.map(async (webId, index) => {
        // Get credentials from each PDS...
    });

    // Combine and deduplicate results
    const allCredentialsArrays = await Promise.all(allCredentialsPromises);
    const allCredentials = allCredentialsArrays.flat();
    
    // Deduplicate by credential ID...
}
```

### WebID Resolution

The WebID resolution function is enhanced to handle arrays of audiences:

```javascript
// Handle array of audiences (return array of resolved WebIDs)
if (Array.isArray(audience)) {
    if (audience.length === 0) {
        return webId;
    }
    
    // Resolve each audience and return array of WebIDs
    const resolvedWebIds = await Promise.all(
        audience.map(singleAudience => resolveWebId(webId, singleAudience))
    );
    
    return resolvedWebIds;
}
```

## Usage Examples

### Retrieving Credentials from Multiple Sources

Using the frontend service:

```javascript
// Get credentials from multiple audiences
const credentials = await credentialService.getCredentials({
    type: 'FormDataCredential',
    audience: ['fep.gov.uk', 'hmrc.gov.uk', 'dwp.gov.uk']
});

// Process credentials with source audience information
credentials.forEach(credential => {
    console.log(`Credential from ${credential._sourceAudience}`);
    // Process credential...
});
```

Using direct API calls:

```javascript
// Get credentials from multiple audiences
const response = await fetch('/api/credentials?audience=fep.gov.uk,hmrc.gov.uk,dwp.gov.uk');
const credentials = await response.json();
```

### Retrieving Form Data from Multiple Sources

```javascript
// Get form data from multiple audiences
const formData = await credentialService.getFormData(['fep.gov.uk', 'hmrc.gov.uk']);

// Check source audience if relevant
if (formData._sourceAudience) {
    console.log(`Form data from ${formData._sourceAudience}`);
}
```

## Performance Considerations

1. **Parallel Requests**: Requests to multiple PDSs are made in parallel for optimal performance
2. **Caching**: WebID resolution results are cached for each audience
3. **Deduplication**: Credentials with the same ID are deduplicated, keeping the most complete version
4. **Error Handling**: Failures in one PDS don't prevent retrieving data from others

## Best Practices

1. **Limit Audiences**: Request only the audiences that are relevant to your use case
2. **Check Source**: Always check the `_sourceAudience` property when using multiple audiences
3. **Handle Missing Data**: Be prepared for some audiences to return no data
4. **Consider Privacy**: Be mindful of privacy implications when aggregating data across sources
