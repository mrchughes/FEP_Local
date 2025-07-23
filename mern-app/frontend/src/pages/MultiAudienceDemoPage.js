// frontend/src/pages/MultiAudienceDemoPage.js
import React, { useState, useEffect } from 'react';
import {
    Container,
    Typography,
    Box,
    Paper,
    Grid,
    Card,
    CardContent,
    CardHeader,
    Divider,
    List,
    ListItem,
    ListItemText,
    Chip,
    Button,
    FormControlLabel,
    Switch,
    TextField,
    Alert
} from '@mui/material';
import * as credentialService from '../services/credentialService';

const MultiAudienceDemoPage = () => {
    const [audiences, setAudiences] = useState(['default-pds', 'secondary-pds']);
    const [selectedAudiences, setSelectedAudiences] = useState(['default-pds']);
    const [newAudience, setNewAudience] = useState('');
    const [credentials, setCredentials] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastFetchTime, setLastFetchTime] = useState(null);

    const fetchCredentials = async () => {
        if (selectedAudiences.length === 0) {
            setError('Please select at least one audience');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await credentialService.getCredentials(selectedAudiences);
            setCredentials(result);
            setLastFetchTime(new Date().toLocaleTimeString());
        } catch (err) {
            console.error('Error fetching credentials:', err);
            setError('Failed to fetch credentials: ' + (err.message || 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    const handleAudienceToggle = (audience) => {
        setSelectedAudiences(prev => {
            if (prev.includes(audience)) {
                return prev.filter(a => a !== audience);
            } else {
                return [...prev, audience];
            }
        });
    };

    const handleAddAudience = () => {
        if (newAudience && !audiences.includes(newAudience)) {
            setAudiences(prev => [...prev, newAudience]);
            setSelectedAudiences(prev => [...prev, newAudience]);
            setNewAudience('');
        }
    };

    const getAudienceColor = (audience) => {
        // Simple hash function to get consistent colors
        const hash = audience.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0);

        // Generate pastel colors
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 70%, 80%)`;
    };

    useEffect(() => {
        // Initial fetch
        fetchCredentials();
    }, []);

    return (
        <Container maxWidth="lg" sx={{ my: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom>
                Multi-Audience Demo
            </Typography>

            <Typography variant="body1" paragraph>
                This page demonstrates fetching credentials from multiple PDS audiences simultaneously.
                You can add, select, and deselect audiences to see how the system handles multiple sources.
            </Typography>

            <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 3, height: '100%' }}>
                        <Typography variant="h6" gutterBottom>
                            Audience Selection
                        </Typography>

                        <List>
                            {audiences.map(audience => (
                                <ListItem key={audience} disablePadding>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={selectedAudiences.includes(audience)}
                                                onChange={() => handleAudienceToggle(audience)}
                                                color="primary"
                                            />
                                        }
                                        label={
                                            <Box display="flex" alignItems="center">
                                                <Typography variant="body2" sx={{ mr: 1 }}>
                                                    {audience}
                                                </Typography>
                                                <Chip
                                                    size="small"
                                                    label="PDS"
                                                    sx={{
                                                        bgcolor: getAudienceColor(audience),
                                                        height: '20px',
                                                        fontSize: '0.7rem'
                                                    }}
                                                />
                                            </Box>
                                        }
                                        sx={{ width: '100%', my: 1 }}
                                    />
                                </ListItem>
                            ))}
                        </List>

                        <Divider sx={{ my: 2 }} />

                        <Typography variant="subtitle2" gutterBottom>
                            Add New Audience
                        </Typography>

                        <Box sx={{ display: 'flex', mt: 1 }}>
                            <TextField
                                size="small"
                                value={newAudience}
                                onChange={(e) => setNewAudience(e.target.value)}
                                placeholder="audience-name"
                                fullWidth
                            />
                            <Button
                                variant="contained"
                                onClick={handleAddAudience}
                                disabled={!newAudience}
                                sx={{ ml: 1 }}
                            >
                                Add
                            </Button>
                        </Box>

                        <Button
                            variant="contained"
                            color="primary"
                            fullWidth
                            onClick={fetchCredentials}
                            sx={{ mt: 3 }}
                            disabled={loading || selectedAudiences.length === 0}
                        >
                            {loading ? 'Loading...' : 'Fetch Credentials'}
                        </Button>

                        {error && (
                            <Alert severity="error" sx={{ mt: 2 }}>
                                {error}
                            </Alert>
                        )}

                        {lastFetchTime && (
                            <Typography variant="caption" display="block" sx={{ mt: 2, textAlign: 'center' }}>
                                Last fetched: {lastFetchTime}
                            </Typography>
                        )}
                    </Paper>
                </Grid>

                <Grid item xs={12} md={8}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Credentials from {selectedAudiences.length} source{selectedAudiences.length !== 1 ? 's' : ''}
                        </Typography>

                        {loading ? (
                            <Box sx={{ textAlign: 'center', py: 4 }}>
                                <Typography>Loading credentials...</Typography>
                            </Box>
                        ) : (
                            <>
                                {credentials.length === 0 ? (
                                    <Alert severity="info">
                                        No credentials found from the selected audiences.
                                    </Alert>
                                ) : (
                                    <Grid container spacing={2}>
                                        {credentials.map((credential, index) => (
                                            <Grid item xs={12} key={index}>
                                                <Card variant="outlined">
                                                    <CardHeader
                                                        title={credential.name || 'Unnamed Credential'}
                                                        subheader={
                                                            <Box display="flex" alignItems="center" mt={1}>
                                                                <Typography variant="caption" sx={{ mr: 1 }}>
                                                                    Type: {credential.type}
                                                                </Typography>
                                                                <Chip
                                                                    size="small"
                                                                    label={credential.audience || 'default'}
                                                                    sx={{
                                                                        bgcolor: getAudienceColor(credential.audience || 'default'),
                                                                        height: '20px',
                                                                        fontSize: '0.7rem'
                                                                    }}
                                                                />
                                                            </Box>
                                                        }
                                                    />
                                                    <Divider />
                                                    <CardContent>
                                                        <Typography variant="subtitle2" gutterBottom>
                                                            Fields:
                                                        </Typography>
                                                        <List dense>
                                                            {Object.entries(credential.fields || {}).map(([key, value]) => (
                                                                <ListItem key={key}>
                                                                    <ListItemText
                                                                        primary={key}
                                                                        secondary={String(value)}
                                                                    />
                                                                </ListItem>
                                                            ))}
                                                        </List>
                                                    </CardContent>
                                                </Card>
                                            </Grid>
                                        ))}
                                    </Grid>
                                )}
                            </>
                        )}
                    </Paper>
                </Grid>
            </Grid>
        </Container>
    );
};

export default MultiAudienceDemoPage;
