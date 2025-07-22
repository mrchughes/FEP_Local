# PDS Credential Field Mapping

## Overview

This document describes the implementation of the credential field mapping functionality in the FEP application. This feature allows users to automatically populate form fields using verifiable credentials stored in their Personal Data Store (PDS).

## Components

The credential field mapping implementation consists of the following components:

1. **Frontend Components**
   - `PDSCredentialFieldMapping.js` - UI component for selecting and mapping credentials to form fields
   - `PDSConnectionStatus.js` - UI component for displaying and managing PDS connection status
   - Enhanced `ApplicationForm.js` - Updated form UI that integrates credential mapping

2. **Backend Components**
   - `credentialMappingController.js` - Controller for handling credential mapping operations
   - `credentialMappingRoutes.js` - API routes for credential mapping operations
   - `PDSCredentialMapping.js` - MongoDB model for storing credential mapping history
   - `fieldMappingService.js` - Service for field normalization and common mapping operations

3. **Enhancements to Existing Components**
   - Extended `pdsCredentialService.js` with methods for retrieving specific credentials
   - Updated `app.js` to include the new credential mapping routes

## Features

### 1. Credential Field Mapping

Users can select verifiable credentials from their PDS and map fields from these credentials to form fields in the application. The system:

- Displays available credentials from the user's PDS
- Provides an intuitive UI for mapping credential fields to form fields
- Offers smart suggestions for field mapping based on field names
- Highlights fields that have been populated from credentials
- Maintains mapping history for auditing and future reference

### 2. Field Normalization

The system can normalize field values between different formats:

- Date format normalization (ISO, yyyy-mm-dd, mm/dd/yyyy, etc.)
- String format normalization (uppercase, lowercase, capitalization)
- Number format normalization (removing currency symbols, commas, etc.)
- Boolean value normalization (converting text representations to boolean values)

### 3. Common Field Mappings

The system includes predefined mappings for common fields:

- Personal information (name, email, phone, etc.)
- Address information (street, city, state, zip code, etc.)
- Identification information (date of birth, ID numbers, etc.)

### 4. Mapping History and Analytics

The system maintains a history of field mappings, which enables:

- Auditing of which credentials were used for which applications
- Smart suggestions based on commonly used mappings
- Analytics on credential usage patterns

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/mapping/applications/:applicationId/apply-credential` | POST | Apply credential field mappings to an application |
| `/api/mapping/applications/:applicationId/mapping-history` | GET | Get mapping history for an application |
| `/api/mapping/mapping-suggestions/:credentialType` | GET | Get field mapping suggestions for a credential type |
| `/api/mapping/normalize-field` | POST | Normalize a field value based on target type |

## Data Flow

1. User connects to their PDS via the SOLID OIDC authentication flow
2. Application retrieves available credentials from the user's PDS
3. User selects a credential to use for form field mapping
4. System suggests mappings between credential fields and form fields
5. User adjusts mappings as needed
6. System applies the mappings, normalizing field values as appropriate
7. Field mapping history is stored for future reference
8. Form is updated with values from the credential

## Security Considerations

- All credential data is fetched directly from the user's PDS using their access token
- Mapping history stored in the application database only includes field paths, not actual values
- Field mappings are only applied with explicit user consent
- All API endpoints are protected with authentication

## Testing

The credential field mapping functionality can be tested using the `test-credential-mapping.sh` script, which:

1. Creates a test application
2. Creates a sample verifiable credential
3. Tests field normalization
4. Applies credential mapping to the application
5. Verifies that the application data has been updated correctly
6. Tests mapping history and suggestion endpoints

## Future Enhancements

1. **Machine Learning-Based Mapping Suggestions**
   - Use machine learning to improve mapping suggestions based on past user choices

2. **Advanced Credential Validation**
   - Validate credential data against form field requirements (e.g., format, length, etc.)

3. **Multi-Credential Mapping**
   - Allow mapping fields from multiple credentials to a single form

5. **Credential-Based Form Generation**
   - Dynamically generate form sections based on available credentials

## Implementation Details

### Field Mapping Service

The `fieldMappingService.js` handles the core logic for field normalization and mapping:

```javascript
// Key functions in fieldMappingService.js
const normalizeFieldValue = (value, targetType, options = {}) => {
  // Normalize values based on target type (string, number, date, boolean)
  // Apply formatting based on options
};

const applyCommonMappings = (formData, credentialData) => {
  // Apply common field mappings between credential and form fields
  // Use predefined mapping rules for common fields
};

const flattenObject = (obj, prefix = '') => {
  // Flatten nested object structure for easier mapping
};

const setNestedValue = (obj, path, value) => {
  // Set a value in a nested object structure using path notation
};

const extractFields = (obj, paths) => {
  // Extract specific fields from a nested object structure
};
```

### Credential Mapping Controller

The `credentialMappingController.js` provides API endpoints for credential mapping operations:

```javascript
// Key functions in credentialMappingController.js
exports.applyCredentialToApplication = async (req, res) => {
  // Apply credential field mappings to an application
  // Store mapping history for future reference
};

exports.getMappingHistory = async (req, res) => {
  // Get mapping history for an application
};

exports.getFieldMappingSuggestions = async (req, res) => {
  // Get field mapping suggestions for a credential type
  // Based on common mappings and previous user choices
};

exports.normalizeFieldValue = async (req, res) => {
  // Normalize a field value based on target type and format
};
```

### MongoDB Model

The `PDSCredentialMapping.js` model stores credential mapping history:

```javascript
// PDSCredentialMapping schema
const PDSCredentialMappingSchema = new mongoose.Schema({
  // Reference to the application
  application: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: true
  },
  
  // Reference to the user
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Credential information
  credential: {
    id: String,
    type: String,
    issuer: String
  },
  
  // Array of field mappings
  mappings: [{
    formField: String,
    credentialField: String,
    source: String
  }],
  
  // When the mapping was applied
  appliedAt: Date
});
```

## Deployment and Testing

The credential field mapping functionality is automatically deployed as part of the FEP application. 

To test the functionality:

1. Run the startup script: `./scripts/startup.sh`
2. Run the test script: `./scripts/test-credential-mapping.sh`

The test script will:
- Create a test application
- Create a sample credential
- Test field normalization
- Apply credential mappings
- Verify the application data
- Test mapping history and suggestions

## Conclusion

The PDS Credential Field Mapping functionality provides a seamless way for users to populate application forms using verifiable credentials from their Personal Data Store. This integration enhances the user experience by reducing manual data entry and leveraging the security and privacy benefits of the PDS ecosystem.
