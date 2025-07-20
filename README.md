# Financial Entitlement Platform (FEP)

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
- **scripts/**: Utility scripts
  - **startup.sh**: Project startup script
  - **test-upload.sh**: Script for testing file uploads
  - **test-pds-integration.sh**: Script for testing PDS integration
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

