// frontend/src/pages/PDSConnectedSuccess.js
import React, { useEffect, useState } from 'react';
import { Container, Typography, Box, Button, CircularProgress } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const PDSConnectedSuccess = () => {
    const [countdown, setCountdown] = useState(5);
    const navigate = useNavigate();

    useEffect(() => {
        // Auto-redirect after countdown
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            navigate('/pds-settings');
        }
    }, [countdown, navigate]);

    return (
        <Container maxWidth="md">
            <Box
                sx={{
                    mt: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center'
                }}
            >
                <CheckCircleIcon
                    color="success"
                    sx={{ fontSize: 80, mb: 2 }}
                />

                <Typography variant="h4" component="h1" gutterBottom>
                    Successfully Connected to PDS!
                </Typography>

                <Typography variant="body1" paragraph>
                    Your account has been successfully connected to your Personal Data Store.
                    You can now securely store and manage your data and credentials.
                </Typography>

                <Box sx={{ mt: 2, mb: 4, display: 'flex', alignItems: 'center' }}>
                    <CircularProgress
                        variant="determinate"
                        value={(5 - countdown) * 20}
                        size={24}
                        sx={{ mr: 2 }}
                    />
                    <Typography>
                        Redirecting in {countdown} seconds...
                    </Typography>
                </Box>

                <Button
                    component={RouterLink}
                    to="/pds-settings"
                    variant="contained"
                    color="primary"
                >
                    Go to PDS Settings
                </Button>
            </Box>
        </Container>
    );
};

export default PDSConnectedSuccess;
