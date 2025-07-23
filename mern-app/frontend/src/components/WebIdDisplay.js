import React from 'react';
import { Alert } from 'react-bootstrap';

/**
 * Component to display WebID and its aliases
 * Shows the master WebID and any audience-specific aliases
 */
const WebIdDisplay = ({ webId, webIdAliases = [] }) => {
    if (!webId) {
        return (
            <Alert variant="warning">
                <Alert.Heading>No WebID Available</Alert.Heading>
                <p>
                    You don't have a WebID yet. A WebID is required to use SOLID-based services.
                </p>
            </Alert>
        );
    }

    return (
        <div className="webid-display">
            <h3 className="govuk-heading-s">Your WebID</h3>
            <p className="govuk-body webid-main">
                <strong>Master WebID:</strong> <code>{webId}</code>
            </p>

            {webIdAliases && webIdAliases.length > 0 && (
                <>
                    <h4 className="govuk-heading-s">Audience-specific WebID Aliases</h4>
                    <ul className="govuk-list">
                        {webIdAliases.map((alias, index) => (
                            <li key={index} className="webid-alias">
                                <code>{alias}</code>
                            </li>
                        ))}
                    </ul>
                    <p className="govuk-hint">
                        These aliases are used to protect your privacy when interacting with different services.
                    </p>
                </>
            )}
        </div>
    );
};

export default WebIdDisplay;
