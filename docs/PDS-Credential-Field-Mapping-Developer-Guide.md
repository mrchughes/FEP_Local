# Credential Field Mapping Developer Guide

This guide provides technical information for developers working with the credential field mapping functionality in the FEP application.

## Overview

The credential field mapping functionality allows users to populate application forms using verifiable credentials from their Personal Data Store (PDS). This guide covers the implementation details, API usage, and best practices.

## Architecture

The credential field mapping functionality follows a layered architecture:

1. **Presentation Layer**: React components for UI
2. **Application Layer**: Controllers and routes for API endpoints
3. **Domain Layer**: Services for business logic
4. **Data Layer**: MongoDB models for data persistence

## Key Components

### Frontend Components

#### PDSCredentialFieldMapping.js

This component renders the UI for selecting and mapping credentials to form fields.

Key props:
- `applicationId`: The ID of the application to map fields to
- `formData`: The current form data
- `onFieldsUpdated`: Callback function when fields are updated

Usage example:
```jsx
<PDSCredentialFieldMapping 
  applicationId={id}
  formData={formData}
  onFieldsUpdated={handleFieldsUpdated}
/>
```

#### PDSConnectionStatus.js

This component displays the PDS connection status and provides connection management.

Key props:
- `isConnected`: Boolean indicating if PDS is connected
- `applicationId`: The ID of the current application
- `onConnectionChange`: Callback when connection status changes

Usage example:
```jsx
<PDSConnectionStatus
  isConnected={isPdsConnected}
  applicationId={id}
  onConnectionChange={(status) => setIsPdsConnected(status)}
/>
```

### Backend Components

#### credentialMappingController.js

This controller handles API requests for credential mapping operations.

Key endpoints:
- `applyCredentialToApplication`: Maps credential fields to application fields
- `getMappingHistory`: Gets mapping history for an application
- `getFieldMappingSuggestions`: Gets mapping suggestions for a credential type
- `normalizeFieldValue`: Normalizes a field value based on target type

#### fieldMappingService.js

This service provides utilities for field normalization and mapping.

Key functions:
- `normalizeFieldValue(value, targetType, options)`: Normalizes a value to a target type
- `applyCommonMappings(formData, credentialData)`: Applies common field mappings
- `flattenObject(obj, prefix)`: Flattens a nested object structure
- `setNestedValue(obj, path, value)`: Sets a value in a nested object using a path
- `extractFields(obj, paths)`: Extracts specific fields from an object

## API Reference

### Apply Credential Mappings

```
POST /api/mapping/applications/:applicationId/apply-credential
```

Request body:
```json
{
  "credentialId": "credential-123",
  "mappings": [
    {
      "formField": "personalInfo.firstName",
      "credentialField": "credentialSubject.firstName",
      "value": "John",
      "source": "IdentityCredential.credentialSubject.firstName"
    }
  ]
}
```

Response:
```json
{
  "message": "Credential mappings applied successfully",
  "updatedFields": 1
}
```

### Get Mapping History

```
GET /api/mapping/applications/:applicationId/mapping-history
```

Response:
```json
[
  {
    "credential": {
      "id": "credential-123",
      "type": "IdentityCredential",
      "issuer": "did:web:identity-provider.example"
    },
    "mappings": [
      {
        "formField": "personalInfo.firstName",
        "credentialField": "credentialSubject.firstName",
        "source": "IdentityCredential.credentialSubject.firstName"
      }
    ],
    "appliedAt": "2025-07-20T14:35:00Z"
  }
]
```

### Get Field Mapping Suggestions

```
GET /api/mapping/mapping-suggestions/:credentialType
```

Response:
```json
[
  {
    "formField": "personalInfo.firstName",
    "credentialField": "credentialSubject.firstName",
    "frequency": 42
  }
]
```

### Normalize Field Value

```
POST /api/mapping/normalize-field
```

Request body:
```json
{
  "value": "2023-05-15T00:00:00.000Z",
  "targetType": "date",
  "format": "yyyy-mm-dd"
}
```

Response:
```json
{
  "original": "2023-05-15T00:00:00.000Z",
  "normalized": "2023-05-15",
  "targetType": "date",
  "format": "yyyy-mm-dd"
}
```

## Database Schema

### PDSCredentialMapping

This collection stores the history of credential mappings applied to applications.

```javascript
{
  application: ObjectId, // Reference to application
  user: ObjectId, // Reference to user
  credential: {
    id: String, // Credential ID
    type: String, // Credential type
    issuer: String // Credential issuer
  },
  mappings: [{
    formField: String, // Path to form field
    credentialField: String, // Path to credential field
    source: String // Source information
  }],
  appliedAt: Date // When mapping was applied
}
```

## Best Practices

### Field Mapping

1. **Path Notation**: Use dot notation for field paths (e.g., `personalInfo.firstName`)
2. **Flattening Objects**: Flatten nested objects before mapping
3. **Type Conversion**: Always normalize values to the appropriate type
4. **Error Handling**: Implement robust error handling for mapping failures

### Security

1. **Validation**: Always validate user input before applying mappings
2. **Authentication**: Ensure all API endpoints require authentication
3. **Authorization**: Verify that users can only map to their own applications
4. **Data Minimization**: Only store necessary mapping information, not actual values

## Testing

### Unit Testing

Test the field mapping service with various input types:
- String normalization (uppercase, lowercase, capitalize)
- Date normalization (various formats)
- Number normalization (currency, precision)
- Boolean normalization (true/false, yes/no, 1/0)

### Integration Testing

Test the API endpoints with different scenarios:
- Valid credential mappings
- Invalid credential mappings
- Missing fields
- Malformed requests

### End-to-End Testing

Use the `test-credential-mapping.sh` script to test the entire workflow:
- Creating an application
- Creating a credential
- Applying mappings
- Verifying the result

## Troubleshooting

### Common Issues

1. **Field Not Mapped**: Check that the field paths are correct and the credential contains the expected field
2. **Type Conversion Error**: Ensure that the source value can be converted to the target type
3. **Missing Credential**: Verify that the credential exists in the PDS and is accessible

### Debugging

1. Enable debug logging in the fieldMappingService:
```javascript
logger.debug(`Normalizing field value: ${value} to type: ${targetType}`);
```

2. Use the `normalizeFieldValue` API endpoint to test individual field normalization

## Extending the Functionality

### Adding New Field Types

To add support for a new field type:
1. Update the `normalizeFieldValue` function in fieldMappingService.js
2. Add the new type to the frontend UI in PDSCredentialFieldMapping.js
3. Update the documentation

### Adding New Mapping Strategies

To add a new mapping strategy:
1. Create a new function in fieldMappingService.js
2. Integrate the function into the mapping workflow
3. Update the frontend UI to support the new strategy

## Additional Resources

- [PDS Integration Documentation](./PDS-Integration-Implementation.md)
- [PDS Credential Field Mapping Documentation](./PDS-Credential-Field-Mapping.md)
- [Field Mapping Requirements](../Requirements/PDS-Integration.md)
