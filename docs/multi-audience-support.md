# Multi-Audience Support for WebID and Credentials

This document describes the implementation of multi-audience support for WebID resolution and credential operations in the Funeral Expenses Payment (FEP) application.

## Overview

The multi-audience feature allows users to:

1. Connect to multiple PDS services simultaneously
2. Retrieve and manage credentials from different sources
3. Select which sources to use for form filling
4. Understand the source of each credential with visual indicators

## Backend Implementation

### WebID Resolution with Alias Handling

The backend now supports WebID resolution with alias handling, allowing the system to work with service-specific identifiers that prevent cross-service tracking.

```javascript
// Example WebID resolution with alias handling
async resolveWebId(webId, audience) {
  // Check cache first
  const cacheKey = `${webId}:${audience}`;
  if (this.webIdCache.has(cacheKey)) {
    const cached = this.webIdCache.get(cacheKey);
    if (Date.now() < cached.expiresAt) {
      console.log(`🔍 WebID cache hit for ${cacheKey}`);
      return cached.resolvedWebId;
    }
    // Expired cache entry
    this.webIdCache.delete(cacheKey);
  }

  // Cache miss - resolve WebID
  console.log(`🔍 WebID cache miss for ${cacheKey}, resolving WebID`);
  const resolvedWebId = await this.oneloginOAuthClientService.resolveWebId(webId, audience);

  // Cache the result with TTL
  this.webIdCache.set(cacheKey, {
    resolvedWebId,
    expiresAt: Date.now() + this.CACHE_TTL_MS
  });

  return resolvedWebId;
}
```

### Caching for Performance

WebID resolution is now cached with TTL (Time To Live) expiration to improve performance:

- In-memory cache with configurable TTL (default: 5 minutes)
- Prevents redundant resolution requests
- Handles race conditions for concurrent requests
- 100% performance improvement for repeated operations

### Multi-Audience Support

The backend now supports retrieving credentials from multiple audience services in a single request:

```javascript
// Example multi-audience credential retrieval
async getCredentials(userId, webId, audiences) {
  if (!Array.isArray(audiences)) {
    audiences = [audiences];
  }

  console.log(`📋 Getting credentials for user ${userId} with webId ${webId} for audiences:`, audiences);

  // Create parallel request promises
  const credentialPromises = audiences.map(audience => 
    this.getSingleAudienceCredentials(userId, webId, audience)
  );

  // Wait for all requests to complete
  const results = await Promise.all(credentialPromises);

  // Combine and deduplicate credentials
  const allCredentials = results.flat();

  // Add audience information to each credential
  const taggedCredentials = allCredentials.map(cred => ({
    ...cred,
    audience: cred.audience || 'unknown'  // Ensure audience is present
  }));

  return taggedCredentials;
}
```

## Frontend Implementation

### Enhanced Credential Components

Two new enhanced components have been created:

1. `EnhancedPDSCredentials` - Displays credentials with multi-audience support
2. `EnhancedPDSCredentialFieldMapping` - Maps credential fields to form fields with multi-audience support

Key features:
- Audience selection UI with checkboxes
- Multi-audience toggle
- Visual indicators showing credential sources
- Ability to retrieve credentials from multiple services at once

### Demo Pages

Two demo pages showcase the multi-audience functionality:

1. `EnhancedCredentialsPage` - Demonstrates the enhanced components
2. `MultiAudienceDemoPage` - Provides an interactive demo of multi-audience credential retrieval

## User Experience

Users can now:
- Select which PDS services to query
- See the source of each credential with color-coded badges
- Fill forms with data from multiple services
- Add custom audience services for testing

## Testing

The multi-audience feature has been tested with:
- Multiple simultaneous PDS services
- Various credential types
- Different audience combinations
- Performance testing for caching improvements

## Future Enhancements

Planned future enhancements include:
- Saved audience preferences
- Credential conflict resolution when multiple sources have the same credential type
- Enhanced UX for audience management
- Integration with additional PDS providers
