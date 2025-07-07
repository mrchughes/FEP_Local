#!/bin/bash

# ECR Repository and Container Image Validation Script
# Validates ECR repository names, container image references, and deployment pipeline consistency

set -e

echo "🐳 ECR REPOSITORY & CONTAINER IMAGE VALIDATION"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

VALIDATION_FAILED=false

# Function to report validation results
report_result() {
    local component="$1"
    local check="$2"
    local expected="$3"
    local actual="$4"
    local file="$5"
    
    if [ "$expected" = "$actual" ]; then
        echo -e "  ✅ ${GREEN}$check${NC}: $actual ($file)"
    else
        echo -e "  ❌ ${RED}$check${NC}: Expected '$expected', got '$actual' ($file)"
        VALIDATION_FAILED=true
    fi
}

# 1. Validate ECR repository names in shared infrastructure
echo -e "\n${BLUE}📊 Shared Infrastructure ECR Configuration${NC}"
echo "============================================="

SHARED_INFRA_ECR_MODULE="shared-infra/terraform/modules/ecr/main.tf"
if [ -f "$SHARED_INFRA_ECR_MODULE" ]; then
    # Extract expected repository names
    FRONTEND_REPO=$(grep -A 5 'resource "aws_ecr_repository" "app1_frontend"' "$SHARED_INFRA_ECR_MODULE" | grep 'name.*=' | sed 's/.*name.*=.*"\([^"]*\)".*/\1/')
    BACKEND_REPO=$(grep -A 5 'resource "aws_ecr_repository" "app1_backend"' "$SHARED_INFRA_ECR_MODULE" | grep 'name.*=' | sed 's/.*name.*=.*"\([^"]*\)".*/\1/')
    PYTHON_REPO=$(grep -A 5 'resource "aws_ecr_repository" "app2"' "$SHARED_INFRA_ECR_MODULE" | grep 'name.*=' | sed 's/.*name.*=.*"\([^"]*\)".*/\1/')
    
    echo "Expected ECR repository names:"
    echo "  Frontend: $FRONTEND_REPO"
    echo "  Backend: $BACKEND_REPO"
    echo "  Python: $PYTHON_REPO"
else
    echo -e "${RED}❌ ECR module not found: $SHARED_INFRA_ECR_MODULE${NC}"
    VALIDATION_FAILED=true
fi

# 2. Validate MERN app Terraform ECR references
echo -e "\n${BLUE}🔧 MERN App ECR References${NC}"
echo "=============================="

MERN_TERRAFORM="mern-app/terraform/main.tf"
if [ -f "$MERN_TERRAFORM" ]; then
    # Check if task definitions use the correct variable references
    FRONTEND_IMAGE_REF=$(grep -A 10 'container_definitions.*jsonencode' "$MERN_TERRAFORM" | grep 'image.*=' | head -1 | sed 's/.*image.*=.*\(var\.[^,]*\).*/\1/')
    BACKEND_IMAGE_REF=$(grep -A 10 'container_definitions.*jsonencode' "$MERN_TERRAFORM" | grep 'image.*=' | tail -1 | sed 's/.*image.*=.*\(var\.[^,]*\).*/\1/')
    
    report_result "MERN Frontend" "Image Variable" "var.ecr_repo_frontend" "$FRONTEND_IMAGE_REF" "$MERN_TERRAFORM"
    report_result "MERN Backend" "Image Variable" "var.ecr_repo_backend" "$BACKEND_IMAGE_REF" "$MERN_TERRAFORM"
    
    # Check variable definitions
    if grep -q 'variable "ecr_repo_frontend"' "$MERN_TERRAFORM" || grep -q 'variable "ecr_repo_frontend"' "mern-app/terraform/variables.tf"; then
        echo -e "  ✅ ${GREEN}Frontend variable defined${NC}"
    else
        echo -e "  ❌ ${RED}Frontend variable missing${NC}"
        VALIDATION_FAILED=true
    fi
    
    if grep -q 'variable "ecr_repo_backend"' "$MERN_TERRAFORM" || grep -q 'variable "ecr_repo_backend"' "mern-app/terraform/variables.tf"; then
        echo -e "  ✅ ${GREEN}Backend variable defined${NC}"
    else
        echo -e "  ❌ ${RED}Backend variable missing${NC}"
        VALIDATION_FAILED=true
    fi
fi

# 3. Validate GitHub Actions workflow ECR handling
echo -e "\n${BLUE}🚀 GitHub Actions Workflow ECR Configuration${NC}"
echo "==============================================="

WORKFLOW_FILE=".github/workflows/monorepo-deploy.yml"
if [ -f "$WORKFLOW_FILE" ]; then
    # Check output variable names
    FRONTEND_OUTPUT=$(grep 'ecr_frontend:' "$WORKFLOW_FILE" | head -1 | sed 's/.*ecr_frontend: \${{ \([^}]*\) }}.*/\1/')
    BACKEND_OUTPUT=$(grep 'ecr_backend:' "$WORKFLOW_FILE" | head -1 | sed 's/.*ecr_backend: \${{ \([^}]*\) }}.*/\1/')
    
    echo "Workflow output mappings:"
    echo "  Frontend: $FRONTEND_OUTPUT"
    echo "  Backend: $BACKEND_OUTPUT"
    
    # Check if the terraform output extraction matches what the MERN job expects
    if grep -q 'ecr_frontend.*terraform output.*ecr_repo_frontend' "$WORKFLOW_FILE"; then
        echo -e "  ✅ ${GREEN}Frontend output mapping correct${NC}"
    else
        echo -e "  ❌ ${RED}Frontend output mapping incorrect${NC}"
        VALIDATION_FAILED=true
    fi
    
    if grep -q 'ecr_backend.*terraform output.*ecr_repo_backend' "$WORKFLOW_FILE"; then
        echo -e "  ✅ ${GREEN}Backend output mapping correct${NC}"
    else
        echo -e "  ❌ ${RED}Backend output mapping incorrect${NC}"
        VALIDATION_FAILED=true
    fi
    
    # Check Docker build commands
    echo -e "\n${BLUE}🐳 Docker Build Commands${NC}"
    
    # Frontend build (check for multi-line docker build command)
    if grep -A 10 'docker build -f mern-app/frontend/Dockerfile.frontend' "$WORKFLOW_FILE" | grep -q 'mern-app/frontend/'; then
        echo -e "  ✅ ${GREEN}Frontend Docker build path correct${NC}"
    else
        echo -e "  ❌ ${RED}Frontend Docker build path incorrect${NC}"
        VALIDATION_FAILED=true
    fi
    
    # Backend build
    if grep -q 'docker build.*Dockerfile.backend.*mern-app/backend' "$WORKFLOW_FILE"; then
        echo -e "  ✅ ${GREEN}Backend Docker build path correct${NC}"
    else
        echo -e "  ❌ ${RED}Backend Docker build path incorrect${NC}"
        VALIDATION_FAILED=true
    fi
    
    # Check variable passing to terraform
    if grep -q 'ecr_repo_frontend.*FRONTEND_IMAGE' "$WORKFLOW_FILE"; then
        echo -e "  ✅ ${GREEN}Frontend variable passing correct${NC}"
    else
        echo -e "  ❌ ${RED}Frontend variable passing incorrect${NC}"
        VALIDATION_FAILED=true
    fi
    
    if grep -q 'ecr_repo_backend.*BACKEND_IMAGE' "$WORKFLOW_FILE"; then
        echo -e "  ✅ ${GREEN}Backend variable passing correct${NC}"
    else
        echo -e "  ❌ ${RED}Backend variable passing incorrect${NC}"
        VALIDATION_FAILED=true
    fi
fi

# 4. Validate Python app ECR references (if applicable)
echo -e "\n${BLUE}🐍 Python App ECR References${NC}"
echo "=============================="

PYTHON_TERRAFORM="python-app/terraform/main.tf"
if [ -f "$PYTHON_TERRAFORM" ]; then
    if grep -q 'var.ecr_repo_app2' "$PYTHON_TERRAFORM"; then
        echo -e "  ✅ ${GREEN}Python app ECR variable reference correct${NC}"
    else
        echo -e "  ❌ ${RED}Python app ECR variable reference incorrect${NC}"
        VALIDATION_FAILED=true
    fi
fi

# 5. Dockerfile validation
echo -e "\n${BLUE}📦 Dockerfile Configuration${NC}"
echo "============================="

# Check if Dockerfiles exist and have correct names
DOCKERFILES=(
    "mern-app/frontend/Dockerfile.frontend"
    "mern-app/backend/Dockerfile.backend"
    "python-app/app/Dockerfile"
)

for dockerfile in "${DOCKERFILES[@]}"; do
    if [ -f "$dockerfile" ]; then
        echo -e "  ✅ ${GREEN}Found: $dockerfile${NC}"
    else
        echo -e "  ❌ ${RED}Missing: $dockerfile${NC}"
        VALIDATION_FAILED=true
    fi
done

# Final result
echo -e "\n${BLUE}📊 VALIDATION SUMMARY${NC}"
echo "====================="

if [ "$VALIDATION_FAILED" = false ]; then
    echo -e "${GREEN}🎉 ALL ECR & CONTAINER VALIDATIONS PASSED${NC}"
    echo -e "${GREEN}✅ Repository names, variable mappings, and Docker configurations are consistent${NC}"
    exit 0
else
    echo -e "${RED}❌ ECR & CONTAINER VALIDATION FAILED${NC}"
    echo -e "${RED}🔧 Fix the issues above before deploying${NC}"
    echo -e "${YELLOW}💡 This validation should have caught the repository misalignment issues!${NC}"
    exit 1
fi
