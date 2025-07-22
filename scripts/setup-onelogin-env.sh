#!/bin/bash
# Script to update environment variables for OneLogin integration

echo "FEP OneLogin Integration Environment Setup"
echo "-----------------------------------------"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
DOMAIN="fep.local"
ONELOGIN_URL="https://onelogin.gov.uk"
BACKEND_URL="http://localhost:5000"
FRONTEND_URL="http://localhost:3000"

# Check if .env exists
BACKEND_ENV_FILE="./mern-app/backend/.env"
FRONTEND_ENV_FILE="./mern-app/frontend/.env"

# Function to update or add a variable to an env file
update_env_var() {
  local file=$1
  local var_name=$2
  local var_value=$3
  
  # Create file if it doesn't exist
  if [ ! -f "$file" ]; then
    touch "$file"
    echo "Created $file"
  fi
  
  # Check if variable exists
  if grep -q "^$var_name=" "$file"; then
    # Update existing variable
    sed -i '' "s|^$var_name=.*|$var_name=$var_value|" "$file"
  else
    # Add new variable
    echo "$var_name=$var_value" >> "$file"
  fi
}

echo -e "${YELLOW}Setting up OneLogin integration environment variables...${NC}"

# Prompt for variables
read -p "Enter your domain (default: $DOMAIN): " input
DOMAIN=${input:-$DOMAIN}

read -p "Enter OneLogin URL (default: $ONELOGIN_URL): " input
ONELOGIN_URL=${input:-$ONELOGIN_URL}

read -p "Enter backend URL (default: $BACKEND_URL): " input
BACKEND_URL=${input:-$BACKEND_URL}

read -p "Enter frontend URL (default: $FRONTEND_URL): " input
FRONTEND_URL=${input:-$FRONTEND_URL}

read -p "Enter OneLogin Client ID: " CLIENT_ID
if [ -z "$CLIENT_ID" ]; then
  echo -e "${RED}Client ID is required${NC}"
  exit 1
fi

read -p "Enter OneLogin Client Secret: " CLIENT_SECRET
if [ -z "$CLIENT_SECRET" ]; then
  echo -e "${RED}Client Secret is required${NC}"
  exit 1
fi

# Generate secrets if they don't exist
JWT_SECRET=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)

# Update backend .env
echo -e "${YELLOW}Updating backend environment variables...${NC}"
update_env_var "$BACKEND_ENV_FILE" "OIDC_PROVIDER_URL" "$ONELOGIN_URL"
update_env_var "$BACKEND_ENV_FILE" "CLIENT_ID" "$CLIENT_ID"
update_env_var "$BACKEND_ENV_FILE" "CLIENT_SECRET" "$CLIENT_SECRET"
update_env_var "$BACKEND_ENV_FILE" "REDIRECT_URI" "${BACKEND_URL}/auth/onelogin-callback"
update_env_var "$BACKEND_ENV_FILE" "FEP_DOMAIN" "$DOMAIN"
update_env_var "$BACKEND_ENV_FILE" "JWT_SECRET" "$JWT_SECRET"
update_env_var "$BACKEND_ENV_FILE" "SESSION_SECRET" "$SESSION_SECRET"
update_env_var "$BACKEND_ENV_FILE" "SERVICE_DOMAIN" "$DOMAIN"
update_env_var "$BACKEND_ENV_FILE" "SERVICE_DID" "did:web:$DOMAIN"
update_env_var "$BACKEND_ENV_FILE" "SERVICE_URL" "$BACKEND_URL"
update_env_var "$BACKEND_ENV_FILE" "FRONTEND_URL" "$FRONTEND_URL"

# Update frontend .env
echo -e "${YELLOW}Updating frontend environment variables...${NC}"
update_env_var "$FRONTEND_ENV_FILE" "REACT_APP_API_URL" "$BACKEND_URL"

echo -e "${GREEN}Environment variables updated successfully!${NC}"
echo ""
echo -e "${YELLOW}Backend variables set in:${NC} $BACKEND_ENV_FILE"
echo -e "${YELLOW}Frontend variables set in:${NC} $FRONTEND_ENV_FILE"
echo ""
echo "To test the integration:"
echo "1. Start the backend server"
echo "2. Start the frontend server"
echo "3. Visit the login page and click 'Sign in with GOV.UK OneLogin'"
echo ""
echo "For more information, see docs/ONELOGIN-INTEGRATION.md"
