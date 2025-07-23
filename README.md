# Funeral Expense Payment (FEP) Application

This project is a web application for handling Funeral Expense Payment applications with integration to the Personal Data Store (PDS) system.

## Architecture

The application consists of the following components:

1. **MERN Stack Application**
   - MongoDB database
   - Express.js backend
   - React frontend
   - Node.js runtime

2. **Python Application**
   - AI agent for assisting with form completion
   - Flask API

3. **PDS Integration**
   - WebID alias resolution
   - Credential field mapping
   - Multi-audience support

## Prerequisites

- Node.js 16+ and npm
- Python 3.8+ and pip
- MongoDB
- Docker and Docker Compose (optional)

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-organization/fep.git
cd fep
```

### 2. Build the application

You can build both the frontend and backend with:

```bash
npm run build
```

This will:
- Install backend dependencies
- Install frontend dependencies
- Build the frontend for production

### 3. Set up environment variables

Create `.env` files for both backend and frontend:

```bash
cp mern-app/backend/.env.template mern-app/backend/.env
cp mern-app/frontend/.env.template mern-app/frontend/.env
```

Edit these files to set the required environment variables.

## Running the Application

### Development Mode

To run both frontend and backend in development mode:

```bash
npm run start:all
```

Or run them separately:

```bash
# Run the backend only
npm run start

# Run the frontend only
npm run start:frontend
```

### Production Mode

For production, you should:

1. Build the frontend with `npm run build`
2. Serve the frontend build using a static server
3. Run the backend with proper production settings

## Docker Setup

You can also run the application using Docker:

```bash
docker-compose up -d
```

## Testing

Run the tests with:

```bash
npm test
```

## PDS Integration

This application integrates with the Personal Data Store (PDS) system to:

1. Handle user authentication via OIDC
2. Retrieve and store verifiable credentials
3. Map credential fields to application form fields
4. Support multi-audience requests for different PDS instances

See the documentation in the `/docs` folder for more details on PDS integration.

## License

[MIT](LICENSE)

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
   - **WebID Alias Handling**: Support for audience-specific WebID aliases
   - **DNS Verification**: Domain ownership verification for client registration
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

