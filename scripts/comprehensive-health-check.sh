#!/bin/bash

# Comprehensive Application Health Check
# This script performs a full end-to-end validation of the MERN app stack

set -e

echo "🔍 COMPREHENSIVE APPLICATION HEALTH CHECK"
echo "=========================================="
echo "Date: $(date)"
echo "Project: Cloud Apps Bundle - MERN Application"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Function to print status
print_status() {
    local status=$1
    local message=$2
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    case $status in
        "PASS")
            echo -e "${GREEN}✅ PASS${NC}: $message"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
            ;;
        "FAIL")
            echo -e "${RED}❌ FAIL${NC}: $message"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            ;;
        "WARN")
            echo -e "${YELLOW}⚠️  WARN${NC}: $message"
            WARNING_CHECKS=$((WARNING_CHECKS + 1))
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️  INFO${NC}: $message"
            ;;
    esac
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

echo "🛠️  1. DEVELOPMENT ENVIRONMENT CHECK"
echo "===================================="

# Check required tools
for tool in node npm docker terraform aws git; do
    if command_exists "$tool"; then
        VERSION=$($tool --version 2>/dev/null | head -1 || echo "Unknown version")
        print_status "PASS" "$tool is installed - $VERSION"
    else
        print_status "FAIL" "$tool is required but not installed"
    fi
done

# Check Node.js version
if command_exists node; then
    NODE_VERSION=$(node --version | sed 's/v//')
    if [[ $(echo "$NODE_VERSION" | cut -d. -f1) -ge 18 ]]; then
        print_status "PASS" "Node.js version $NODE_VERSION is compatible"
    else
        print_status "WARN" "Node.js version $NODE_VERSION may be outdated (recommend 18+)"
    fi
fi

echo ""

echo "📁 2. PROJECT STRUCTURE VALIDATION"
echo "=================================="

# Define expected structure
declare -A expected_files=(
    ["mern-app/frontend/package.json"]="Frontend package.json"
    ["mern-app/backend/package.json"]="Backend package.json" 
    ["mern-app/frontend/Dockerfile"]="Frontend Dockerfile"
    ["mern-app/backend/Dockerfile"]="Backend Dockerfile"
    ["mern-app/terraform/main.tf"]="MERN app Terraform config"
    ["shared-infra/terraform/main.tf"]="Shared infrastructure Terraform"
    ["python-app/app/app.py"]="Python app main file"
    ["python-app/terraform/main.tf"]="Python app Terraform config"
)

for file in "${!expected_files[@]}"; do
    if [[ -f "$file" ]]; then
        print_status "PASS" "${expected_files[$file]} exists"
    else
        print_status "FAIL" "${expected_files[$file]} missing at $file"
    fi
done

echo ""

echo "🔧 3. FRONTEND APPLICATION CHECK"
echo "==============================="

cd mern-app/frontend

# Check package.json
if [[ -f "package.json" ]]; then
    print_status "PASS" "Frontend package.json exists"
    
    # Check key dependencies
    if grep -q "\"react\"" package.json; then
        REACT_VERSION=$(grep "\"react\"" package.json | sed 's/.*"react": "\([^"]*\)".*/\1/')
        print_status "PASS" "React dependency found - version $REACT_VERSION"
    else
        print_status "FAIL" "React dependency missing"
    fi
    
    if grep -q "\"react-router-dom\"" package.json; then
        print_status "PASS" "React Router dependency found"
    else
        print_status "FAIL" "React Router dependency missing"
    fi
    
    # Check scripts
    if grep -q "\"start\"" package.json; then
        print_status "PASS" "Start script defined"
    else
        print_status "FAIL" "Start script missing"
    fi
    
    if grep -q "\"build\"" package.json; then
        print_status "PASS" "Build script defined"
    else
        print_status "FAIL" "Build script missing"
    fi
fi

# Check if node_modules exists or can be installed
if [[ -d "node_modules" ]]; then
    print_status "PASS" "Frontend node_modules exists"
else
    print_status "WARN" "Frontend node_modules missing - run 'npm install'"
fi

# Check key source files
key_files=("src/App.js" "src/index.js" "src/api.js" "src/styles/main.css")
for file in "${key_files[@]}"; do
    if [[ -f "$file" ]]; then
        print_status "PASS" "Frontend $file exists"
    else
        print_status "FAIL" "Frontend $file missing"
    fi
done

# Check Dockerfile
if [[ -f "Dockerfile" ]]; then
    print_status "PASS" "Frontend Dockerfile exists"
    
    # Check for proper Node.js base image
    if grep -q "FROM node:" Dockerfile; then
        print_status "PASS" "Frontend Dockerfile uses Node.js base image"
    else
        print_status "WARN" "Frontend Dockerfile may not use standard Node.js image"
    fi
    
    # Check for port exposure
    if grep -q "EXPOSE" Dockerfile; then
        PORT=$(grep "EXPOSE" Dockerfile | awk '{print $2}')
        print_status "PASS" "Frontend Dockerfile exposes port $PORT"
    else
        print_status "WARN" "Frontend Dockerfile doesn't specify exposed port"
    fi
fi

cd ../..

echo ""

echo "⚙️  4. BACKEND APPLICATION CHECK"
echo "==============================="

cd mern-app/backend

# Check package.json
if [[ -f "package.json" ]]; then
    print_status "PASS" "Backend package.json exists"
    
    # Check key dependencies
    deps=("express" "mongoose" "jsonwebtoken" "bcryptjs" "cors")
    for dep in "${deps[@]}"; do
        if grep -q "\"$dep\"" package.json; then
            print_status "PASS" "Backend dependency '$dep' found"
        else
            print_status "WARN" "Backend dependency '$dep' missing"
        fi
    done
    
    # Check main entry point
    if grep -q "\"main\"" package.json; then
        MAIN_FILE=$(grep "\"main\"" package.json | sed 's/.*"main": "\([^"]*\)".*/\1/')
        if [[ -f "$MAIN_FILE" ]]; then
            print_status "PASS" "Backend main file exists: $MAIN_FILE"
        else
            print_status "FAIL" "Backend main file missing: $MAIN_FILE"
        fi
    fi
fi

# Check key backend files
backend_files=("app.js" "server.js" "routes/authRoutes.js" "routes/formRoutes.js" "models/User.js")
for file in "${backend_files[@]}"; do
    if [[ -f "$file" ]]; then
        print_status "PASS" "Backend $file exists"
    else
        print_status "FAIL" "Backend $file missing"
    fi
done

# Check Dockerfile
if [[ -f "Dockerfile" ]]; then
    print_status "PASS" "Backend Dockerfile exists"
    
    if grep -q "FROM node:" Dockerfile; then
        print_status "PASS" "Backend Dockerfile uses Node.js base image"
    else
        print_status "WARN" "Backend Dockerfile may not use standard Node.js image"
    fi
    
    if grep -q "EXPOSE" Dockerfile; then
        PORT=$(grep "EXPOSE" Dockerfile | awk '{print $2}')
        print_status "PASS" "Backend Dockerfile exposes port $PORT"
    else
        print_status "WARN" "Backend Dockerfile doesn't specify exposed port"
    fi
fi

cd ../..

echo ""

echo "🐍 5. PYTHON APPLICATION CHECK"
echo "============================="

cd python-app

# Check Python app structure
if [[ -f "app/app.py" ]]; then
    print_status "PASS" "Python app main file exists"
else
    print_status "FAIL" "Python app main file missing"
fi

if [[ -f "app/requirements.txt" ]]; then
    print_status "PASS" "Python requirements.txt exists"
    
    # Check for key dependencies
    if grep -q "flask\|fastapi" app/requirements.txt; then
        print_status "PASS" "Python web framework dependency found"
    else
        print_status "WARN" "No obvious web framework in requirements.txt"
    fi
else
    print_status "FAIL" "Python requirements.txt missing"
fi

if [[ -f "app/Dockerfile" ]]; then
    print_status "PASS" "Python Dockerfile exists"
    
    if grep -q "FROM python:" app/Dockerfile; then
        print_status "PASS" "Python Dockerfile uses Python base image"
    else
        print_status "WARN" "Python Dockerfile may not use standard Python image"
    fi
else
    print_status "FAIL" "Python Dockerfile missing"
fi

cd ..

echo ""

echo "🏗️  6. TERRAFORM CONFIGURATION CHECK"
echo "==================================="

# Check shared infrastructure
echo "Checking shared infrastructure..."
cd shared-infra/terraform

if [[ -f "main.tf" ]]; then
    print_status "PASS" "Shared infrastructure main.tf exists"
    
    # Check for required providers
    if grep -q "aws" main.tf || grep -q "aws" provider.tf; then
        print_status "PASS" "AWS provider configured"
    else
        print_status "FAIL" "AWS provider not found"
    fi
    
    # Check for S3 backend
    if grep -q "backend.*s3" main.tf || grep -q "backend.*s3" *.tf; then
        print_status "PASS" "S3 backend configured for state management"
    else
        print_status "WARN" "S3 backend not configured - consider for production"
    fi
    
    # Check for VPC configuration
    if grep -q "aws_vpc\|vpc_id" *.tf; then
        print_status "PASS" "VPC configuration found"
    else
        print_status "WARN" "VPC configuration not found"
    fi
    
    # Check for Route53 configuration
    if grep -q "aws_route53\|route53" *.tf; then
        print_status "PASS" "Route53 DNS configuration found"
    else
        print_status "WARN" "Route53 DNS configuration not found"
    fi
    
    # Check for ACM certificate
    if grep -q "aws_acm_certificate\|acm" *.tf; then
        print_status "PASS" "ACM SSL certificate configuration found"
    else
        print_status "WARN" "ACM SSL certificate configuration not found"
    fi
else
    print_status "FAIL" "Shared infrastructure main.tf missing"
fi

cd ../..

# Check MERN app Terraform
echo "Checking MERN app Terraform..."
cd mern-app/terraform

if [[ -f "main.tf" ]]; then
    print_status "PASS" "MERN app main.tf exists"
    
    # Check for ECS configuration
    if grep -q "aws_ecs" *.tf; then
        print_status "PASS" "ECS configuration found"
    else
        print_status "WARN" "ECS configuration not found"
    fi
    
    # Check for ALB configuration
    if grep -q "aws_lb\|aws_alb" *.tf; then
        print_status "PASS" "Load balancer configuration found"
    else
        print_status "WARN" "Load balancer configuration not found"
    fi
    
    # Check for ECR repositories
    if grep -q "aws_ecr_repository" *.tf; then
        print_status "PASS" "ECR repository configuration found"
    else
        print_status "WARN" "ECR repository configuration not found"
    fi
else
    print_status "FAIL" "MERN app main.tf missing"
fi

cd ../..

# Check Python app Terraform
echo "Checking Python app Terraform..."
cd python-app/terraform

if [[ -f "main.tf" ]]; then
    print_status "PASS" "Python app main.tf exists"
else
    print_status "FAIL" "Python app main.tf missing"
fi

cd ../..

echo ""

echo "🐳 7. DOCKER CONFIGURATION CHECK"
echo "==============================="

# Check all Dockerfiles for consistency
dockerfiles=("mern-app/frontend/Dockerfile" "mern-app/backend/Dockerfile" "python-app/app/Dockerfile")
for dockerfile in "${dockerfiles[@]}"; do
    if [[ -f "$dockerfile" ]]; then
        print_status "PASS" "$dockerfile exists"
        
        # Check for multi-stage builds (optimization)
        if grep -q "FROM.*AS" "$dockerfile"; then
            print_status "PASS" "$dockerfile uses multi-stage build (optimized)"
        else
            print_status "INFO" "$dockerfile single-stage build (consider multi-stage for production)"
        fi
        
        # Check for proper user (security)
        if grep -q "USER" "$dockerfile"; then
            print_status "PASS" "$dockerfile sets non-root user (secure)"
        else
            print_status "WARN" "$dockerfile runs as root (security concern)"
        fi
        
        # Check for .dockerignore
        dockerfile_dir=$(dirname "$dockerfile")
        if [[ -f "$dockerfile_dir/.dockerignore" ]]; then
            print_status "PASS" "$dockerfile_dir has .dockerignore (optimized)"
        else
            print_status "WARN" "$dockerfile_dir missing .dockerignore (build optimization)"
        fi
    else
        print_status "FAIL" "$dockerfile missing"
    fi
done

echo ""

echo "🔗 8. PORT AND SERVICE ALIGNMENT CHECK"
echo "====================================="

# Extract ports from various configurations
echo "Checking port consistency across configurations..."

# Frontend ports
if [[ -f "mern-app/frontend/Dockerfile" ]]; then
    FRONTEND_DOCKER_PORT=$(grep "EXPOSE" mern-app/frontend/Dockerfile | awk '{print $2}' | head -1)
    if [[ -n "$FRONTEND_DOCKER_PORT" ]]; then
        print_status "INFO" "Frontend Docker port: $FRONTEND_DOCKER_PORT"
    fi
fi

# Backend ports
if [[ -f "mern-app/backend/Dockerfile" ]]; then
    BACKEND_DOCKER_PORT=$(grep "EXPOSE" mern-app/backend/Dockerfile | awk '{print $2}' | head -1)
    if [[ -n "$BACKEND_DOCKER_PORT" ]]; then
        print_status "INFO" "Backend Docker port: $BACKEND_DOCKER_PORT"
    fi
fi

# Check for port consistency in Terraform
if [[ -f "mern-app/terraform/main.tf" ]]; then
    if grep -q "container_port" mern-app/terraform/main.tf; then
        TF_PORTS=$(grep "container_port" mern-app/terraform/main.tf | awk '{print $3}' | tr -d '"')
        print_status "INFO" "Terraform container ports: $TF_PORTS"
    fi
fi

echo ""

echo "🏷️  9. NAMING CONVENTION CHECK"
echo "============================"

# Check ECR repository names in Terraform
if [[ -f "mern-app/terraform/main.tf" ]]; then
    if grep -q "aws_ecr_repository" mern-app/terraform/main.tf; then
        ECR_NAMES=$(grep -A 2 "aws_ecr_repository" mern-app/terraform/main.tf | grep "name" | awk -F'"' '{print $2}')
        for name in $ECR_NAMES; do
            if [[ "$name" =~ ^[a-z0-9-]+$ ]]; then
                print_status "PASS" "ECR repository name '$name' follows conventions"
            else
                print_status "WARN" "ECR repository name '$name' may not follow AWS conventions"
            fi
        done
    fi
fi

# Check for consistent resource naming in Terraform
terraform_files=$(find . -name "*.tf" -not -path "./.*")
for tf_file in $terraform_files; do
    # Check for consistent tag usage
    if grep -q "tags.*=" "$tf_file"; then
        print_status "PASS" "$tf_file includes resource tags"
    else
        print_status "WARN" "$tf_file missing resource tags"
    fi
done

echo ""

echo "🔒 10. SECURITY AND BEST PRACTICES CHECK"
echo "======================================="

# Check for secrets management
if grep -r "password\|secret\|key" --include="*.js" --include="*.py" --exclude-dir=node_modules . | grep -v "//\|#" | grep -v "console.log" >/dev/null; then
    print_status "WARN" "Potential hardcoded secrets found - review and use environment variables"
else
    print_status "PASS" "No obvious hardcoded secrets found"
fi

# Check for .env files in git
if git ls-files | grep "\.env$" >/dev/null 2>&1; then
    print_status "FAIL" ".env files tracked in git - add to .gitignore"
else
    print_status "PASS" "No .env files tracked in git"
fi

# Check for .gitignore
if [[ -f ".gitignore" ]]; then
    print_status "PASS" ".gitignore exists"
    
    if grep -q "node_modules" .gitignore; then
        print_status "PASS" ".gitignore excludes node_modules"
    else
        print_status "WARN" ".gitignore should exclude node_modules"
    fi
    
    if grep -q "\.env" .gitignore; then
        print_status "PASS" ".gitignore excludes .env files"
    else
        print_status "WARN" ".gitignore should exclude .env files"
    fi
else
    print_status "FAIL" ".gitignore missing"
fi

echo ""

echo "📦 11. DEPENDENCY CONSISTENCY CHECK"
echo "================================="

# Check for package-lock.json consistency
frontend_lock="mern-app/frontend/package-lock.json"
backend_lock="mern-app/backend/package-lock.json"

if [[ -f "$frontend_lock" ]]; then
    print_status "PASS" "Frontend package-lock.json exists (dependency locking)"
else
    print_status "WARN" "Frontend package-lock.json missing (run npm install)"
fi

if [[ -f "$backend_lock" ]]; then
    print_status "PASS" "Backend package-lock.json exists (dependency locking)"
else
    print_status "WARN" "Backend package-lock.json missing (run npm install)"
fi

# Check for Node.js version consistency
if [[ -f "mern-app/frontend/package.json" ]] && [[ -f "mern-app/backend/package.json" ]]; then
    FRONTEND_NODE=$(grep "\"node\":" mern-app/frontend/package.json | sed 's/.*"node": "\([^"]*\)".*/\1/' || echo "not specified")
    BACKEND_NODE=$(grep "\"node\":" mern-app/backend/package.json | sed 's/.*"node": "\([^"]*\)".*/\1/' || echo "not specified")
    
    if [[ "$FRONTEND_NODE" == "$BACKEND_NODE" ]]; then
        print_status "PASS" "Frontend and backend Node.js versions consistent"
    else
        print_status "WARN" "Frontend ($FRONTEND_NODE) and backend ($BACKEND_NODE) Node.js versions differ"
    fi
fi

echo ""

echo "🚀 12. DEPLOYMENT READINESS CHECK"
echo "==============================="

# Check if Terraform is initialized
terraform_dirs=("shared-infra/terraform" "mern-app/terraform" "python-app/terraform")
for tf_dir in "${terraform_dirs[@]}"; do
    if [[ -d "$tf_dir/.terraform" ]]; then
        print_status "PASS" "$tf_dir is initialized"
    else
        print_status "WARN" "$tf_dir not initialized (run terraform init)"
    fi
done

# Check for CI/CD configuration
ci_configs=(".github/workflows" ".gitlab-ci.yml" "buildspec.yml" "Jenkinsfile")
ci_found=false
for config in "${ci_configs[@]}"; do
    if [[ -f "$config" ]] || [[ -d "$config" ]]; then
        print_status "PASS" "CI/CD configuration found: $config"
        ci_found=true
    fi
done
if [[ "$ci_found" == false ]]; then
    print_status "WARN" "No CI/CD configuration found"
fi

# Check for production environment variables
if [[ -f ".env.example" ]] || [[ -f ".env.template" ]]; then
    print_status "PASS" "Environment variable template found"
else
    print_status "WARN" "No environment variable template found"
fi

echo ""

echo "📊 HEALTH CHECK SUMMARY"
echo "======================"
echo "Total Checks: $TOTAL_CHECKS"
echo -e "${GREEN}Passed: $PASSED_CHECKS${NC}"
echo -e "${YELLOW}Warnings: $WARNING_CHECKS${NC}"
echo -e "${RED}Failed: $FAILED_CHECKS${NC}"
echo ""

# Calculate health score
HEALTH_SCORE=$(( (PASSED_CHECKS * 100) / TOTAL_CHECKS ))

if [[ $FAILED_CHECKS -eq 0 ]]; then
    if [[ $WARNING_CHECKS -eq 0 ]]; then
        echo -e "${GREEN}🎉 EXCELLENT! All checks passed. Ready for deployment!${NC}"
    elif [[ $WARNING_CHECKS -le 5 ]]; then
        echo -e "${GREEN}✅ GOOD! No critical issues. Address warnings for optimal deployment.${NC}"
    else
        echo -e "${YELLOW}⚠️  OKAY! Consider addressing warnings before deployment.${NC}"
    fi
else
    if [[ $FAILED_CHECKS -le 3 ]]; then
        echo -e "${YELLOW}⚠️  NEEDS ATTENTION! Fix critical issues before deployment.${NC}"
    else
        echo -e "${RED}❌ NOT READY! Multiple critical issues need to be resolved.${NC}"
    fi
fi

echo ""
echo -e "Health Score: ${BLUE}$HEALTH_SCORE%${NC}"
echo ""

# Recommendations
echo "🎯 RECOMMENDATIONS FOR DEPLOYMENT SUCCESS:"
echo "========================================="

if [[ $FAILED_CHECKS -gt 0 ]]; then
    echo "1. 🔴 Fix all FAILED checks before proceeding"
fi

if grep -q "WARN.*node_modules" <<< "$(cat /tmp/health_check_output 2>/dev/null || echo '')"; then
    echo "2. 🟡 Run 'npm install' in frontend and backend directories"
fi

if grep -q "WARN.*terraform.*init" <<< "$(cat /tmp/health_check_output 2>/dev/null || echo '')"; then
    echo "3. 🟡 Initialize Terraform in all directories with 'terraform init'"
fi

if [[ $WARNING_CHECKS -gt 0 ]]; then
    echo "4. 🟡 Review and address WARNING items for production readiness"
fi

echo "5. ✅ Test the application locally before deploying"
echo "6. ✅ Verify AWS credentials and permissions"
echo "7. ✅ Ensure domain DNS is properly configured"
echo "8. ✅ Run 'terraform plan' to preview infrastructure changes"

echo ""
echo "📋 NEXT STEPS:"
echo "============="
echo "1. Address any FAILED checks above"
echo "2. Run: cd mern-app/frontend && npm install && npm run build"
echo "3. Run: cd mern-app/backend && npm install"
echo "4. Run: cd shared-infra/terraform && terraform init && terraform plan"
echo "5. Run: cd mern-app/terraform && terraform init && terraform plan"
echo "6. If plans look good: terraform apply"
echo ""

echo "🔗 For deployment help, see:"
echo "- docs/SSL_CERTIFICATE_MANAGEMENT.md"
echo "- docs/SSL_QUICK_CHECK.md"
echo "- DEPLOYMENT.md"
