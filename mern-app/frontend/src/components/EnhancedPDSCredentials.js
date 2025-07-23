// frontend/src/components/EnhancedPDSCredentials.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Box,
    Button,
    Typography,
    Paper,
    CircularProgress,
    Alert,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Chip,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormGroup,
    FormControlLabel,
    Checkbox,
    Divider,
    Tooltip
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import VerifiedIcon from '@mui/icons-material/Verified';
import FilterListIcon from '@mui/icons-material/FilterList';
import CloudIcon from '@mui/icons-material/Cloud';
import JSONPretty from 'react-json-pretty';
import 'react-json-pretty/themes/monikai.css';
import { getCredentials } from '../services/credentialService';

// List of available audiences
const AVAILABLE_AUDIENCES = [
    { id: 'fep.gov.uk', name: 'Funeral Expenses Payment Service' },
    { id: 'hmrc.gov.uk', name: 'HMRC Tax Service' },
    { id: 'dwp.gov.uk', name: 'DWP Benefits Service' },
    { id: 'local-auth.gov.uk', name: 'Local Authority Services' }
];

const EnhancedPDSCredentials = () => {
    const [loading, setLoading] = useState(true);
    const [credentials, setCredentials] = useState([]);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    // Audience selection state
    const [selectedAudiences, setSelectedAudiences] = useState([]);
    const [useMultipleAudiences, setUseMultipleAudiences] = useState(false);
    const [filterExpanded, setFilterExpanded] = useState(false);

    // Fetch credentials on component mount with default audience
    useEffect(() => {
        fetchCredentials();
    }, []);

    // Fetch credentials based on selected audiences
    const fetchCredentials = async () => {
        setLoading(true);
        setError(null);

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
                    setSuccessMessage(`Retrieving credentials from ${AVAILABLE_AUDIENCES.find(a => a.id === selectedAudiences[0])?.name || selectedAudiences[0]}`);
                }
            } else {
                setSuccessMessage(null);
            }

            // Fetch credentials using our credential service
            const results = await getCredentials(options);
            setCredentials(results || []);
        } catch (err) {
            console.error('Error fetching credentials:', err);
            setError('Failed to fetch credentials from PDS: ' + (err.message || ''));
        } finally {
            setLoading(false);
        }
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

    const formatDate = (dateString) => {
        try {
            return new Date(dateString).toLocaleString();
        } catch (e) {
            return dateString;
        }
    };

    const getCredentialTitle = (credential) => {
        if (credential.type && credential.type.includes('FormDataCredential')) {
            return 'Funeral Expense Form Data';
        }

        // Return the last type in the type array as the title
        if (Array.isArray(credential.type)) {
            return credential.type[credential.type.length - 1];
        }

        return credential.type || 'Unknown Credential';
    };

    // Get audience display name
    const getAudienceName = (audienceId) => {
        const audience = AVAILABLE_AUDIENCES.find(a => a.id === audienceId);
        return audience ? audience.name : audienceId;
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

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <VerifiedIcon sx={{ mr: 1 }} />
                Your Verifiable Credentials
            </Typography>

            {/* Audience Selection UI */}
            <Accordion
                expanded={filterExpanded}
                onChange={() => setFilterExpanded(!filterExpanded)}
                sx={{ mb: 2 }}
            >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <FilterListIcon sx={{ mr: 1 }} />
                        <Typography>Audience Filter</Typography>
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
                            disabled={selectedAudiences.length === 0}
                        >
                            Apply Filter
                        </Button>
                    </Box>
                </AccordionDetails>
            </Accordion>

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
                <Alert severity="info" sx={{ mt: 2 }}>
                    No credentials found. {selectedAudiences.length > 0 ? 'Try selecting different audiences or clearing the filter.' : ''}
                </Alert>
            ) : (
                <Box sx={{ mt: 2 }}>
                    {credentials.map((credential, index) => (
                        <Accordion key={credential.id || index} sx={{ mb: 1 }}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <Typography variant="subtitle1">
                                            {getCredentialTitle(credential)}
                                        </Typography>
                                        {renderAudienceBadge(credential)}
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mt: 1 }}>
                                        <Typography variant="caption" color="text.secondary">
                                            Issued: {formatDate(credential.issuanceDate)}
                                        </Typography>
                                        <Chip
                                            label={credential.issuer}
                                            size="small"
                                            color="primary"
                                            variant="outlined"
                                        />
                                    </Box>
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Typography variant="subtitle2" gutterBottom>
                                    Credential Data:
                                </Typography>
                                <Box sx={{
                                    maxHeight: '300px',
                                    overflow: 'auto',
                                    bgcolor: 'background.paper',
                                    borderRadius: 1,
                                    p: 1
                                }}>
                                    <JSONPretty id={`json-${index}`} data={credential} />
                                </Box>
                            </AccordionDetails>
                        </Accordion>
                    ))}
                </Box>
            )}

            <Button
                variant="outlined"
                color="primary"
                onClick={fetchCredentials}
                sx={{ mt: 2 }}
            >
                Refresh Credentials
            </Button>
        </Paper>
    );
};

export default EnhancedPDSCredentials;
