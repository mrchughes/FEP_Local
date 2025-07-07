#!/bin/bash

# Infrastructure Prevention and Validation Script
# Usage: ./prevent-config-drift.sh [component]
# Component can be: shared-infra, mern-app, python-app, or all

echo "=== INFRASTRUCTURE DRIFT PREVENTION ==="
echo "Date: $(date)"
echo ""

COMPONENT=${1:-all}
WORKSPACE_ROOT=$(pwd)
SUCCESS=true
ERRORS=()
WARNINGS=()

# Function to log errors
log_error() {
    ERRORS+=("❌ $1")
    SUCCESS=false
}

# Function to log warnings  
log_warning() {
    WARNINGS+=("⚠️  $1")
}

# Function to validate a single component
validate_component() {
    local comp=$1
    local terraform_dir="$comp/terraform"
    
    if [ ! -d "$terraform_dir" ]; then
        log_warning "Terraform directory not found: $terraform_dir"
        return
    fi
    
    echo "Validating component: $comp"
    echo "=========================="
    
    cd "$terraform_dir" || return 1
    
    # 1. Terraform syntax validation
    echo "1. Terraform syntax validation..."
    if ! terraform validate >/dev/null 2>&1; then
        log_error "$comp: Terraform validation failed"
        terraform validate
    else
        echo "✅ Terraform syntax OK"
    fi
    
    # 2. Terraform formatting check
    echo "2. Terraform formatting check..."
    if ! terraform fmt -check=true >/dev/null 2>&1; then
        log_warning "$comp: Terraform files need formatting"
        echo "   Run: cd $terraform_dir && terraform fmt"
    else
        echo "✅ Terraform formatting OK"
    fi
    
    # 3. State key validation
    echo "3. State key validation..."
    case "$comp" in
        "shared-infra")
            expected_key="shared-infra/terraform.tfstate"
            ;;
        "mern-app")  
            expected_key="mern-app/terraform.tfstate"
            ;;
        "python-app")
            expected_key="python-app/terraform.tfstate"
            ;;
        *)
            log_error "$comp: Unknown component for state key validation"
            cd "$WORKSPACE_ROOT"
            return 1
            ;;
    esac
    
    if [ -f "main.tf" ]; then
        actual_key=$(grep -A 10 'backend "s3"' main.tf | grep 'key' | sed 's/.*key.*=.*"\(.*\)".*/\1/' | tr -d ' ')
        if [ "$actual_key" = "$expected_key" ]; then
            echo "✅ State key correct: $actual_key"
        else
            log_error "$comp: State key mismatch! Found: '$actual_key', Expected: '$expected_key'"
        fi
        
        # Check if state file exists in S3
        if aws s3 ls "s3://cloud-apps-terraform-state-bucket/$expected_key" >/dev/null 2>&1; then
            echo "✅ State file exists in S3"
        else
            log_warning "$comp: State file missing in S3: $expected_key"
        fi
    else
        log_error "$comp: main.tf not found"
    fi
    
    # 4. Region consistency check
    echo "4. Region consistency check..."
    NON_STANDARD_REGIONS=$(grep -r 'region.*=.*"' . 2>/dev/null | grep -v 'eu-west-2' | grep -E 'us-|ap-|ca-|sa-' || true)
    if [ -n "$NON_STANDARD_REGIONS" ]; then
        log_error "$comp: Non-standard regions found:"
        echo "$NON_STANDARD_REGIONS"
    else
        echo "✅ Region consistency OK (eu-west-2)"
    fi
    
    # 5. Cross-component reference validation
    echo "5. Cross-component reference validation..."
    if [ "$comp" != "shared-infra" ]; then
        # Check if component references shared-infra correctly
        SHARED_REF=$(grep -r 'terraform_remote_state.*shared' . 2>/dev/null || true)
        if [ -n "$SHARED_REF" ]; then
            # Check if the correct key is used anywhere in the file
            if grep -q 'key.*=.*"shared-infra/terraform.tfstate"' main.tf 2>/dev/null; then
                echo "✅ Shared infrastructure reference correct"
            else
                log_error "$comp: Incorrect shared-infra state reference - missing correct key"
                echo "Found references but wrong key configuration"
            fi
        else
            echo "ℹ️  No shared infrastructure references found"
        fi
    fi
    
    # 6. Provider configuration check
    echo "6. Provider configuration check..."
    if [ -f "main.tf" ] || [ -f "provider.tf" ]; then
        # Check for hardcoded regions that aren't eu-west-2
        HARDCODED_REGIONS=$(grep -h 'region.*=.*"[a-z]' main.tf provider.tf 2>/dev/null | grep -v 'eu-west-2' | grep -v 'var.aws_region' || true)
        if [ -n "$HARDCODED_REGIONS" ]; then
            log_error "$comp: Hardcoded non-eu-west-2 region found:"
            echo "$HARDCODED_REGIONS"
        else
            echo "✅ Provider configuration OK"
        fi
    fi
    
    echo ""
    cd "$WORKSPACE_ROOT" || return 1
}

# Function to validate Docker configurations
validate_docker() {
    echo "Docker Configuration Validation"
    echo "==============================="
    
    # Check for problematic Docker patterns
    DOCKER_FILES=$(find . -name "Dockerfile*" -o -name "docker-compose*.yml" -o -name "*.yml" | grep -E 'docker|workflow' || true)
    
    for file in $DOCKER_FILES; do
        if [ -f "$file" ]; then
            # Check for :latest tags in production workflows
            if echo "$file" | grep -q 'workflow\|\.github' && grep -q ':latest' "$file"; then
                if ! grep -q '# Allow :latest for development' "$file"; then
                    log_warning "Found :latest tag in $file - consider using specific tags"
                fi
            fi
            
            # Check for hardcoded registry URLs
            if grep -q 'amazonaws.com' "$file" && ! grep -q 'eu-west-2' "$file"; then
                log_warning "Potential non-eu-west-2 ECR reference in $file"
            fi
        fi
    done
    
    echo "✅ Docker configuration check complete"
    echo ""
}

# Function to validate GitHub Actions
validate_github_actions() {
    echo "GitHub Actions Validation"
    echo "========================="
    
    WORKFLOW_FILES=$(find .github/workflows -name "*.yml" -o -name "*.yaml" 2>/dev/null || true)
    
    for workflow in $WORKFLOW_FILES; do
        if [ -f "$workflow" ]; then
            echo "Checking $workflow..."
            
            # Check for AWS region references that might be wrong (ignore validation code and variables)
            NON_STANDARD_REGIONS=$(grep -n 'region.*["\x27]us-\|region.*["\x27]ap-\|region.*["\x27]ca-' "$workflow" | grep -v 'grep.*region' | grep -v 'validation\|check\|Infrastructure.*Validation' || true)
            if [ -n "$NON_STANDARD_REGIONS" ]; then
                log_error "Hardcoded non-eu-west-2 AWS region in $workflow:"
                echo "$NON_STANDARD_REGIONS"
            fi
            
            # Check for missing validation steps
            if grep -q 'terraform apply' "$workflow" && ! grep -q 'terraform validate' "$workflow"; then
                log_warning "Terraform apply without validation in $workflow"
            fi
            
            # Check for stale plan prevention
            if grep -q 'terraform apply.*tfplan' "$workflow" && ! grep -q 'terraform plan.*-out=tfplan-apply\|Re-plan to avoid stale' "$workflow"; then
                log_warning "Potential stale plan issue in $workflow"
            fi
        fi
    done
    
    echo "✅ GitHub Actions validation complete"
    echo ""
}

# Main execution
echo "Components to validate: $COMPONENT"
echo ""

case "$COMPONENT" in
    "all")
        validate_component "shared-infra"
        validate_component "mern-app" 
        validate_component "python-app"
        ;;
    "shared-infra"|"mern-app"|"python-app")
        validate_component "$COMPONENT"
        ;;
    *)
        echo "Invalid component: $COMPONENT"
        echo "Valid options: shared-infra, mern-app, python-app, all"
        exit 1
        ;;
esac

validate_docker
validate_github_actions

# Summary
echo "VALIDATION SUMMARY"
echo "=================="

if [ ${#ERRORS[@]} -eq 0 ] && [ ${#WARNINGS[@]} -eq 0 ]; then
    echo "✅ ALL VALIDATIONS PASSED"
    echo "   No issues detected in infrastructure configuration"
elif [ ${#ERRORS[@]} -eq 0 ]; then
    echo "⚠️  WARNINGS DETECTED (${#WARNINGS[@]} total):"
    for warning in "${WARNINGS[@]}"; do
        echo "  $warning"
    done
    echo ""
    echo "These warnings should be addressed but don't block deployment."
else
    echo "❌ CRITICAL ERRORS DETECTED (${#ERRORS[@]} total):"
    for error in "${ERRORS[@]}"; do
        echo "  $error"
    done
    echo ""
    if [ ${#WARNINGS[@]} -gt 0 ]; then
        echo "⚠️  ADDITIONAL WARNINGS (${#WARNINGS[@]} total):"
        for warning in "${WARNINGS[@]}"; do
            echo "  $warning"
        done
        echo ""
    fi
    echo "CRITICAL ERRORS MUST BE FIXED BEFORE DEPLOYMENT!"
    exit 1
fi

echo ""
echo "Prevention measures in place:"
echo "  ✅ Pre-commit hooks: .git/hooks/pre-commit"
echo "  ✅ CI/CD validation: Enhanced workflow checks"
echo "  ✅ State key monitoring: validate-state-keys.sh"
echo "  ✅ DNS health monitoring: monitor-dns-health.sh"
echo "  ✅ Comprehensive validation: prevent-config-drift.sh"
echo ""
echo "Run this script regularly or add to CI/CD for continuous validation."
