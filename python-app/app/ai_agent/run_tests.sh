#!/bin/bash

# Navigate to the AI Agent directory
cd "$(dirname "$0")"

# Check if virtual environment exists, create if not
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install requirements
echo "Installing test requirements..."
pip install -r requirements-test.txt

# Run the tests
echo "Running tests..."
pytest tests/ --cov=. --cov-report=term-missing

# Deactivate virtual environment
deactivate
