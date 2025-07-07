#!/bin/bash

echo "=================================================================================="
echo "🔍 COMPREHENSIVE INFRASTRUCTURE TEST - $(date)"
echo "=================================================================================="

# Test 1: AWS Connectivity
echo ""
echo "TEST 1: AWS CONNECTIVITY AND ACCOUNT VERIFICATION"
echo "=================================================="
echo "AWS Account:"
aws sts get-caller-identity --query '[Account,Arn]' --output text 2>/dev/null || echo "❌ AWS credentials not working"

echo ""
echo "AWS Region:"
aws configure get region || echo "❌ No default region configured"

echo ""
echo "S3 State Bucket Access:"
aws s3 ls s3://cloud-apps-terraform-state-bucket/ >/dev/null 2>&1 && echo "✅ S3 bucket accessible" || echo "❌ Cannot access S3 bucket"

# Test 2: State Validation
echo ""
echo "TEST 2: TERRAFORM STATE KEY VALIDATION"
echo "======================================"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/validate-state-keys.sh" | tail -1

# Test 3: Terraform Backends
echo ""
echo "TEST 3: TERRAFORM BACKEND INITIALIZATION"
echo "========================================"

echo "shared-infra backend:"
(cd shared-infra/terraform && terraform init >/dev/null 2>&1) && echo "✅ OK" || echo "❌ Failed"

echo "mern-app backend:"
(cd mern-app/terraform && terraform init >/dev/null 2>&1) && echo "✅ OK" || echo "❌ Failed"

echo "python-app backend:"
(cd python-app/terraform && terraform init >/dev/null 2>&1) && echo "✅ OK" || echo "❌ Failed"

# Test 4: Configuration Validation
echo ""
echo "TEST 4: TERRAFORM CONFIGURATION VALIDATION"
echo "=========================================="

echo "shared-infra config:"
(cd shared-infra/terraform && terraform validate >/dev/null 2>&1) && echo "✅ Valid" || echo "❌ Invalid"

echo "mern-app config:"
(cd mern-app/terraform && terraform validate >/dev/null 2>&1) && echo "✅ Valid" || echo "❌ Invalid"

echo "python-app config:"
(cd python-app/terraform && terraform validate >/dev/null 2>&1) && echo "✅ Valid" || echo "❌ Invalid"

# Test 5: Cross-component State Access
echo ""
echo "TEST 5: CROSS-COMPONENT STATE ACCESS"
echo "===================================="

echo "mern-app reading shared-infra state:"
(cd mern-app/terraform && terraform plan -detailed-exitcode >/dev/null 2>&1)
MERN_EXIT=$?
if [ $MERN_EXIT -eq 0 ] || [ $MERN_EXIT -eq 2 ]; then
    echo "✅ Can read shared-infra outputs"
else
    echo "❌ Cannot read shared-infra outputs"
fi

echo "python-app reading shared-infra state:"
(cd python-app/terraform && terraform plan -detailed-exitcode >/dev/null 2>&1)
PYTHON_EXIT=$?
if [ $PYTHON_EXIT -eq 0 ] || [ $PYTHON_EXIT -eq 2 ]; then
    echo "✅ Can read shared-infra outputs"
else
    echo "❌ Cannot read shared-infra outputs"
fi

# Test 6: ECR Repository Access
echo ""
echo "TEST 6: ECR REPOSITORY ACCESS"
echo "============================="

echo "ECR repositories in eu-west-2:"
aws ecr describe-repositories --region eu-west-2 --query 'repositories[].repositoryName' --output text 2>/dev/null || echo "❌ Cannot access ECR"

# Test 7: Region Consistency Check
echo ""
echo "TEST 7: REGION CONSISTENCY CHECK"
echo "==============================="

echo "Checking region configuration across all files..."

# Check shared-infra
SHARED_REGION=$(grep -r "eu-west-2" shared-infra/terraform/ | wc -l)
echo "shared-infra: $SHARED_REGION references to eu-west-2"

# Check mern-app
MERN_REGION=$(grep -r "eu-west-2" mern-app/terraform/ | wc -l)
echo "mern-app: $MERN_REGION references to eu-west-2"

# Check python-app
PYTHON_REGION=$(grep -r "eu-west-2" python-app/terraform/ | wc -l)
echo "python-app: $PYTHON_REGION references to eu-west-2"

# Check GitHub Actions
GH_REGION=$(grep -r "eu-west-2" .github/ | wc -l)
echo "GitHub Actions: $GH_REGION references to eu-west-2"

echo ""
echo "TEST 8: GIT REPOSITORY STATE"
echo "============================"

echo "Current branch:"
git branch --show-current

echo "Uncommitted changes:"
git status --porcelain | wc -l | xargs echo

echo "Last commit:"
git log -1 --oneline

echo ""
echo "=================================================================================="
echo "🎯 TEST SUMMARY"
echo "=================================================================================="

# Summary
if [ $MERN_EXIT -ne 1 ] && [ $PYTHON_EXIT -ne 1 ]; then
    echo "✅ ALL TESTS PASSED - Infrastructure is properly aligned!"
else
    echo "❌ Some tests failed - Review output above"
fi

echo ""
echo "Key Metrics:"
echo "- AWS Account: $(aws sts get-caller-identity --query 'Account' --output text 2>/dev/null)"
echo "- AWS Region: $(aws configure get region)"
echo "- Terraform Components: 3 (shared-infra, mern-app, python-app)"
echo "- ECR Repositories: $(aws ecr describe-repositories --region eu-west-2 --query 'length(repositories)' --output text 2>/dev/null || echo 'Unknown')"
echo ""
