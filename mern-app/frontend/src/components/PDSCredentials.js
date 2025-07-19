// frontend/src/components/PDSCredentials.js
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
    Chip
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import VerifiedIcon from '@mui/icons-material/Verified';
import JSONPretty from 'react-json-pretty';
import 'react-json-pretty/themes/monikai.css';

const PDSCredentials = () => {
    const [loading, setLoading] = useState(true);
    const [credentials, setCredentials] = useState([]);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    // Fetch credentials on component mount
    useEffect(() => {
        fetchCredentials();
    }, []);

    const fetchCredentials = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('/api/credentials', {
                headers: { Authorization: `Bearer ${token}` }
            });

            setCredentials(response.data || []);
        } catch (err) {
            console.error('Error fetching credentials:', err);
            setError('Failed to fetch credentials from PDS');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        try {
            return new Date(dateString).toLocaleString();
        } catch (e) {
            return dateString;
        }
    };

    const getCredentialTitle = (credential) => {
        if (credential.type.includes('FormDataCredential')) {
            return 'Funeral Expense Form Data';
        }

        // Return the last type in the type array as the title
        if (Array.isArray(credential.type)) {
            return credential.type[credential.type.length - 1];
        }

        return credential.type || 'Unknown Credential';
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
                    You don't have any credentials stored in your PDS yet.
                </Alert>
            ) : (
                <Box sx={{ mt: 2 }}>
                    {credentials.map((credential, index) => (
                        <Accordion key={credential.id || index} sx={{ mb: 1 }}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                                    <Typography variant="subtitle1">
                                        {getCredentialTitle(credential)}
                                    </Typography>
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

export default PDSCredentials;
