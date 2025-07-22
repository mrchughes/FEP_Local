// frontend/src/components/PDSConnectionStatus.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Box,
    Button,
    Typography,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    CircularProgress,
    Alert,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Divider
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import StorageIcon from '@mui/icons-material/Storage';
import AccountBoxIcon from '@mui/icons-material/AccountBox';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import LinkIcon from '@mui/icons-material/Link';
import LockIcon from '@mui/icons-material/Lock';

/**
 * Component for displaying and managing PDS connection status
 */
const PDSConnectionStatus = ({ isConnected, applicationId, onConnectionChange }) => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState(null);
    const [pdsDetails, setPdsDetails] = useState(null);

    // Fetch PDS details when dialog opens
    useEffect(() => {
        if (dialogOpen && isConnected) {
            fetchPdsDetails();
        }
    }, [dialogOpen, isConnected]);

    // Fetch detailed PDS information
    const fetchPdsDetails = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('/api/pds/details', {
                headers: { Authorization: `Bearer ${token}` }
            });

            setPdsDetails(response.data);
        } catch (err) {
            console.error('Error fetching PDS details:', err);
            setError('Could not fetch PDS connection details');
        }
    };

    // Connect to PDS
    const handleConnect = async () => {
        setConnecting(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            const response = await axios.post('/api/pds/authenticate', {
                callbackUrl: window.location.origin + `/applications/${applicationId}`
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Redirect to PDS provider for authentication
            window.location.href = response.data.authUrl;
        } catch (err) {
            console.error('Error connecting to PDS:', err);
            setError('Failed to connect to PDS service');
            setConnecting(false);
        }
    };

    // Disconnect from PDS
    const handleDisconnect = async () => {
        setConnecting(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/pds/logout', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Update connection status
            if (onConnectionChange) {
                onConnectionChange(false);
            }

            setDialogOpen(false);
        } catch (err) {
            console.error('Error disconnecting from PDS:', err);
            setError('Failed to disconnect from PDS');
        } finally {
            setConnecting(false);
        }
    };

    return (
        <>
            {isConnected ? (
                <Chip
                    icon={<CheckCircleIcon />}
                    label="PDS Connected"
                    color="success"
                    variant="outlined"
                    onClick={() => setDialogOpen(true)}
                    sx={{ cursor: 'pointer' }}
                />
            ) : (
                <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<StorageIcon />}
                    onClick={() => setDialogOpen(true)}
                >
                    Connect PDS
                </Button>
            )}

            <Dialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    {isConnected ? 'Personal Data Store Connected' : 'Connect to Personal Data Store'}
                </DialogTitle>

                <DialogContent>
                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    {isConnected ? (
                        <>
                            <Alert severity="success" sx={{ mb: 3 }}>
                                <Typography variant="body2">
                                    Your Personal Data Store is connected and ready to use
                                </Typography>
                            </Alert>

                            {pdsDetails ? (
                                <List>
                                    <ListItem>
                                        <ListItemIcon>
                                            <AccountBoxIcon />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary="WebID"
                                            secondary={pdsDetails.webId || 'Not available'}
                                        />
                                    </ListItem>

                                    <Divider variant="inset" component="li" />

                                    <ListItem>
                                        <ListItemIcon>
                                            <StorageIcon />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary="Provider"
                                            secondary={pdsDetails.provider || 'Unknown provider'}
                                        />
                                    </ListItem>

                                    <Divider variant="inset" component="li" />

                                    <ListItem>
                                        <ListItemIcon>
                                            <VerifiedUserIcon />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary="Credentials"
                                            secondary={`${pdsDetails.credentialCount || 0} verifiable credentials available`}
                                        />
                                    </ListItem>

                                    <Divider variant="inset" component="li" />

                                    <ListItem>
                                        <ListItemIcon>
                                            <LockIcon />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary="DID"
                                            secondary={pdsDetails.did || 'Not available'}
                                        />
                                    </ListItem>
                                </List>
                            ) : (
                                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                                    <CircularProgress />
                                </Box>
                            )}

                            <Box sx={{ mt: 2 }}>
                                <Typography variant="body2" color="text.secondary">
                                    You can disconnect from your PDS at any time. Your application data will still be saved locally.
                                </Typography>
                            </Box>
                        </>
                    ) : (
                        <>
                            <Typography variant="body1" paragraph>
                                Connect to your Personal Data Store to use your verifiable credentials for this application.
                            </Typography>

                            <Alert severity="info" sx={{ mb: 3 }}>
                                <Typography variant="body2">
                                    Benefits of using your Personal Data Store:
                                </Typography>
                                <List dense disablePadding sx={{ mt: 1 }}>
                                    <ListItem disablePadding>
                                        <ListItemIcon sx={{ minWidth: 30 }}>
                                            <LinkIcon fontSize="small" />
                                        </ListItemIcon>
                                        <ListItemText primary="Auto-fill application fields from your verifiable credentials" />
                                    </ListItem>
                                    <ListItem disablePadding>
                                        <ListItemIcon sx={{ minWidth: 30 }}>
                                            <VerifiedUserIcon fontSize="small" />
                                        </ListItemIcon>
                                        <ListItemText primary="Use verified information from trusted sources" />
                                    </ListItem>
                                    <ListItem disablePadding>
                                        <ListItemIcon sx={{ minWidth: 30 }}>
                                            <LockIcon fontSize="small" />
                                        </ListItemIcon>
                                        <ListItemText primary="Control what information you share and with whom" />
                                    </ListItem>
                                </List>
                            </Alert>

                            <Typography variant="body2" color="text.secondary">
                                You will be redirected to your PDS provider to authenticate. After successful authentication, you will return to this application.
                            </Typography>
                        </>
                    )}
                </DialogContent>

                <DialogActions>
                    {isConnected ? (
                        <>
                            <Button onClick={() => setDialogOpen(false)}>
                                Close
                            </Button>
                            <Button
                                onClick={handleDisconnect}
                                color="error"
                                disabled={connecting}
                            >
                                {connecting ? <CircularProgress size={24} /> : 'Disconnect'}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button onClick={() => setDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleConnect}
                                color="primary"
                                variant="contained"
                                disabled={connecting}
                                startIcon={connecting ? <CircularProgress size={20} /> : null}
                            >
                                Connect to PDS
                            </Button>
                        </>
                    )}
                </DialogActions>
            </Dialog>
        </>
    );
};

export default PDSConnectionStatus;
