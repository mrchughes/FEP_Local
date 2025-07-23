#!/bin/bash

# Development Environment Setup Script for FEP Application
# This script sets up the development environment for the FEP application

set -e  # Exit on any error

echo "======================================================================================="
echo "                       FEP Development Environment Setup"
echo "======================================================================================="
echo ""

# Define directories
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/mern-app/backend"
FRONTEND_DIR="$ROOT_DIR/mern-app/frontend"
PYTHON_DIR="$ROOT_DIR/python-app/app"

# Install root dependencies
echo "Installing root dependencies..."
npm install

# Setup backend
echo "Setting up backend..."
cd "$BACKEND_DIR"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    if [ -f .env.template ]; then
        echo "Creating .env file from template"
        cp .env.template .env
        echo "Please update the .env file with your environment variables"
    else
        echo "Warning: No .env.template file found for backend"
        cat > .env << EOF
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/fep
JWT_SECRET=your_jwt_secret_here
FRONTEND_URL=http://localhost:3000
AI_AGENT_URL=http://localhost:5001
SESSION_SECRET=your_session_secret_here
EOF
        echo "Created default .env file. Please update with your settings."
    fi
fi

# Install backend dependencies
echo "Installing backend dependencies..."
npm install

# Setup frontend
echo "Setting up frontend..."
cd "$FRONTEND_DIR"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    if [ -f .env.template ]; then
        echo "Creating .env file from template"
        cp .env.template .env
        echo "Please update the .env file with your environment variables"
    else
        echo "Warning: No .env.template file found for frontend"
        cat > .env << EOF
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_PDS_ENABLED=true
EOF
        echo "Created default .env file. Please update with your settings."
    fi
fi

# Install frontend dependencies
echo "Installing frontend dependencies..."
npm install

# Setup Python environment (if applicable)
if [ -d "$PYTHON_DIR" ]; then
    echo "Setting up Python environment..."
    cd "$PYTHON_DIR"
    
    # Check if requirements.txt exists
    if [ -f "requirements.txt" ]; then
        echo "Creating Python virtual environment..."
        python3 -m venv venv
        
        # Activate virtual environment based on platform
        if [[ "$OSTYPE" == "darwin"* || "$OSTYPE" == "linux-gnu"* ]]; then
            source venv/bin/activate
        elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
            source venv/Scripts/activate
        fi
        
        echo "Installing Python dependencies..."
        pip install -r requirements.txt
        
        # Create .env file if it doesn't exist
        if [ ! -f .env ]; then
            if [ -f .env.template ]; then
                echo "Creating .env file from template"
                cp .env.template .env
                echo "Please update the .env file with your environment variables"
            else
                echo "Warning: No .env.template file found for Python app"
                cat > .env << EOF
FLASK_APP=app.py
FLASK_ENV=development
FLASK_DEBUG=1
BACKEND_URL=http://localhost:5000
EOF
                echo "Created default .env file. Please update with your settings."
            fi
        fi
    else
        echo "Warning: No requirements.txt found for Python app"
    fi
fi

echo ""
echo "======================================================================================="
echo "                       Development Environment Setup Complete"
echo "======================================================================================="
echo ""
echo "You can now start the application with:"
echo "- Backend: cd $BACKEND_DIR && npm start"
echo "- Frontend: cd $FRONTEND_DIR && npm start"
if [ -d "$PYTHON_DIR" ]; then
    echo "- Python Agent: cd $PYTHON_DIR && source venv/bin/activate && python app.py"
fi
echo ""
echo "Or use the convenience scripts:"
echo "- Start all: npm run start:all"
echo "- Build: npm run build"
echo ""
