// frontend/src/components/PDSConnection.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, Button, TextField, Typography, Paper, CircularProgress, Alert } from '@mui/material';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudOffIcon from '@mui/icons-material/CloudOff';

const PDSConnection = () => {
    const [loading, setLoading] = useState(true);
    const [connected, setConnected] = useState(false);
    const [connectionInfo, setConnectionInfo] = useState(null);
    const [webId, setWebId] = useState('');
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    // Fetch connection status on component mount
    useEffect(() => {
        fetchPDSStatus();
    }, []);

    const fetchPDSStatus = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('/api/pds/status', {
                headers: { Authorization: `Bearer ${token}` }
            });

            setConnected(response.data.connected);
            if (response.data.connected) {
                setConnectionInfo(response.data);
            }
        } catch (err) {
            console.error('Error fetching PDS status:', err);
            setError('Failed to fetch PDS connection status');
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = async (e) => {
        e.preventDefault();
        if (!webId) {
            setError('WebID is required');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post('/api/pds/connect',
                { webId },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Redirect to PDS provider for authentication
            if (response.data.authUrl) {
                window.location.href = response.data.authUrl;
            }
        } catch (err) {
            console.error('Error connecting to PDS:', err);
            setError(err.response?.data?.message || 'Failed to connect to PDS');
            setLoading(false);
        }
    };

    const handleDisconnect = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/pds/disconnect', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setConnected(false);
            setConnectionInfo(null);
            setSuccessMessage('Successfully disconnected from PDS');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            console.error('Error disconnecting from PDS:', err);
            setError(err.response?.data?.message || 'Failed to disconnect from PDS');
        } finally {
            setLoading(false);
        }
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
            <Typography variant="h5" gutterBottom>
                {connected ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', color: 'success.main' }}>
                        <CloudDoneIcon sx={{ mr: 1 }} />
                        Connected to Personal Data Store
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <CloudOffIcon sx={{ mr: 1 }} />
                        Connect to Personal Data Store
                    </Box>
                )}
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

            {connected ? (
                <Box>
                    <Typography variant="body1" gutterBottom>
                        You are connected to a Personal Data Store.
                    </Typography>
                    <Box sx={{ mt: 2, mb: 2 }}>
                        <Typography variant="body2">
                            <strong>WebID:</strong> {connectionInfo?.webId}
                        </Typography>
                        <Typography variant="body2">
                            <strong>PDS Provider:</strong> {connectionInfo?.pdsProvider}
                        </Typography>
                        <Typography variant="body2">
                            <strong>Connected Since:</strong>{' '}
                            {new Date(connectionInfo?.connectedSince).toLocaleString()}
                        </Typography>
                    </Box>
                    <Button
                        variant="outlined"
                        color="error"
                        onClick={handleDisconnect}
                        disabled={loading}
                    >
                        Disconnect from PDS
                    </Button>
                </Box>
            ) : (
                <Box component="form" onSubmit={handleConnect} sx={{ mt: 2 }}>
                    <Typography variant="body1" gutterBottom>
                        Connect to your Personal Data Store to securely store and access your form data.
                    </Typography>
                    <TextField
                        fullWidth
                        label="Your WebID"
                        value={webId}
                        onChange={(e) => setWebId(e.target.value)}
                        placeholder="https://yourusername.solidcommunity.net/profile/card#me"
                        margin="normal"
                        required
                        helperText="Enter your WebID from your Solid account"
                    />
                    <Button
                        variant="contained"
                        color="primary"
                        type="submit"
                        disabled={loading || !webId}
                        sx={{ mt: 2 }}
                    >
                        Connect to PDS
                    </Button>
                </Box>
            )}
        </Paper>
    );
};

export default PDSConnection;
