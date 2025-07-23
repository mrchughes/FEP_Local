// frontend/src/pages/EnhancedCredentialsPage.js
import React, { useState } from 'react';
import {
    Container,
    Typography,
    Box,
    Tabs,
    Tab,
    Paper,
    Divider,
    Button,
    Alert
} from '@mui/material';
import EnhancedPDSCredentials from '../components/EnhancedPDSCredentials';
import EnhancedPDSCredentialFieldMapping from '../components/EnhancedPDSCredentialFieldMapping';

const EnhancedCredentialsPage = () => {
    const [activeTab, setActiveTab] = useState(0);
    const [sampleFormData, setSampleFormData] = useState({
        personalDetails: {
            fullName: '',
            dateOfBirth: '',
            nationality: '',
            nino: ''
        },
        contactDetails: {
            emailAddress: '',
            phoneNumber: '',
            address: {
                line1: '',
                line2: '',
                city: '',
                postcode: ''
            }
        },
        employmentDetails: {
            employmentStatus: '',
            employerName: '',
            annualIncome: ''
        }
    });
    const [dataUpdated, setDataUpdated] = useState(false);

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
    };

    const handleFormDataUpdate = (updatedData) => {
        setSampleFormData(updatedData);
        setDataUpdated(true);
    };

    return (
        <Container maxWidth="lg" sx={{ my: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom>
                Enhanced PDS Credential Management
            </Typography>

            <Typography variant="body1" paragraph>
                This page demonstrates the enhanced credential management features including multi-audience support.
                You can view credentials from multiple services and import data from them into forms.
            </Typography>

            <Paper sx={{ mb: 4 }}>
                <Tabs
                    value={activeTab}
                    onChange={handleTabChange}
                    variant="fullWidth"
                >
                    <Tab label="View Credentials" />
                    <Tab label="Import Form Data" />
                </Tabs>

                <Divider />

                <Box sx={{ p: 3 }}>
                    {activeTab === 0 && (
                        <EnhancedPDSCredentials />
                    )}

                    {activeTab === 1 && (
                        <>
                            <Typography variant="h6" gutterBottom>
                                Sample Form
                            </Typography>

                            {dataUpdated && (
                                <Alert severity="success" sx={{ mb: 3 }}>
                                    Form data has been updated from your credentials!
                                </Alert>
                            )}

                            <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
                                <Typography variant="subtitle1" gutterBottom>
                                    Current Form Data:
                                </Typography>

                                <Box component="pre" sx={{
                                    bgcolor: 'background.paper',
                                    p: 2,
                                    borderRadius: 1,
                                    overflow: 'auto',
                                    maxHeight: '300px'
                                }}>
                                    {JSON.stringify(sampleFormData, null, 2)}
                                </Box>

                                <Button
                                    variant="outlined"
                                    onClick={() => setSampleFormData({
                                        personalDetails: {
                                            fullName: '',
                                            dateOfBirth: '',
                                            nationality: '',
                                            nino: ''
                                        },
                                        contactDetails: {
                                            emailAddress: '',
                                            phoneNumber: '',
                                            address: {
                                                line1: '',
                                                line2: '',
                                                city: '',
                                                postcode: ''
                                            }
                                        },
                                        employmentDetails: {
                                            employmentStatus: '',
                                            employerName: '',
                                            annualIncome: ''
                                        }
                                    })}
                                    sx={{ mt: 2 }}
                                >
                                    Reset Form Data
                                </Button>
                            </Paper>

                            <EnhancedPDSCredentialFieldMapping
                                applicationId="sample-application"
                                formData={sampleFormData}
                                onFieldsUpdated={handleFormDataUpdate}
                            />
                        </>
                    )}
                </Box>
            </Paper>
        </Container>
    );
};

export default EnhancedCredentialsPage;
