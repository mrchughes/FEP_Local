#!/bin/bash

# State reconciliation script for Terraform resources
# This script helps resolve import conflicts and state mismatches

set -e

echo "🔧 Terraform State Reconciliation"
echo "================================="

# Function to check if resource exists in AWS
check_aws_resource() {
    local resource_type=$1
    local resource_name=$2
    
    case $resource_type in
        "dynamodb")
            aws dynamodb describe-table --table-name "$resource_name" --region eu-west-2 --query 'Table.TableStatus' --output text 2>/dev/null || echo "NOT_FOUND"
            ;;
        "ecr")
            aws ecr describe-repositories --repository-names "$resource_name" --region eu-west-2 --query 'repositories[0].repositoryName' --output text 2>/dev/null || echo "NOT_FOUND"
            ;;
        "s3")
            aws s3api head-bucket --bucket "$resource_name" --region eu-west-2 2>/dev/null && echo "EXISTS" || echo "NOT_FOUND"
            ;;
        "alb")
            aws elbv2 describe-load-balancers --names "$resource_name" --region eu-west-2 --query 'LoadBalancers[0].State.Code' --output text 2>/dev/null || echo "NOT_FOUND"
            ;;
    esac
}

# Function to check if resource exists in Terraform state
check_terraform_state() {
    local resource_addr=$1
    terraform state show "$resource_addr" >/dev/null 2>&1 && echo "IN_STATE" || echo "NOT_IN_STATE"
}

# Function to safely import resource if needed
safe_import() {
    local resource_addr=$1
    local resource_id=$2
    local description=$3
    
    echo "Checking $description..."
    
    local tf_state=$(check_terraform_state "$resource_addr")
    
    if [ "$tf_state" = "NOT_IN_STATE" ]; then
        echo "  Resource not in state, attempting import..."
        if terraform import "$resource_addr" "$resource_id" 2>/dev/null; then
            echo "  ✅ Successfully imported $description"
        else
            echo "  ⚠️ Failed to import $description (may not exist or have permission issues)"
        fi
    else
        echo "  ✅ Resource already in state"
    fi
}

# Navigate to shared-infra directory
cd shared-infra/terraform

echo "🔍 Checking current Terraform state..."
terraform init -input=false

echo ""
echo "📋 Resource Status Check:"
echo "========================"

# Check key resources
echo "DynamoDB Table: $(check_aws_resource dynamodb cloud-apps-table)"
echo "ECR mern-app-frontend: $(check_aws_resource ecr mern-app-frontend)"
echo "ECR mern-app-backend: $(check_aws_resource ecr mern-app-backend)"
echo "ECR python-app: $(check_aws_resource ecr python-app)"
echo "S3 Bucket: $(check_aws_resource s3 cloud-apps-shared-bucket)"
echo "ALB: $(check_aws_resource alb cloud-apps-alb)"

echo ""
echo "🔄 Attempting safe imports..."
echo "=============================="

# Attempt imports with error handling
safe_import "module.dynamodb.aws_dynamodb_table.app" "cloud-apps-table" "DynamoDB table"

# ECR repositories
for repo in mern-app-frontend mern-app-backend python-app; do
    safe_import "module.ecr.aws_ecr_repository.$repo" "$repo" "ECR repository $repo"
done

# Try S3 bucket (may not exist yet)
safe_import "module.s3.aws_s3_bucket.app" "cloud-apps-shared-bucket" "S3 bucket"

echo ""
echo "🎯 State Reconciliation Complete"
echo "==============================="
echo "You can now run 'terraform plan' to see what resources need to be created or updated."
