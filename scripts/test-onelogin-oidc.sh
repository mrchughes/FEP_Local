#!/bin/bash

# Test script for OneLogin OIDC integration
# This script runs a Node.js test to validate OneLogin OIDC configuration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../mern-app/backend"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js to run this test."
    exit 1
fi

# Check if required packages are installed
if [ ! -d "node_modules/axios" ] || [ ! -d "node_modules/dotenv" ]; then
    echo "Installing required packages..."
    npm install axios dotenv --no-save
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️ No .env file found. Using default values for testing."
    
    # Check if .env.example exists and copy it
    if [ -f ".env.example" ]; then
        echo "📝 Copying .env.example to .env"
        cp .env.example .env
        echo "⚠️ Please update .env with your actual OneLogin credentials before testing."
    fi
fi

echo "🔍 Running OneLogin OIDC integration test..."
node tests/onelogin-oidc-test.js

echo "✅ Test completed."
