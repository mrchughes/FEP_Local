# Financial Entitlement Platform

This repository contains the Financial Entitlement Platform application, which helps users apply for financial entitlements.

## Project Structure

- **mern-app/**: Main application
  - **backend/**: Node.js/Express backend
  - **frontend/**: React frontend
- **python-app/**: Python services including AI agent for document processing
- **docs/**: Documentation files
  - **defect_log.md**: Log of defects and their fixes
  - **test-results.md**: Results from testing sessions
  - **PDS-Integration-Strategy.md**: Strategy for Personal Data Store integration
  - **PDS-Integration-Implementation.md**: Implementation details for PDS integration
  - **PDS-Integration-Summary.md**: Summary of PDS integration implementation
  - **PDS-Credential-Field-Mapping.md**: Documentation for credential field mapping
  - **ONELOGIN-INTEGRATION.md**: Documentation for OneLogin OIDC integration
- **scripts/**: Utility scripts
  - **startup.sh**: Project startup script
  - **test-upload.sh**: Script for testing file uploads
  - **test-pds-integration.sh**: Script for testing PDS integration
  - **test-credential-mapping.sh**: Script for testing credential field mapping
  - **test-onelogin-oidc.sh**: Script for testing OneLogin OIDC configuration
  - **test-onelogin-pds.sh**: Script for testing OneLogin integration with PDS
  - **setup-onelogin-env.sh**: Script for setting up OneLogin environment variables
  - Other utility scripts
- **Requirements/**: Project requirements and specifications
- **shared-evidence/**: Test evidence files for development

## Key Features

1. **Funeral Expenses Application**: Main application for applying for funeral expenses payment
2. **Document Upload and Processing**: Upload and process supporting documents
3. **AI-powered Data Extraction**: Extract data from documents using AI
4. **Personal Data Store Integration**: Connect to PDS for secure data management
   - **SOLID OIDC Authentication**: Standard-based authentication with PDS providers
   - **Verifiable Credentials**: Store and retrieve verifiable credentials
   - **DID Challenge-Response**: Verify DID ownership through challenge-response
   - **Credential Field Mapping**: Auto-fill forms using verifiable credentials
5. **OneLogin Integration**: Authentication with GOV.UK OneLogin
   - **OIDC Authentication Flow**: Standard OAuth 2.0 flow with OneLogin
   - **WebID Support**: Connect to PDS using OneLogin identity
   - **Token Management**: Secure storage and refresh of tokens

## Setup and Running

See `docker-compose.yml` for the container setup and dependencies.

### OneLogin Integration Setup

To set up the OneLogin integration:

1. Run the setup script: `./scripts/setup-onelogin-env.sh`
2. Enter your OneLogin client credentials when prompted
3. Start the backend and frontend servers
4. Test the configuration: `./scripts/test-onelogin-oidc.sh`
5. Test the PDS integration: `./scripts/test-onelogin-pds.sh`

For more details, see [ONELOGIN-INTEGRATION.md](docs/ONELOGIN-INTEGRATION.md).

## Development Setup

This project uses Python with a virtual environment (.venv). When opening in VS Code, the settings have been configured to use the Python interpreter from the virtual environment.

If you need to manually set up the environment:

1. Create a virtual environment: `python -m venv .venv`
2. Activate the environment: `source .venv/bin/activate` (macOS/Linux) or `.venv\Scripts\activate` (Windows)
3. Install dependencies: `pip install -r requirements.txt`

## Project Structure

- **mern-app/**: Main application
  - **backend/**: Node.js/Express backend
  - **frontend/**: React frontend
- **python-app/**: Python services including AI agent for document processing
- **docs/**: Documentation files
  - **defect_log.md**: Log of defects and their fixes
  - **test-results.md**: Results from testing sessions
  - **PDS-Integration-Strategy.md**: Strategy for Personal Data Store integration
  - **PDS-Integration-Implementation.md**: Implementation details for PDS integration
  - **PDS-Integration-Summary.md**: Summary of PDS integration implementation
  - **PDS-Credential-Field-Mapping.md**: Documentation for credential field mapping
  - **ONELOGIN-INTEGRATION.md**: Documentation for OneLogin OIDC integration
- **scripts/**: Utility scripts
  - **startup.sh**: Project startup script
  - **test-upload.sh**: Script for testing file uploads
  - **test-pds-integration.sh**: Script for testing PDS integration
  - **test-credential-mapping.sh**: Script for testing credential field mapping
  - Other utility scripts
- **Requirements/**: Project requirements and specifications
- **shared-evidence/**: Test evidence files for development
- **dev/**: Development and testing files

## Key Features

1. **Funeral Expenses Application**: Main application for applying for funeral expenses payment
2. **Document Upload and Processing**: Upload and process supporting documents
3. **AI-powered Data Extraction**: Extract data from documents using AI
4. **Personal Data Store Integration**: Connect to PDS for secure data management

## Setup and Running

See `docker-compose.yml` for the container setup and dependencies.

## Development Setup

This project uses Python with a virtual environment (.venv). When opening in VS Code, the settings have been configured to use the Python interpreter from the virtual environment.

If you need to manually set up the environment:

1. Create a virtual environment: `python -m venv .venv`
2. Activate the environment: `source .venv/bin/activate` (macOS/Linux) or `.venv\Scriptsctivate` (Windows)
3. Install dependencies: `pip install -r requirements.txt`

