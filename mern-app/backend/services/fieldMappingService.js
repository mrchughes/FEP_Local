// backend/services/fieldMappingService.js
const logger = require('../utils/logger');

/**
 * Service for handling credential field normalization and mapping
 */

/**
 * Normalize a field value based on the target field type
 * @param {any} value - The original value from the credential
 * @param {string} targetType - The type to convert to ('string', 'number', 'date', 'boolean')
 * @param {Object} options - Additional options for normalization
 * @returns {any} - The normalized value
 */
const normalizeFieldValue = (value, targetType, options = {}) => {
    if (value === undefined || value === null) {
        return value;
    }

    try {
        switch (targetType) {
            case 'string':
                value = String(value);

                // Apply string formatting if requested
                if (options.format === 'uppercase') {
                    value = value.toUpperCase();
                } else if (options.format === 'lowercase') {
                    value = value.toLowerCase();
                } else if (options.format === 'capitalize') {
                    value = value.split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                        .join(' ');
                }

                break;

            case 'number':
                // Handle string representations of numbers with commas or currency symbols
                if (typeof value === 'string') {
                    // Remove currency symbols, commas, etc.
                    const cleaned = value.replace(/[$£€,]/g, '');
                    value = parseFloat(cleaned);

                    if (isNaN(value)) {
                        // If parsing failed, return original value
                        return value;
                    }

                    // Apply precision if specified
                    if (options.precision !== undefined) {
                        value = parseFloat(value.toFixed(options.precision));
                    }
                }
                break;

            case 'date':
                // Convert to Date object first
                const date = new Date(value);

                if (isNaN(date.getTime())) {
                    // If invalid date, return original value
                    return value;
                }

                // Format based on requested output format
                if (options.format === 'iso') {
                    value = date.toISOString();
                } else if (options.format === 'yyyy-mm-dd') {
                    value = date.toISOString().split('T')[0];
                } else if (options.format === 'mm/dd/yyyy') {
                    value = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
                } else if (options.format === 'dd/mm/yyyy') {
                    value = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
                } else {
                    // Default to ISO
                    value = date.toISOString();
                }
                break;

            case 'boolean':
                if (typeof value === 'string') {
                    const lowerValue = value.toLowerCase();
                    if (['true', 'yes', '1', 'y', 'on'].includes(lowerValue)) {
                        value = true;
                    } else if (['false', 'no', '0', 'n', 'off'].includes(lowerValue)) {
                        value = false;
                    }
                } else if (typeof value === 'number') {
                    value = value !== 0;
                }
                break;
        }

        return value;
    } catch (error) {
        logger.error(`Error normalizing field value '${value}' to ${targetType}:`, error);
        return value; // Return original value on error
    }
};

/**
 * Apply common name mappings between credential and form fields
 * @param {Object} formData - The form data object to map to
 * @param {Object} credentialData - The credential data to map from
 * @returns {Object} - The mapped form data
 */
const applyCommonMappings = (formData, credentialData) => {
    // Don't modify original object
    const mappedData = { ...formData };

    // Common mappings - extend this list based on your application needs
    const commonMappings = [
        { credField: 'name', formField: 'name' },
        { credField: 'fullName', formField: 'name' },
        { credField: 'firstName', formField: 'firstName' },
        { credField: 'lastName', formField: 'lastName' },
        { credField: 'email', formField: 'email' },
        { credField: 'emailAddress', formField: 'email' },
        { credField: 'phone', formField: 'phoneNumber' },
        { credField: 'phoneNumber', formField: 'phoneNumber' },
        { credField: 'address', formField: 'address' },
        { credField: 'streetAddress', formField: 'address' },
        { credField: 'city', formField: 'city' },
        { credField: 'state', formField: 'state' },
        { credField: 'postalCode', formField: 'zipCode' },
        { credField: 'zipCode', formField: 'zipCode' },
        { credField: 'country', formField: 'country' },
        { credField: 'dateOfBirth', formField: 'dateOfBirth' },
        { credField: 'birthDate', formField: 'dateOfBirth' }
    ];

    // Flatten credential data for easier mapping
    const flatCredentialData = flattenObject(credentialData);

    // Apply mappings
    for (const mapping of commonMappings) {
        const credValue = flatCredentialData[mapping.credField];

        if (credValue !== undefined) {
            setNestedValue(mappedData, mapping.formField, credValue);
        }
    }

    return mappedData;
};

/**
 * Flatten a nested object structure
 * @param {Object} obj - The object to flatten
 * @param {string} prefix - Current key prefix
 * @returns {Object} - Flattened object
 */
const flattenObject = (obj, prefix = '') => {
    const flattened = {};

    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            const newKey = prefix ? `${prefix}.${key}` : key;

            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                // Recursively flatten nested objects
                Object.assign(flattened, flattenObject(value, newKey));
            } else {
                flattened[newKey] = value;
            }
        }
    }

    return flattened;
};

/**
 * Set a value in a nested object structure
 * @param {Object} obj - The object to modify
 * @param {string} path - The path to set (e.g., "personal.name")
 * @param {any} value - The value to set
 */
const setNestedValue = (obj, path, value) => {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];

        if (!current[key] || typeof current[key] !== 'object') {
            current[key] = {};
        }

        current = current[key];
    }

    current[keys[keys.length - 1]] = value;
};

/**
 * Extract specific fields from a nested object structure
 * @param {Object} obj - The object to extract from
 * @param {Array<string>} paths - Array of paths to extract
 * @returns {Object} - Object with extracted values
 */
const extractFields = (obj, paths) => {
    const result = {};
    const flat = flattenObject(obj);

    for (const path of paths) {
        if (flat[path] !== undefined) {
            setNestedValue(result, path, flat[path]);
        }
    }

    return result;
};

module.exports = {
    normalizeFieldValue,
    applyCommonMappings,
    flattenObject,
    setNestedValue,
    extractFields
};
