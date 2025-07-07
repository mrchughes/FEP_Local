#!/bin/bash
# Port Alignment Validation Script
# Ensures all ports are consistent across Docker, Terraform, and ALB configurations

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🔍 PORT ALIGNMENT VALIDATION"
echo "================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

VALIDATION_FAILED=0

# Function to report validation results
report_validation() {
    local service="$1"
    local layer="$2"
    local expected_port="$3"
    local actual_port="$4"
    local file_path="$5"
    
    if [ "$expected_port" = "$actual_port" ]; then
        echo -e "  ✅ ${GREEN}$layer${NC}: Port $actual_port (${file_path})"
    else
        echo -e "  ❌ ${RED}$layer${NC}: Expected $expected_port, got $actual_port (${file_path})"
        VALIDATION_FAILED=1
    fi
}

# Function to extract port from file
extract_port() {
    local file="$1"
    local pattern="$2"
    local default="$3"
    
    if [ -f "$file" ]; then
        grep -o "$pattern" "$file" | head -1 | grep -o '[0-9]\+' || echo "$default"
    else
        echo "$default"
    fi
}

echo "📋 Service Port Configuration Analysis:"
echo ""

# === MERN FRONTEND ===
echo -e "${BLUE}🌐 MERN Frontend${NC}"
FRONTEND_EXPECTED_PORT=80

# Docker
FRONTEND_DOCKER_PORT=$(extract_port "$REPO_ROOT/mern-app/frontend/Dockerfile.frontend" "EXPOSE [0-9]\+" "80")
report_validation "MERN Frontend" "Docker" "$FRONTEND_EXPECTED_PORT" "$FRONTEND_DOCKER_PORT" "mern-app/frontend/Dockerfile.frontend"

# Terraform container port
FRONTEND_CONTAINER_PORT=$(extract_port "$REPO_ROOT/mern-app/terraform/main.tf" "containerPort = [0-9]\+" "80")
report_validation "MERN Frontend" "Terraform Container" "$FRONTEND_EXPECTED_PORT" "$FRONTEND_CONTAINER_PORT" "mern-app/terraform/main.tf"

# ALB Target Group (from shared-infra)
FRONTEND_TG_PORT=$(extract_port "$REPO_ROOT/shared-infra/terraform/modules/alb/main.tf" "port        = [0-9]\+" "80")
report_validation "MERN Frontend" "ALB Target Group" "$FRONTEND_EXPECTED_PORT" "$FRONTEND_TG_PORT" "shared-infra/terraform/modules/alb/main.tf (app1_tg)"

echo ""

# === MERN BACKEND ===
echo -e "${BLUE}🔧 MERN Backend${NC}"
BACKEND_EXPECTED_PORT=5000

# Docker
BACKEND_DOCKER_PORT=$(extract_port "$REPO_ROOT/mern-app/backend/Dockerfile.backend" "EXPOSE [0-9]\+" "5000")
report_validation "MERN Backend" "Docker" "$BACKEND_EXPECTED_PORT" "$BACKEND_DOCKER_PORT" "mern-app/backend/Dockerfile.backend"

# Application code
BACKEND_APP_PORT=$(extract_port "$REPO_ROOT/mern-app/backend/.env.example" "PORT=[0-9]\+" "5000")
report_validation "MERN Backend" "App Config" "$BACKEND_EXPECTED_PORT" "$BACKEND_APP_PORT" "mern-app/backend/.env.example"

# Terraform container port (backend task definition)
BACKEND_CONTAINER_PORT=$(grep -A 10 "backend" "$REPO_ROOT/mern-app/terraform/main.tf" | grep "containerPort" | grep -o '[0-9]\+' | head -1 || echo "5000")
report_validation "MERN Backend" "Terraform Container" "$BACKEND_EXPECTED_PORT" "$BACKEND_CONTAINER_PORT" "mern-app/terraform/main.tf"

# ALB Target Group for backend API
BACKEND_TG_PORT=$(grep -A 5 "backend_api" "$REPO_ROOT/shared-infra/terraform/modules/alb/main.tf" | grep "port" | grep -o '[0-9]\+' | head -1 || echo "5000")
report_validation "MERN Backend" "ALB Target Group" "$BACKEND_EXPECTED_PORT" "$BACKEND_TG_PORT" "shared-infra/terraform/modules/alb/main.tf (backend_api_tg)"

echo ""

# === PYTHON APP ===
echo -e "${BLUE}🐍 Python App${NC}"
PYTHON_EXPECTED_PORT=80

# Docker
PYTHON_DOCKER_PORT=$(extract_port "$REPO_ROOT/python-app/app/Dockerfile" "EXPOSE [0-9]\+" "80")
report_validation "Python App" "Docker" "$PYTHON_EXPECTED_PORT" "$PYTHON_DOCKER_PORT" "python-app/app/Dockerfile"

# Gunicorn configuration
PYTHON_GUNICORN_PORT=$(grep -o "0.0.0.0:[0-9]\+" "$REPO_ROOT/python-app/app/Dockerfile" | grep -o '[0-9]\+$' || echo "80")
report_validation "Python App" "Gunicorn Config" "$PYTHON_EXPECTED_PORT" "$PYTHON_GUNICORN_PORT" "python-app/app/Dockerfile"

# Application code (if __name__ == "__main__")
PYTHON_APP_PORT=$(extract_port "$REPO_ROOT/python-app/app/app.py" "port=[0-9]\+" "80")
report_validation "Python App" "App Code" "$PYTHON_EXPECTED_PORT" "$PYTHON_APP_PORT" "python-app/app/app.py"

# Terraform container port
PYTHON_CONTAINER_PORT=$(extract_port "$REPO_ROOT/python-app/terraform/main.tf" "containerPort = [0-9]\+" "80")
report_validation "Python App" "Terraform Container" "$PYTHON_EXPECTED_PORT" "$PYTHON_CONTAINER_PORT" "python-app/terraform/main.tf"

# ALB Target Group (app2)
PYTHON_TG_PORT=$(grep -A 5 "app2" "$REPO_ROOT/shared-infra/terraform/modules/alb/main.tf" | grep "port" | grep -o '[0-9]\+' | head -1 || echo "80")
report_validation "Python App" "ALB Target Group" "$PYTHON_EXPECTED_PORT" "$PYTHON_TG_PORT" "shared-infra/terraform/modules/alb/main.tf (app2_tg)"

echo ""
echo "================================"

if [ $VALIDATION_FAILED -eq 0 ]; then
    echo -e "🎉 ${GREEN}PORT ALIGNMENT: ALL CHECKS PASSED${NC}"
    echo "✅ All services have consistent port configurations"
    exit 0
else
    echo -e "⚠️  ${RED}PORT ALIGNMENT: VALIDATION FAILED${NC}"
    echo "❌ Port mismatches detected - deployment may fail"
    echo ""
    echo "🔧 To fix port alignment issues:"
    echo "1. Ensure Docker EXPOSE matches application port"
    echo "2. Ensure Terraform containerPort matches Docker EXPOSE"
    echo "3. Ensure ALB target group port matches containerPort"
    echo "4. Ensure application code listens on the correct port"
    exit 1
fi
