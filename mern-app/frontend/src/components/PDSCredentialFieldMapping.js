// frontend/src/components/PDSCredentialFieldMapping.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Box,
    Card,
    CardContent,
    Typography,
    List,
    ListItem,
    ListItemText,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    CircularProgress,
    Alert,
    Grid,
    Divider,
    Chip,
    FormControl,
    InputLabel,
    Select,
    MenuItem
} from '@mui/material';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

/**
 * Component for mapping fields from verifiable credentials to form fields
 */
const PDSCredentialFieldMapping = ({ applicationId, formData, onFieldsUpdated }) => {
    const [credentials, setCredentials] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedCredential, setSelectedCredential] = useState(null);
    const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
    const [fieldMappings, setFieldMappings] = useState({});
    const [formFields, setFormFields] = useState([]);
    const [credentialFields, setCredentialFields] = useState([]);
    const [successMessage, setSuccessMessage] = useState(null);

    // Fetch credentials when component mounts
    useEffect(() => {
        fetchCredentials();
        extractFormFields(formData);
    }, [formData]);

    // Extract form fields from form data for mapping
    const extractFormFields = (data) => {
        const fields = [];

        const processObject = (obj, prefix = '') => {
            if (!obj || typeof obj !== 'object') return;

            Object.keys(obj).forEach(key => {
                const fullPath = prefix ? `${prefix}.${key}` : key;

                if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                    // Recursively process nested objects
                    processObject(obj[key], fullPath);
                } else {
                    // Add leaf field to list
                    fields.push({
                        id: fullPath,
                        label: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
                        path: fullPath,
                        currentValue: obj[key]
                    });
                }
            });
        };

        processObject(data);
        setFormFields(fields);
    };

    // Fetch available credentials from PDS
    const fetchCredentials = async () => {
        setLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('/api/credentials', {
                headers: { Authorization: `Bearer ${token}` }
            });

            setCredentials(response.data);
        } catch (err) {
            console.error('Error fetching credentials:', err);
            setError('Failed to fetch credentials from your PDS');
        } finally {
            setLoading(false);
        }
    };

    // Extract fields from credential for mapping
    const extractCredentialFields = (credential) => {
        const fields = [];

        const processObject = (obj, prefix = '') => {
            if (!obj || typeof obj !== 'object') return;

            Object.keys(obj).forEach(key => {
                // Skip internal fields and metadata
                if (['@context', 'type', 'proof', 'id', 'issuer', 'issuanceDate'].includes(key)) {
                    return;
                }

                const fullPath = prefix ? `${prefix}.${key}` : key;

                if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                    // Recursively process nested objects
                    processObject(obj[key], fullPath);
                } else {
                    // Add leaf field to list
                    fields.push({
                        id: fullPath,
                        label: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
                        path: fullPath,
                        value: obj[key]
                    });
                }
            });
        };

        // Process credential subject which contains the actual data
        if (credential.credential?.credentialSubject) {
            processObject(credential.credential.credentialSubject, 'credentialSubject');
        }

        setCredentialFields(fields);
    };

    // Open the mapping dialog for a selected credential
    const handleOpenMappingDialog = (credential) => {
        setSelectedCredential(credential);
        extractCredentialFields(credential);
        setMappingDialogOpen(true);

        // Initialize mappings based on field names
        const initialMappings = {};
        formFields.forEach(formField => {
            // Look for credential fields with similar names
            const matchingCredField = credentialFields.find(credField =>
                credField.label.toLowerCase().includes(formField.label.toLowerCase()) ||
                formField.label.toLowerCase().includes(credField.label.toLowerCase())
            );

            if (matchingCredField) {
                initialMappings[formField.path] = matchingCredField.path;
            }
        });

        setFieldMappings(initialMappings);
    };

    // Apply field mappings to form data
    const applyMappings = async () => {
        setLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');

            // Create array of field mappings
            const mappings = Object.entries(fieldMappings).map(([formField, credField]) => {
                // Find the credential field to get its value
                const credFieldObj = credentialFields.find(f => f.path === credField);

                return {
                    formField,
                    credentialField: credField,
                    value: credFieldObj?.value,
                    source: `${selectedCredential.type}.${credField}`
                };
            }).filter(mapping => mapping.value !== undefined);

            // Send mappings to backend to update application
            await axios.post(`/api/applications/${applicationId}/apply-credential`, {
                credentialId: selectedCredential.id,
                mappings
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setMappingDialogOpen(false);
            setSuccessMessage('Fields have been successfully mapped from credential');

            // Notify parent component about the update
            if (onFieldsUpdated) {
                onFieldsUpdated(mappings);
            }

            // Clear success message after 3 seconds
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            console.error('Error applying mappings:', err);
            setError('Failed to apply credential mappings to form');
        } finally {
            setLoading(false);
        }
    };

    if (loading && credentials.length === 0) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
                Use Verifiable Credentials
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {successMessage && (
                <Alert severity="success" sx={{ mb: 2 }}>
                    {successMessage}
                </Alert>
            )}

            {credentials.length === 0 ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                    <InfoOutlinedIcon sx={{ mr: 1 }} />
                    No verifiable credentials found in your PDS. Connect your PDS and import credentials first.
                </Alert>
            ) : (
                <Grid container spacing={2}>
                    {credentials.map((credential) => (
                        <Grid item xs={12} md={6} key={credential.id}>
                            <Card variant="outlined" sx={{ mb: 2 }}>
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                        <Typography variant="h6" component="div">
                                            {credential.type}
                                        </Typography>
                                        {credential.verified ? (
                                            <Chip
                                                icon={<VerifiedUserIcon />}
                                                label="Verified"
                                                color="success"
                                                size="small"
                                            />
                                        ) : (
                                            <Chip
                                                icon={<ErrorOutlineIcon />}
                                                label="Unverified"
                                                color="warning"
                                                size="small"
                                            />
                                        )}
                                    </Box>

                                    <Typography color="text.secondary" gutterBottom>
                                        Issued by: {credential.issuer}
                                    </Typography>

                                    <Typography variant="body2" color="text.secondary">
                                        Issued: {new Date(credential.issuanceDate).toLocaleDateString()}
                                        {credential.expirationDate &&
                                            ` • Expires: ${new Date(credential.expirationDate).toLocaleDateString()}`
                                        }
                                    </Typography>

                                    <Divider sx={{ my: 1.5 }} />

                                    <Button
                                        variant="contained"
                                        color="primary"
                                        fullWidth
                                        onClick={() => handleOpenMappingDialog(credential)}
                                    >
                                        Map Fields from This Credential
                                    </Button>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* Mapping Dialog */}
            <Dialog
                open={mappingDialogOpen}
                onClose={() => setMappingDialogOpen(false)}
                fullWidth
                maxWidth="md"
            >
                <DialogTitle>
                    Map Fields from {selectedCredential?.type}
                </DialogTitle>

                <DialogContent>
                    {formFields.length > 0 ? (
                        <Grid container spacing={3}>
                            {formFields.map((formField) => (
                                <Grid item xs={12} key={formField.id}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                        <Typography variant="subtitle2" sx={{ minWidth: 200 }}>
                                            {formField.label}:
                                        </Typography>

                                        <FormControl fullWidth>
                                            <InputLabel>Credential Field</InputLabel>
                                            <Select
                                                value={fieldMappings[formField.path] || ''}
                                                onChange={(e) => setFieldMappings({
                                                    ...fieldMappings,
                                                    [formField.path]: e.target.value
                                                })}
                                                label="Credential Field"
                                            >
                                                <MenuItem value="">
                                                    <em>None</em>
                                                </MenuItem>
                                                {credentialFields.map((credField) => (
                                                    <MenuItem value={credField.path} key={credField.id}>
                                                        {credField.label} ({credField.value})
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Box>
                                </Grid>
                            ))}
                        </Grid>
                    ) : (
                        <Alert severity="info">
                            No form fields available for mapping
                        </Alert>
                    )}
                </DialogContent>

                <DialogActions>
                    <Button onClick={() => setMappingDialogOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={applyMappings}
                        variant="contained"
                        color="primary"
                        disabled={loading}
                    >
                        {loading ? <CircularProgress size={24} /> : 'Apply Mappings'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default PDSCredentialFieldMapping;
