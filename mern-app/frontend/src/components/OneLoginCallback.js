import React, { useEffect, useState, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Container, Alert, Spinner } from 'react-bootstrap';
import { validateOneLoginToken } from '../api';
import AuthContext from '../auth/AuthContext';

/**
 * OneLogin callback handler component
 * Handles the callback from OneLogin after authentication
 */
const OneLoginCallback = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const { login } = useContext(AuthContext); useEffect(() => {
        const processCallback = async () => {
            try {
                // Get code and state from URL query parameters
                const params = new URLSearchParams(location.search);
                const code = params.get('code');
                const state = params.get('state');

                if (!code) {
                    setError('Authorization code not found in callback URL');
                    setLoading(false);
                    return;
                }

                // First check if the user is authenticated with OneLogin
                const statusResponse = await axios.get(`${process.env.REACT_APP_API_URL || ''}/auth/onelogin-status`, {
                    withCredentials: true
                });

                if (statusResponse.data.authenticated) {
                    // Get JWT token for frontend
                    const tokenResponse = await axios.get(`${process.env.REACT_APP_API_URL || ''}/auth/onelogin-token`, {
                        withCredentials: true
                    });

                    if (tokenResponse.data && tokenResponse.data.token) {
                        // Set user in context and redirect to dashboard
                        login({
                            token: tokenResponse.data.token,
                            ...tokenResponse.data.user
                        });
                        navigate('/dashboard');
                    } else {
                        throw new Error('No token received from backend');
                    }
                } else {
                    // If not authenticated, redirect to login page
                    setError('Authentication failed. Please try again.');
                    setTimeout(() => navigate('/login'), 3000);
                }
            } catch (err) {
                console.error('Error processing OneLogin callback:', err);
                setError('An error occurred during authentication. Please try again.');
                setTimeout(() => navigate('/login'), 3000);
            } finally {
                setLoading(false);
            }
        };

        processCallback();
    }, [location, navigate]);

    return (
        <Container className="mt-5 text-center">
            <h2>Processing Login</h2>
            {loading ? (
                <div className="mt-4">
                    <Spinner animation="border" role="status" variant="primary">
                        <span className="visually-hidden">Loading...</span>
                    </Spinner>
                    <p className="mt-3">Please wait while we complete your login...</p>
                </div>
            ) : error ? (
                <Alert variant="danger" className="mt-4">
                    {error}
                    <p className="mt-2">Redirecting back to login page...</p>
                </Alert>
            ) : (
                <Alert variant="success" className="mt-4">
                    Login successful! Redirecting to dashboard...
                </Alert>
            )}
        </Container>
    );
};

export default OneLoginCallback;
