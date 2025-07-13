#!/bin/bash

# Comprehensive End-to-End Test Script with Full Environment Reset
# This script:
# 1. Shuts down all services (Docker and Cloudflared)
# 2. Rebuilds the backend and frontend applications
# 3. Recreates Docker images
# 4. Runs the startup script to start all services
# 5. Runs end-to-end tests
# 6. Reports results

# Stop on any error
set -e

# Set up colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FRONTEND_DIR="${PROJECT_ROOT}/mern-app/frontend"
BACKEND_DIR="${PROJECT_ROOT}/mern-app/backend"
STARTUP_SCRIPT="${PROJECT_ROOT}/scripts/startup.sh"

echo -e "${YELLOW}==== Starting Comprehensive End-to-End Test Validation ====${NC}"

# Step 1: Shut down all services
echo -e "${BLUE}==== Step 1: Shutting down all services ====${NC}"

echo -e "${YELLOW}Stopping Docker containers...${NC}"
cd "${PROJECT_ROOT}" && docker compose down
if [ $? -eq 0 ]; then
  echo -e "${GREEN}Docker containers stopped successfully${NC}"
else
  echo -e "${RED}Warning: Issues stopping Docker containers${NC}"
  # Don't exit - we'll proceed anyway
fi

echo -e "${YELLOW}Stopping Cloudflared tunnel if running...${NC}"
pkill -f "cloudflared tunnel run" || true
echo -e "${GREEN}Cloudflared tunnel stopped (if it was running)${NC}"

# Step 2: Rebuild the applications
echo -e "${BLUE}==== Step 2: Rebuilding applications ====${NC}"

echo -e "${YELLOW}Building backend application...${NC}"
cd "${BACKEND_DIR}" && npm install
if [ $? -eq 0 ]; then
  echo -e "${GREEN}Backend dependencies installed successfully${NC}"
else
  echo -e "${RED}Failed to install backend dependencies${NC}"
  exit 1
fi

echo -e "${YELLOW}Building frontend application...${NC}"
cd "${FRONTEND_DIR}" && npm install && npm run build
if [ $? -eq 0 ]; then
  echo -e "${GREEN}Frontend built successfully${NC}"
else
  echo -e "${RED}Failed to build frontend${NC}"
  exit 1
fi

# Step 3: Recreate Docker images
echo -e "${BLUE}==== Step 3: Recreating Docker images ====${NC}"
cd "${PROJECT_ROOT}" && docker compose build
if [ $? -eq 0 ]; then
  echo -e "${GREEN}Docker images built successfully${NC}"
else
  echo -e "${RED}Failed to build Docker images${NC}"
  exit 1
fi

# Step 4: Run startup script
echo -e "${BLUE}==== Step 4: Starting all services ====${NC}"
bash "${STARTUP_SCRIPT}"
if [ $? -eq 0 ]; then
  echo -e "${GREEN}All services started successfully${NC}"
else
  echo -e "${RED}Failed to start services${NC}"
  exit 1
fi

# Wait for all services to be ready
echo -e "${YELLOW}Waiting for all services to be fully ready...${NC}"
sleep 15  # Give additional time for services to initialize

# Step 5: Run Cypress tests
echo -e "${BLUE}==== Step 5: Running Cypress end-to-end tests ====${NC}"
cd "${FRONTEND_DIR}"
npx cypress run
if [ $? -eq 0 ]; then
  echo -e "${GREEN}End-to-end tests passed successfully${NC}"
  TEST_RESULT="passed"
else
  echo -e "${RED}End-to-end tests failed${NC}"
  TEST_RESULT="failed"
fi

# Step 6: Report results
echo -e "${YELLOW}==== End-to-End Test Validation Results ====${NC}"
if [ "$TEST_RESULT" == "passed" ]; then
  echo -e "${GREEN}All tests passed successfully${NC}"
  exit 0
else
  echo -e "${RED}Tests failed. See test reports for details${NC}"
  exit 1
fi
