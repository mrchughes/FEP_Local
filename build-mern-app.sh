#!/bin/bash

# Build script for FEP MERN application
# This script builds both the backend and frontend of the MERN application

set -e  # Exit on any error

echo "======================================================================================="
echo "                       FEP MERN Application Build Script"
echo "======================================================================================="
echo ""

# Define directories
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/mern-app/backend"
FRONTEND_DIR="$ROOT_DIR/mern-app/frontend"

# Function to check if .env file exists and create if it doesn't
check_env_file() {
    local env_file="$1/.env"
    local template_file="$1/.env.template"
    
    if [ ! -f "$env_file" ] && [ -f "$template_file" ]; then
        echo "Creating .env file from template in $1"
        cp "$template_file" "$env_file"
        echo "Please update the .env file with your environment variables"
    elif [ ! -f "$env_file" ]; then
        echo "Warning: No .env file or template found in $1"
    fi
}

# Build backend
echo "Building backend..."
cd "$BACKEND_DIR"
check_env_file "$BACKEND_DIR"

# Install backend dependencies
echo "Installing backend dependencies..."
npm install

# Run any backend build steps (if needed)
if [ -f "package.json" ] && grep -q "\"build\"" "package.json"; then
    echo "Running backend build script..."
    npm run build
fi

echo "Backend build completed successfully!"
echo ""

# Build frontend
echo "Building frontend..."
cd "$FRONTEND_DIR"
check_env_file "$FRONTEND_DIR"

# Install frontend dependencies
echo "Installing frontend dependencies..."
npm install

# Build the frontend
echo "Running frontend build script..."
npm run build

echo "Frontend build completed successfully!"
echo ""

echo "======================================================================================="
echo "                       MERN Application Build Complete"
echo "======================================================================================="
echo ""
echo "To start the application:"
echo "1. Backend: cd $BACKEND_DIR && npm start"
echo "2. Frontend: cd $FRONTEND_DIR && npm start"
echo ""
