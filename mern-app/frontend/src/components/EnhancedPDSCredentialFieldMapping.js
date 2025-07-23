// frontend/src/components/EnhancedPDSCredentialFieldMapping.js
import React, { useState, useEffect } from 'react';
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
    MenuItem,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    FormGroup,
    FormControlLabel,
    Checkbox,
    Tooltip
} from '@mui/material';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FilterListIcon from '@mui/icons-material/FilterList';
import CloudIcon from '@mui/icons-material/Cloud';
import { getCredentials } from '../services/credentialService';

// List of available audiences
const AVAILABLE_AUDIENCES = [
    { id: 'fep.gov.uk', name: 'Funeral Expenses Payment Service' },
    { id: 'hmrc.gov.uk', name: 'HMRC Tax Service' },
    { id: 'dwp.gov.uk', name: 'DWP Benefits Service' },
    { id: 'local-auth.gov.uk', name: 'Local Authority Services' }
];

/**
 * Enhanced component for mapping fields from verifiable credentials to form fields
 * Supports multiple audience selection for credential retrieval
 */
const EnhancedPDSCredentialFieldMapping = ({ applicationId, formData, onFieldsUpdated }) => {
    const [credentials, setCredentials] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedCredential, setSelectedCredential] = useState(null);
    const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
    const [fieldMappings, setFieldMappings] = useState({});
    const [formFields, setFormFields] = useState([]);
    const [credentialFields, setCredentialFields] = useState([]);
    const [successMessage, setSuccessMessage] = useState(null);

    // Audience selection state
    const [selectedAudiences, setSelectedAudiences] = useState([]);
    const [useMultipleAudiences, setUseMultipleAudiences] = useState(false);
    const [filterExpanded, setFilterExpanded] = useState(false);

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

    // Handle audience selection
    const handleAudienceToggle = (audienceId) => {
        setSelectedAudiences(prev => {
            if (prev.includes(audienceId)) {
                return prev.filter(id => id !== audienceId);
            } else {
                return [...prev, audienceId];
            }
        });
    };

    // Clear audience selection
    const clearAudienceSelection = () => {
        setSelectedAudiences([]);
        setUseMultipleAudiences(false);
    };

    // Get audience display name
    const getAudienceName = (audienceId) => {
        const audience = AVAILABLE_AUDIENCES.find(a => a.id === audienceId);
        return audience ? audience.name : audienceId;
    };

    // Fetch available credentials from PDS with audience support
    const fetchCredentials = async () => {
        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            let options = {};

            // Handle audience selection
            if (selectedAudiences.length > 0) {
                if (useMultipleAudiences) {
                    // Use multiple audiences
                    options.audience = selectedAudiences;
                    setSuccessMessage(`Retrieving credentials from ${selectedAudiences.length} services`);
                } else {
                    // Use only the first selected audience
                    options.audience = selectedAudiences[0];
                    setSuccessMessage(`Retrieving credentials from ${getAudienceName(selectedAudiences[0])}`);
                }
            }

            // Fetch credentials using our credential service
            const results = await getCredentials(options);
            setCredentials(results || []);
        } catch (err) {
            console.error('Error fetching credentials:', err);
            setError('Failed to fetch credentials from your PDS: ' + (err.message || ''));
        } finally {
            setLoading(false);
        }
    };

    // Extract fields from credential for mapping
    const extractCredentialFields = (credential) => {
        const fields = [];

        if (!credential || !credential.credentialSubject) {
            return fields;
        }

        const processObject = (obj, prefix = '') => {
            if (!obj || typeof obj !== 'object') return;

            Object.keys(obj).forEach(key => {
                // Skip the 'id' field as it's not typically useful for mapping
                if (key === 'id') return;

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

        processObject(credential.credentialSubject);
        return fields;
    };

    // Open mapping dialog for a credential
    const openMappingDialog = (credential) => {
        setSelectedCredential(credential);
        const fields = extractCredentialFields(credential);
        setCredentialFields(fields);
        setMappingDialogOpen(true);
    };

    // Handle field mapping selection
    const handleFieldMappingChange = (formFieldId, credentialFieldPath) => {
        setFieldMappings(prev => ({
            ...prev,
            [formFieldId]: credentialFieldPath
        }));
    };

    // Apply field mappings to form data
    const applyMappings = () => {
        const updatedFormData = { ...formData };

        Object.entries(fieldMappings).forEach(([formField, credentialField]) => {
            if (!credentialField) return;

            // Get value from selected credential
            let credentialValue = selectedCredential;
            credentialField.split('.').forEach(part => {
                if (credentialValue) {
                    credentialValue = credentialValue[part];
                }
            });

            // Set value in form data
            setNestedValue(updatedFormData, formField, credentialValue);
        });

        // Call the callback with updated form data
        if (onFieldsUpdated) {
            onFieldsUpdated(updatedFormData);
        }

        setMappingDialogOpen(false);
        setSuccessMessage('Form fields updated from credential data');
    };

    // Set a nested value in an object based on a dot-notation path
    const setNestedValue = (obj, path, value) => {
        const parts = path.split('.');
        let current = obj;

        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) {
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }

        current[parts[parts.length - 1]] = value;
    };

    // Render audience badge if credential has source audience info
    const renderAudienceBadge = (credential) => {
        if (credential._sourceAudience) {
            return (
                <Tooltip title={`From: ${getAudienceName(credential._sourceAudience)}`}>
                    <Chip
                        icon={<CloudIcon fontSize="small" />}
                        label={credential._sourceAudience}
                        size="small"
                        color="secondary"
                        variant="outlined"
                        sx={{ ml: 1 }}
                    />
                </Tooltip>
            );
        }
        return null;
    };

    // Get credential title
    const getCredentialTitle = (credential) => {
        if (!credential) return 'Unknown Credential';

        if (credential.type && credential.type.includes('FormDataCredential')) {
            return 'Funeral Expense Form Data';
        }

        if (Array.isArray(credential.type)) {
            return credential.type[credential.type.length - 1];
        }

        return credential.type || 'Unknown Credential';
    };

    // Format date for display
    const formatDate = (dateString) => {
        try {
            return new Date(dateString).toLocaleString();
        } catch (e) {
            return dateString || 'Unknown Date';
        }
    };

    return (
        <Box sx={{ mt: 3 }}>
            <Card variant="outlined">
                <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                        <VerifiedUserIcon sx={{ mr: 1 }} />
                        Import Data from Verifiable Credentials
                    </Typography>

                    {error && (
                        <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    {successMessage && (
                        <Alert severity="success" sx={{ mt: 2, mb: 2 }}>
                            {successMessage}
                        </Alert>
                    )}

                    {/* Audience Selection UI */}
                    <Accordion
                        expanded={filterExpanded}
                        onChange={() => setFilterExpanded(!filterExpanded)}
                        sx={{ mb: 2 }}
                    >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <FilterListIcon sx={{ mr: 1 }} />
                                <Typography>Credential Source Filter</Typography>
                                {selectedAudiences.length > 0 && (
                                    <Chip
                                        label={`${selectedAudiences.length} selected`}
                                        size="small"
                                        color="primary"
                                        sx={{ ml: 2 }}
                                    />
                                )}
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Typography variant="body2" color="text.secondary" paragraph>
                                Select which service(s) to retrieve credentials from:
                            </Typography>

                            <FormGroup>
                                {AVAILABLE_AUDIENCES.map((audience) => (
                                    <FormControlLabel
                                        key={audience.id}
                                        control={
                                            <Checkbox
                                                checked={selectedAudiences.includes(audience.id)}
                                                onChange={() => handleAudienceToggle(audience.id)}
                                            />
                                        }
                                        label={audience.name}
                                    />
                                ))}
                            </FormGroup>

                            <Box sx={{ mt: 2 }}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={useMultipleAudiences}
                                            onChange={() => setUseMultipleAudiences(!useMultipleAudiences)}
                                            disabled={selectedAudiences.length <= 1}
                                        />
                                    }
                                    label="Retrieve from multiple services at once"
                                />
                            </Box>

                            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                                <Button
                                    variant="outlined"
                                    onClick={clearAudienceSelection}
                                    sx={{ mr: 1 }}
                                >
                                    Clear
                                </Button>
                                <Button
                                    variant="contained"
                                    onClick={() => {
                                        setFilterExpanded(false);
                                        fetchCredentials();
                                    }}
                                >
                                    Apply Filter
                                </Button>
                            </Box>
                        </AccordionDetails>
                    </Accordion>

                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : credentials.length === 0 ? (
                        <Alert
                            severity="info"
                            icon={<InfoOutlinedIcon />}
                            sx={{ mt: 2 }}
                        >
                            No credentials found in your Personal Data Store.
                            {selectedAudiences.length > 0 ? ' Try selecting different credential sources.' : ''}
                        </Alert>
                    ) : (
                        <>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Select a credential to import data from:
                            </Typography>

                            <List sx={{ bgcolor: 'background.paper', borderRadius: 1 }}>
                                {credentials.map((credential, index) => (
                                    <React.Fragment key={credential.id || index}>
                                        {index > 0 && <Divider component="li" />}
                                        <ListItem
                                            alignItems="flex-start"
                                            secondaryAction={
                                                <Button
                                                    variant="contained"
                                                    size="small"
                                                    onClick={() => openMappingDialog(credential)}
                                                >
                                                    Use
                                                </Button>
                                            }
                                        >
                                            <ListItemText
                                                primary={
                                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                        {getCredentialTitle(credential)}
                                                        {renderAudienceBadge(credential)}
                                                    </Box>
                                                }
                                                secondary={
                                                    <>
                                                        <Typography
                                                            sx={{ display: 'block' }}
                                                            component="span"
                                                            variant="body2"
                                                            color="text.primary"
                                                        >
                                                            Issuer: {credential.issuer}
                                                        </Typography>
                                                        Issued: {formatDate(credential.issuanceDate)}
                                                    </>
                                                }
                                            />
                                        </ListItem>
                                    </React.Fragment>
                                ))}
                            </List>
                        </>
                    )}

                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                            variant="outlined"
                            onClick={fetchCredentials}
                            disabled={loading}
                            startIcon={loading ? <CircularProgress size={20} /> : null}
                        >
                            Refresh Credentials
                        </Button>
                    </Box>

                    {/* Field Mapping Dialog */}
                    <Dialog
                        open={mappingDialogOpen}
                        onClose={() => setMappingDialogOpen(false)}
                        fullWidth
                        maxWidth="md"
                    >
                        <DialogTitle>
                            Map Credential Fields to Form Fields
                        </DialogTitle>
                        <DialogContent dividers>
                            {selectedCredential && (
                                <>
                                    <Typography variant="subtitle1" gutterBottom>
                                        Credential: {getCredentialTitle(selectedCredential)}
                                        {selectedCredential._sourceAudience && (
                                            <Chip
                                                label={getAudienceName(selectedCredential._sourceAudience)}
                                                size="small"
                                                color="secondary"
                                                sx={{ ml: 1 }}
                                            />
                                        )}
                                    </Typography>

                                    <Alert severity="info" sx={{ mb: 3 }}>
                                        Select which credential fields to use for each form field
                                    </Alert>

                                    <Grid container spacing={2}>
                                        {formFields.map((formField) => (
                                            <Grid item xs={12} key={formField.id}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                                    <Typography variant="body1" sx={{ flex: 1 }}>
                                                        {formField.label}:
                                                    </Typography>
                                                    <FormControl sx={{ minWidth: 300 }}>
                                                        <InputLabel id={`mapping-label-${formField.id}`}>
                                                            Credential Field
                                                        </InputLabel>
                                                        <Select
                                                            labelId={`mapping-label-${formField.id}`}
                                                            value={fieldMappings[formField.id] || ''}
                                                            onChange={(e) => handleFieldMappingChange(formField.id, e.target.value)}
                                                            label="Credential Field"
                                                        >
                                                            <MenuItem value="">
                                                                <em>None</em>
                                                            </MenuItem>
                                                            {credentialFields.map((credField) => (
                                                                <MenuItem
                                                                    key={credField.id}
                                                                    value={credField.path}
                                                                >
                                                                    {credField.label} ({credField.value})
                                                                </MenuItem>
                                                            ))}
                                                        </Select>
                                                    </FormControl>
                                                </Box>
                                                <Divider sx={{ my: 1 }} />
                                            </Grid>
                                        ))}
                                    </Grid>
                                </>
                            )}
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setMappingDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                variant="contained"
                                onClick={applyMappings}
                                color="primary"
                            >
                                Apply Mappings
                            </Button>
                        </DialogActions>
                    </Dialog>
                </CardContent>
            </Card>
        </Box>
    );
};

export default EnhancedPDSCredentialFieldMapping;
