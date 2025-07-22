import React from 'react';
import axios from 'axios';
import { Button } from 'react-bootstrap';
import { FaIdCard } from 'react-icons/fa';

/**
 * OneLogin authentication button component
 * Redirects the user to OneLogin for authentication
 */
const OneLoginButton = () => {
    const handleOneLoginAuth = async () => {
        try {
            // Redirect to the OneLogin authentication endpoint
            window.location.href = `${process.env.REACT_APP_API_URL || ''}/auth/onelogin`;
        } catch (error) {
            console.error('Error initiating OneLogin authentication:', error);
        }
    };

    return (
        <Button
            variant="primary"
            onClick={handleOneLoginAuth}
            className="mt-3 d-flex align-items-center justify-content-center"
            style={{ backgroundColor: '#1d70b8', borderColor: '#1d70b8' }}
        >
            <FaIdCard className="me-2" />
            Sign in with GOV.UK OneLogin
        </Button>
    );
};

export default OneLoginButton;
