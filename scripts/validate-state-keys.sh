#!/bin/bash

echo "=== ENHANCED TERRAFORM CONFIGURATION VALIDATOR ==="
echo "Date: $(date)"
echo ""

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

# Function to check state key
check_state_key() {
    local component=$1
    local expected_key=$2
    
    if [ -f "$component/terraform/main.tf" ]; then
        cd "$component/terraform" || return 1
        
        # Extract state key from main.tf
        STATE_KEY=$(grep -A 10 'backend "s3"' main.tf | grep 'key' | sed 's/.*key.*=.*"\(.*\)".*/\1/' | tr -d ' ')
        
        if [ "$STATE_KEY" = "$expected_key" ]; then
            echo "✅ $component state key correct: $STATE_KEY"
        else
            log_error "$component state key mismatch! Found: '$STATE_KEY', Expected: '$expected_key'"
        fi
        
        # Check if state file exists in S3
        if aws s3 ls "s3://cloud-apps-terraform-state-bucket/$expected_key" >/dev/null 2>&1; then
            echo "✅ $component state file exists in S3"
        else
            log_warning "$component state file missing in S3: s3://cloud-apps-terraform-state-bucket/$expected_key"
        fi
        
        cd - >/dev/null || return 1
        echo ""
    else
        log_error "$component/terraform/main.tf not found"
        echo ""
    fi
}

# Function to check remote state references
check_remote_state_references() {
    echo "=== CROSS-COMPONENT REFERENCE VALIDATION ==="
    
    # Check mern-app references shared-infra correctly
    if [ -f "mern-app/terraform/main.tf" ]; then
        MERN_REF=$(grep -A 10 'data "terraform_remote_state" "shared_infra"' mern-app/terraform/main.tf | grep 'key' | sed 's/.*key.*=.*"\(.*\)".*/\1/' | tr -d ' ')
        if [ "$MERN_REF" = "shared-infra/terraform.tfstate" ]; then
            echo "✅ mern-app correctly references shared-infra state"
        else
            log_error "mern-app references wrong shared-infra state key: '$MERN_REF'"
        fi
    fi
    
    # Check python-app references shared-infra correctly
    if [ -f "python-app/terraform/main.tf" ]; then
        PYTHON_REF=$(grep -A 10 'data "terraform_remote_state" "shared_infra"' python-app/terraform/main.tf | grep 'key' | sed 's/.*key.*=.*"\(.*\)".*/\1/' | tr -d ' ')
        if [ "$PYTHON_REF" = "shared-infra/terraform.tfstate" ]; then
            echo "✅ python-app correctly references shared-infra state"
        else
            log_error "python-app references wrong shared-infra state key: '$PYTHON_REF'"
        fi
    fi
    echo ""
}

# Function to check provider region consistency
check_provider_regions() {
    echo "=== PROVIDER REGION CONSISTENCY ==="
    
    REGIONS=()
    
    for component in shared-infra mern-app python-app; do
        if [ -f "$component/terraform/provider.tf" ]; then
            # First check for variable reference
            REGION_VAR=$(grep -A 5 'provider "aws"' "$component/terraform/provider.tf" | grep 'region.*var\.' | sed 's/.*var\.\([a-zA-Z_]*\).*/\1/')
            if [ -n "$REGION_VAR" ]; then
                DEFAULT_REGION=$(grep -A 3 "variable \"$REGION_VAR\"" "$component/terraform/variables.tf" 2>/dev/null | grep 'default' | sed 's/.*default.*=.*"\(.*\)".*/\1/' | tr -d ' ')
                REGION=${DEFAULT_REGION:-"variable-$REGION_VAR"}
            else
                # Check for direct quoted region
                REGION=$(grep -A 5 'provider "aws"' "$component/terraform/provider.tf" | grep 'region' | sed 's/.*region.*=.*"\(.*\)".*/\1/' | tr -d ' ')
            fi
            REGIONS+=("$component:$REGION")
            if [ "$REGION" = "eu-west-2" ]; then
                echo "$component provider region: $REGION ✅"
            elif [[ "$REGION" == "variable-"* ]]; then
                echo "$component provider region: $REGION (variable reference)"
            else
                echo "$component provider region: $REGION"
            fi
        fi
    done
    
    # Check if all regions are eu-west-2 or variable references that default to eu-west-2
    for region_info in "${REGIONS[@]}"; do
        component=$(echo "$region_info" | cut -d: -f1)
        region=$(echo "$region_info" | cut -d: -f2)
        if [[ "$region" != "eu-west-2" && "$region" != "variable-aws_region" && "$region" != "aws_region" ]]; then
            log_error "$component provider region is '$region', should be 'eu-west-2'"
        fi
    done
    echo ""
}

# Function to check S3 bucket structure
check_s3_structure() {
    echo "=== S3 STATE BUCKET STRUCTURE ==="
    
    echo "Current S3 bucket contents:"
    aws s3 ls s3://cloud-apps-terraform-state-bucket/ --recursive
    
    # Check for orphaned state files
    ORPHANED_FILES=$(aws s3 ls s3://cloud-apps-terraform-state-bucket/ | grep -v "PRE" | grep -v "shared-infra" | grep -v "mern-app" | grep -v "python-app" || true)
    if [ -n "$ORPHANED_FILES" ]; then
        log_warning "Orphaned state files detected in S3 bucket"
        echo "Orphaned files:"
        echo "$ORPHANED_FILES"
    fi
    echo ""
}

# Run all checks
echo "Starting comprehensive validation..."
echo ""

# Check each component
check_state_key "shared-infra" "shared-infra/terraform.tfstate"
check_state_key "mern-app" "mern-app/terraform.tfstate"
check_state_key "python-app" "python-app/terraform.tfstate"

# Check cross-component references
check_remote_state_references

# Check provider regions
check_provider_regions

# Check S3 bucket structure
check_s3_structure

# Report results
echo "=== VALIDATION SUMMARY ==="
if [ ${#ERRORS[@]} -gt 0 ]; then
    echo "ERRORS FOUND:"
    for error in "${ERRORS[@]}"; do
        echo "$error"
    done
    echo ""
fi

if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo "WARNINGS:"
    for warning in "${WARNINGS[@]}"; do
        echo "$warning"
    done
    echo ""
fi

echo "=== FINAL RESULT ==="
if [ "$SUCCESS" = true ]; then
    echo "✅ All configuration validations passed!"
    exit 0
else
    echo "❌ Configuration issues found! Fix errors before proceeding."
    echo ""
    echo "Common fixes:"
    echo "- Update backend configuration keys to match directory structure"
    echo "- Ensure remote state references point to correct state files"
    echo "- Verify all providers use consistent regions"
    echo "- Run: terraform init -reconfigure after backend changes"
    exit 1
fi
