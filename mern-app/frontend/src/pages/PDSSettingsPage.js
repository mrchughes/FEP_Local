// frontend/src/pages/PDSSettingsPage.js
import React, { useState, useEffect } from 'react';
import { Container, Typography, Box, Divider, Button, Alert } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import PDSConnection from '../components/PDSConnection';
import PDSCredentials from '../components/PDSCredentials';
import PrivateRoute from '../components/PrivateRoute';

const PDSSettingsPage = () => {
    const [isPdsEnabled, setIsPdsEnabled] = useState(true);
    const [message, setMessage] = useState(null);

    // This would come from your environment or configuration in a real app
    useEffect(() => {
        // Check if PDS feature is enabled
        const pdsEnabled = process.env.REACT_APP_PDS_ENABLED === 'true';
        setIsPdsEnabled(pdsEnabled);
    }, []);

    return (
        <PrivateRoute>
            <Container maxWidth="md">
                <Box sx={{ mt: 4, mb: 4 }}>
                    <Typography variant="h4" component="h1" gutterBottom>
                        Personal Data Store Settings
                    </Typography>

                    <Typography variant="body1" paragraph>
                        Connect to your Personal Data Store to securely manage your data and verifiable credentials.
                    </Typography>

                    {!isPdsEnabled && (
                        <Alert severity="info" sx={{ mb: 3 }}>
                            PDS integration is currently disabled in this environment. This is a preview of the interface.
                        </Alert>
                    )}

                    <PDSConnection />

                    <Divider sx={{ mt: 4, mb: 4 }} />

                    <PDSCredentials />

                    <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
                        <Button
                            component={RouterLink}
                            to="/dashboard"
                            variant="outlined"
                        >
                            Back to Dashboard
                        </Button>

                        <Button
                            component={RouterLink}
                            to="/form"
                            variant="contained"
                            color="primary"
                        >
                            Continue to Form
                        </Button>
                    </Box>
                </Box>
            </Container>
        </PrivateRoute>
    );
};

export default PDSSettingsPage;
