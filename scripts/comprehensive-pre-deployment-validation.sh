#!/bin/bash

# Comprehensive Pre-Deployment Validation Script
# Checks name alignment, configuration consistency, and timing dependencies

set -e

echo "🔍 COMPREHENSIVE PRE-DEPLOYMENT VALIDATION"
echo "==========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

VALIDATION_FAILED=false
ISSUES_FOUND=()
WARNINGS_FOUND=()

# Function to report issues
report_issue() {
    echo -e "  ${RED}❌ $1${NC}"
    ISSUES_FOUND+=("$1")
    VALIDATION_FAILED=true
}

report_warning() {
    echo -e "  ${YELLOW}⚠️  $1${NC}"
    WARNINGS_FOUND+=("$1")
}

report_success() {
    echo -e "  ${GREEN}✅ $1${NC}"
}

echo -e "\n${BLUE}1. ECR REPOSITORY NAME ALIGNMENT${NC}"
echo "================================="

# Check actual ECR repositories
if aws ecr describe-repositories --region eu-west-2 &>/dev/null; then
    ECR_REPOS=$(aws ecr describe-repositories --region eu-west-2 --query 'repositories[*].repositoryName' --output text)
    echo "Actual ECR repositories: $ECR_REPOS"
    
    # Check expected repositories exist
    if echo "$ECR_REPOS" | grep -q "mern-app-frontend"; then
        report_success "mern-app-frontend repository exists"
    else
        report_issue "mern-app-frontend repository missing"
    fi
    
    if echo "$ECR_REPOS" | grep -q "mern-app-backend"; then
        report_success "mern-app-backend repository exists"
    else
        report_issue "mern-app-backend repository missing"
    fi
else
    report_issue "Cannot access ECR repositories"
fi

echo -e "\n${BLUE}2. TERRAFORM CONFIGURATION VALIDATION${NC}"
echo "====================================="

# Check MERN app variable definitions
if [ -f "mern-app/terraform/variables.tf" ]; then
    if grep -q "variable \"ecr_repo_frontend\"" mern-app/terraform/variables.tf; then
        report_success "Frontend ECR variable defined"
    else
        report_issue "Frontend ECR variable missing from variables.tf"
    fi
    
    if grep -q "variable \"ecr_repo_backend\"" mern-app/terraform/variables.tf; then
        report_success "Backend ECR variable defined"
    else
        report_issue "Backend ECR variable missing from variables.tf"
    fi
else
    report_issue "MERN app variables.tf not found"
fi

# Check task definition image references
if [ -f "mern-app/terraform/main.tf" ]; then
    if grep -q "image.*var.ecr_repo_frontend" mern-app/terraform/main.tf; then
        report_success "Frontend task definition uses correct variable"
    else
        report_issue "Frontend task definition variable reference incorrect"
    fi
    
    if grep -q "image.*var.ecr_repo_backend" mern-app/terraform/main.tf; then
        report_success "Backend task definition uses correct variable"
    else
        report_issue "Backend task definition variable reference incorrect"
    fi
else
    report_issue "MERN app main.tf not found"
fi

echo -e "\n${BLUE}3. TASK DEFINITION CONFIGURATION${NC}"
echo "================================"

# Check for essential task definition elements
if [ -f "mern-app/terraform/main.tf" ]; then
    # Check logging configuration
    if grep -q "logConfiguration" mern-app/terraform/main.tf; then
        report_success "Logging configuration present"
    else
        report_warning "No logging configuration - will make debugging difficult"
    fi
    
    # Check health checks
    if grep -q "healthCheck" mern-app/terraform/main.tf; then
        report_success "Health checks configured"
    else
        report_warning "No health checks configured - may cause startup issues"
    fi
    
    # Check CPU and memory allocation
    if grep -q "cpu.*=.*256" mern-app/terraform/main.tf && grep -q "memory.*=.*512" mern-app/terraform/main.tf; then
        report_success "CPU/Memory allocation reasonable (256 CPU, 512 MB)"
    else
        report_warning "Check CPU/Memory allocation for production workload"
    fi
    
    # Check network mode
    if grep -q "network_mode.*=.*\"awsvpc\"" mern-app/terraform/main.tf; then
        report_success "Network mode is awsvpc (required for Fargate)"
    else
        report_issue "Network mode must be awsvpc for Fargate"
    fi
    
    # Check execution role
    if grep -q "execution_role_arn" mern-app/terraform/main.tf; then
        report_success "Execution role configured"
    else
        report_issue "Execution role missing - tasks won't start"
    fi
fi

echo -e "\n${BLUE}4. ECS SERVICE CONFIGURATION${NC}"
echo "============================"

if [ -f "mern-app/terraform/main.tf" ]; then
    # Check force new deployment
    if grep -q "force_new_deployment.*=.*true" mern-app/terraform/main.tf; then
        report_success "Force new deployment enabled"
    else
        report_issue "Force new deployment not enabled - services won't update"
    fi
    
    # Check depends_on
    if grep -q "depends_on.*aws_ecs_task_definition" mern-app/terraform/main.tf; then
        report_success "Service dependencies configured"
    else
        report_warning "Service dependencies not explicit - may cause timing issues"
    fi
    
    # Check load balancer configuration
    if grep -q "load_balancer" mern-app/terraform/main.tf; then
        report_success "Load balancer configuration present"
        
        # Check health check grace period
        if grep -q "health_check_grace_period_seconds" mern-app/terraform/main.tf; then
            report_success "Health check grace period configured"
        else
            report_warning "No health check grace period - may cause premature failures"
        fi
    else
        report_issue "Load balancer configuration missing"
    fi
fi

echo -e "\n${BLUE}5. GITHUB ACTIONS WORKFLOW VALIDATION${NC}"
echo "======================================"

if [ -f ".github/workflows/monorepo-deploy.yml" ]; then
    # Check job dependencies
    if grep -q "needs:.*deploy-infrastructure" .github/workflows/monorepo-deploy.yml; then
        report_success "MERN deployment depends on infrastructure"
    else
        report_issue "Missing infrastructure dependency"
    fi
    
    # Check ECR image verification
    if grep -q "describe-images.*imageTag" .github/workflows/monorepo-deploy.yml; then
        report_success "ECR image verification present"
    else
        report_issue "Missing ECR image verification - may deploy non-existent images"
    fi
    
    # Check Terraform setup
    if grep -q "Setup Terraform for MERN deployment" .github/workflows/monorepo-deploy.yml; then
        report_success "Terraform setup for MERN deployment"
    else
        report_issue "Missing Terraform setup for MERN deployment"
    fi
    
    # Check force service updates
    if grep -q "update-service.*force-new-deployment" .github/workflows/monorepo-deploy.yml; then
        report_success "Force service updates configured"
    else
        report_warning "No explicit service updates - may need manual intervention"
    fi
else
    report_issue "GitHub Actions workflow not found"
fi

echo -e "\n${BLUE}6. NETWORK AND SECURITY VALIDATION${NC}"
echo "=================================="

# Check security group configuration
if [ -f "mern-app/terraform/main.tf" ]; then
    if grep -q "aws_security_group" mern-app/terraform/main.tf; then
        report_success "Security group defined"
    else
        report_issue "No security group defined - networking will fail"
    fi
    
    # Check subnet configuration
    if grep -q "subnets.*=.*local.public_subnet_ids" mern-app/terraform/main.tf; then
        report_success "Public subnets configured for frontend"
    else
        report_warning "Check subnet configuration"
    fi
fi

echo -e "\n${BLUE}7. TIMING AND DEPENDENCY VALIDATION${NC}"
echo "==================================="

# Check remote state dependency
if [ -f "mern-app/terraform/main.tf" ]; then
    if grep -q "terraform_remote_state.*shared_infra" mern-app/terraform/main.tf; then
        report_success "Remote state dependency configured"
    else
        report_issue "Missing remote state dependency - will fail to find shared resources"
    fi
    
    # Check data source usage
    if grep -q "data.terraform_remote_state.shared_infra.outputs" mern-app/terraform/main.tf; then
        report_success "Using shared infrastructure outputs"
    else
        report_issue "Not using shared infrastructure outputs"
    fi
fi

echo -e "\n${BLUE}📊 VALIDATION SUMMARY${NC}"
echo "====================="

echo -e "\n${GREEN}Successful Checks: $(( $(echo "${BASH_SOURCE[0]}" | wc -l) - ${#ISSUES_FOUND[@]} - ${#WARNINGS_FOUND[@]} ))${NC}"

if [ ${#WARNINGS_FOUND[@]} -gt 0 ]; then
    echo -e "\n${YELLOW}⚠️  WARNINGS (${#WARNINGS_FOUND[@]}):${NC}"
    for warning in "${WARNINGS_FOUND[@]}"; do
        echo -e "  ${YELLOW}• $warning${NC}"
    done
fi

if [ ${#ISSUES_FOUND[@]} -gt 0 ]; then
    echo -e "\n${RED}❌ CRITICAL ISSUES (${#ISSUES_FOUND[@]}):${NC}"
    for issue in "${ISSUES_FOUND[@]}"; do
        echo -e "  ${RED}• $issue${NC}"
    done
fi

if [ "$VALIDATION_FAILED" = true ]; then
    echo -e "\n${RED}🚫 VALIDATION FAILED - DO NOT DEPLOY${NC}"
    echo -e "${RED}Fix the critical issues above before proceeding${NC}"
    exit 1
else
    echo -e "\n${GREEN}✅ VALIDATION PASSED - SAFE TO DEPLOY${NC}"
    echo -e "${GREEN}All critical checks passed. Warnings should be addressed but won't block deployment.${NC}"
    exit 0
fi
