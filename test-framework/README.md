# FEP_Local Test Framework

This directory contains documentation and resources for the comprehensive test framework implemented for the FEP_Local project.

## Overview

The test framework is designed to ensure the reliability and correctness of the FEP_Local application, which consists of a MERN stack application and a Python AI Agent. The framework includes unit tests, integration tests, and end-to-end tests, with a focus on ensuring the entire application remains functional throughout the development process.

## Test Framework Components

1. **Backend Tests (Jest + Supertest)**
   - Unit tests for controllers, services, and utilities
   - API integration tests for endpoints
   - Authentication and authorization tests

2. **Frontend Tests (Jest + React Testing Library + Cypress)**
   - Component unit tests
   - Integration tests for connected components
   - End-to-end tests for complete user workflows

3. **Python AI Agent Tests (pytest)**
   - Unit tests for utility functions
   - Integration tests for AI agent components
   - API endpoint tests

## Key Testing Scripts

### End-to-End Testing Script

The main end-to-end testing script is located at `mern-app/frontend/run-e2e-tests.sh`. This script performs a comprehensive validation workflow:

1. **Shuts down all services**
   - Stops all Docker containers
   - Terminates any running Cloudflared tunnels

2. **Rebuilds the applications**
   - Rebuilds the backend application
   - Rebuilds the frontend application

3. **Recreates Docker images**
   - Rebuilds all Docker container images

4. **Starts all services**
   - Runs the startup script to initialize all services
   - Waits for services to be fully ready

5. **Runs Cypress end-to-end tests**
   - Executes all Cypress test scenarios

6. **Reports test results**
   - Provides a summary of test execution

### Running the Tests

To run the end-to-end tests:

```bash
cd mern-app/frontend
./run-e2e-tests.sh
```

To run backend tests:

```bash
cd mern-app/backend
npm test
```

To run frontend unit tests:

```bash
cd mern-app/frontend
npm test
```

To run Python agent tests:

```bash
cd python-app/app/ai_agent
./run_tests.sh
```

## Test Framework Development Status

The current status of the test framework development is tracked in the [test-framework-backlog.md](./test-framework-backlog.md) file. This document contains:

- Detailed implementation plans
- Progress tracking
- Testing best practices
- Validation workflow procedures

## Validation Workflow

After implementing changes to the application or test framework, it's important to follow the validation workflow to ensure the application remains functional:

1. Shut down all services
2. Rebuild the applications
3. Recreate Docker images
4. Run the startup script
5. Execute tests
6. Validate application functionality

This workflow is now automated in the `run-e2e-tests.sh` script.

## Best Practices

When working with the test framework:

1. Always run the full validation workflow after making significant changes
2. Update test documentation when adding or modifying tests
3. Keep tests isolated and idempotent
4. Maintain high code coverage
5. Prioritize fixing failing tests before adding new features

## Contributing

When contributing to the test framework:

1. Follow the testing best practices outlined in the backlog
2. Ensure your changes maintain compatibility with the validation workflow
3. Update documentation to reflect your changes
4. Verify all tests pass after your changes
