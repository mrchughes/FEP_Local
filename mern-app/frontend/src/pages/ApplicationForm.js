// frontend/src/pages/ApplicationForm.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Container,
    Paper,
    Typography,
    Box,
    Button,
    CircularProgress,
    Divider,
    Stepper,
    Step,
    StepLabel,
    Alert,
    Tabs,
    Tab,
    IconButton,
    Tooltip
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import AccountBoxIcon from '@mui/icons-material/AccountBox';
import DescriptionIcon from '@mui/icons-material/Description';
import FormRenderer from '../components/FormRenderer';
import PDSCredentialFieldMapping from '../components/PDSCredentialFieldMapping';
import PDSConnectionStatus from '../components/PDSConnectionStatus';

function ApplicationForm() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [application, setApplication] = useState(null);
    const [formSchema, setFormSchema] = useState(null);
    const [formData, setFormData] = useState({});
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [saving, setSaving] = useState(false);
    const [activeStep, setActiveStep] = useState(0);
    const [tabValue, setTabValue] = useState(0);
    const [isPdsConnected, setIsPdsConnected] = useState(false);
    const [mappedFields, setMappedFields] = useState([]);

    // Fetch application data on component mount
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);

            try {
                const token = localStorage.getItem('token');

                // Fetch application data
                const applicationResponse = await axios.get(`/api/forms/applications/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                setApplication(applicationResponse.data);

                // Fetch form schema based on form ID from the application
                const formResponse = await axios.get(`/api/forms/${applicationResponse.data.formId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                setFormSchema(formResponse.data.schema);
                setFormData(applicationResponse.data.data || {});

                // Check PDS connection status
                const pdsResponse = await axios.get('/api/pds/status', {
                    headers: { Authorization: `Bearer ${token}` }
                });

                setIsPdsConnected(pdsResponse.data.isConnected);

                // Fetch previous field mappings if any
                const mappingResponse = await axios.get(`/api/mapping/applications/${id}/mapping-history`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (mappingResponse.data && mappingResponse.data.length > 0) {
                    // Get the most recent mapping
                    const recentMapping = mappingResponse.data[0];
                    setMappedFields(recentMapping.mappings.map(m => m.formField));
                }
            } catch (err) {
                console.error('Error fetching application data:', err);
                setError('Failed to load application data. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id]);

    // Handle form data changes
    const handleFormChange = (data) => {
        setFormData(data);
    };

    // Handle form submission
    const handleSubmit = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const token = localStorage.getItem('token');

            await axios.put(`/api/forms/applications/${id}`, {
                data: formData,
                status: 'draft' // Keep as draft until final submission
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setSuccess('Application saved successfully!');

            // Clear success message after 3 seconds
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            console.error('Error saving application:', err);
            setError('Failed to save application. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    // Handle final submission
    const handleFinalSubmit = async () => {
        setSaving(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');

            await axios.put(`/api/forms/applications/${id}`, {
                data: formData,
                status: 'submitted'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setSuccess('Application submitted successfully!');

            // Navigate to applications list after short delay
            setTimeout(() => navigate('/applications'), 2000);
        } catch (err) {
            console.error('Error submitting application:', err);
            setError('Failed to submit application. Please try again.');
            setSaving(false);
        }
    };

    // Handle tab change
    const handleTabChange = (event, newValue) => {
        setTabValue(newValue);
    };

    // Handle fields updated from credential mapping
    const handleFieldsUpdated = (mappings) => {
        // Update the form data with the mapped values
        const updatedFormData = { ...formData };

        mappings.forEach(mapping => {
            // Use the path to set the value in the nested structure
            const fieldPath = mapping.formField.split('.');
            let current = updatedFormData;

            // Navigate to the proper nesting level
            for (let i = 0; i < fieldPath.length - 1; i++) {
                const key = fieldPath[i];

                if (!current[key] || typeof current[key] !== 'object') {
                    current[key] = {};
                }

                current = current[key];
            }

            // Set the value
            const lastKey = fieldPath[fieldPath.length - 1];
            current[lastKey] = mapping.value;
        });

        // Update form data state
        setFormData(updatedFormData);

        // Update list of mapped fields
        setMappedFields(mappings.map(m => m.formField));

        // Show success message
        setSuccess('Fields updated from credential successfully!');
        setTimeout(() => setSuccess(null), 3000);
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!application || !formSchema) {
        return (
            <Container maxWidth="md" sx={{ mt: 4 }}>
                <Alert severity="error">
                    {error || 'Application or form not found'}
                </Alert>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
            <Paper sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h4" component="h1">
                        {formSchema.title || 'Application Form'}
                    </Typography>

                    <PDSConnectionStatus
                        isConnected={isPdsConnected}
                        applicationId={id}
                        onConnectionChange={(status) => setIsPdsConnected(status)}
                    />
                </Box>

                <Divider sx={{ mb: 3 }} />

                {/* Step indicator */}
                <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                    <Step>
                        <StepLabel>Fill Application</StepLabel>
                    </Step>
                    <Step>
                        <StepLabel>Review</StepLabel>
                    </Step>
                    <Step>
                        <StepLabel>Submit</StepLabel>
                    </Step>
                </Stepper>

                {error && (
                    <Alert severity="error" sx={{ mb: 3 }}>
                        {error}
                    </Alert>
                )}

                {success && (
                    <Alert severity="success" sx={{ mb: 3 }}>
                        {success}
                    </Alert>
                )}

                <Box sx={{ mb: 3 }}>
                    <Tabs
                        value={tabValue}
                        onChange={handleTabChange}
                        sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
                    >
                        <Tab icon={<DescriptionIcon />} iconPosition="start" label="Form Entry" />
                        <Tab
                            icon={<AccountBoxIcon />}
                            iconPosition="start"
                            label="Use Credentials"
                            disabled={!isPdsConnected}
                        />
                    </Tabs>

                    <Box sx={{ mt: 2 }}>
                        {tabValue === 0 && (
                            <Box>
                                {mappedFields.length > 0 && (
                                    <Alert severity="info" sx={{ mb: 3 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <Typography variant="body2">
                                                <InfoOutlinedIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                                                {mappedFields.length} fields have been filled using your verifiable credentials.
                                            </Typography>

                                            <Tooltip title="Switch to Credentials tab to map more fields">
                                                <IconButton
                                                    size="small"
                                                    color="primary"
                                                    onClick={() => setTabValue(1)}
                                                >
                                                    <RefreshIcon />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </Alert>
                                )}

                                <FormRenderer
                                    schema={formSchema}
                                    data={formData}
                                    onChange={handleFormChange}
                                    highlightFields={mappedFields}
                                />
                            </Box>
                        )}

                        {tabValue === 1 && (
                            <PDSCredentialFieldMapping
                                applicationId={id}
                                formData={formData}
                                onFieldsUpdated={handleFieldsUpdated}
                            />
                        )}
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, pt: 2, borderTop: '1px solid #eee' }}>
                    <Button
                        variant="outlined"
                        onClick={() => navigate('/applications')}
                    >
                        Cancel
                    </Button>

                    <Box>
                        <Button
                            variant="outlined"
                            sx={{ mr: 2 }}
                            onClick={handleSubmit}
                            disabled={saving}
                        >
                            Save Draft
                        </Button>

                        <Button
                            variant="contained"
                            color="primary"
                            onClick={handleFinalSubmit}
                            disabled={saving}
                        >
                            {saving ? <CircularProgress size={24} /> : 'Submit Application'}
                        </Button>
                    </Box>
                </Box>
            </Paper>
        </Container>
    );
}

export default ApplicationForm;
