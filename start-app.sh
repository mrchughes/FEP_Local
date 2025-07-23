#!/bin/bash

# FEP Application Start Script
# This script starts all components of the FEP application

set -e  # Exit on any error

echo "======================================================================================="
echo "                       Starting FEP Application"
echo "======================================================================================="
echo ""

# Check MongoDB status
echo "Checking MongoDB status..."
if command -v mongo &> /dev/null; then
    MONGO_STATUS=$(pgrep mongod > /dev/null && echo "running" || echo "not running")
    if [ "$MONGO_STATUS" == "not running" ]; then
        echo "MongoDB is not running. Attempting to start..."
        if command -v brew &> /dev/null; then
            echo "Starting MongoDB with Homebrew..."
            brew services start mongodb-community
        else
            echo "Warning: MongoDB is not running. Please start MongoDB manually."
        fi
    else
        echo "MongoDB is running."
    fi
else
    echo "MongoDB command not found. Please ensure MongoDB is installed and running."
fi

# Define directories
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/mern-app/backend"
FRONTEND_DIR="$ROOT_DIR/mern-app/frontend"
PYTHON_DIR="$ROOT_DIR/python-app/app"

# Function to check if a port is in use
port_in_use() {
    lsof -i:$1 &> /dev/null
}

# Start backend
if port_in_use 5000; then
    echo "Warning: Port 5000 is already in use. Backend may already be running."
else
    echo "Starting backend server..."
    cd "$BACKEND_DIR"
    npm start &
    sleep 2  # Give backend time to start
fi

# Start frontend
if port_in_use 3000; then
    echo "Warning: Port 3000 is already in use. Frontend may already be running."
else
    echo "Starting frontend server..."
    cd "$FRONTEND_DIR"
    npm start &
    sleep 2  # Give frontend time to start
fi

# Start Python agent (if applicable)
if [ -d "$PYTHON_DIR" ]; then
    if port_in_use 5001; then
        echo "Warning: Port 5001 is already in use. Python agent may already be running."
    else
        echo "Starting Python agent..."
        cd "$PYTHON_DIR"
        
        # Check if virtual environment exists
        if [ -d "venv" ]; then
            # Activate virtual environment based on platform
            if [[ "$OSTYPE" == "darwin"* || "$OSTYPE" == "linux-gnu"* ]]; then
                source venv/bin/activate
            elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
                source venv/Scripts/activate
            fi
            
            echo "Running Python agent..."
            python app.py &
        else
            echo "Warning: Python virtual environment not found. Please run setup-dev-environment.sh first."
        fi
    fi
fi

echo ""
echo "======================================================================================="
echo "                       FEP Application Started"
echo "======================================================================================="
echo ""
echo "Access the application at:"
echo "- Frontend: http://localhost:3000"
echo "- Backend API: http://localhost:5000"
if [ -d "$PYTHON_DIR" ]; then
    echo "- Python Agent API: http://localhost:5001"
fi
echo ""
echo "Press Ctrl+C to stop all services."
echo ""

# Wait for all background processes
wait
