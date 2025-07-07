#!/bin/bash

# Orphaned Resource Detection and Recovery Script
# Identifies and optionally removes orphaned AWS resources from failed deployments

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REGION="eu-west-2"
STATE_BUCKET="cloud-apps-terraform-state-bucket"
DOMAIN="mrchughes.site"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Tracking variables
ORPHANED_RESOURCES=()
ORPHANED_COUNT=0
TOTAL_CHECKS=0

echo -e "${BLUE}🔍 ORPHANED RESOURCE DETECTION${NC}"
echo -e "${BLUE}==============================${NC}"
echo "Date: $(date)"
echo "Region: $REGION"
echo ""

# Function to add orphaned resource
add_orphaned() {
    local resource_type="$1"
    local resource_id="$2"
    local details="$3"
    
    ORPHANED_RESOURCES+=("$resource_type: $resource_id - $details")
    ((ORPHANED_COUNT++))
}

# Function to check if resource is managed by Terraform
is_terraform_managed() {
    local resource_type="$1"
    local resource_id="$2"
    
    # Check all Terraform state files for this resource
    for state_key in "shared-infra/terraform.tfstate" "mern-app/terraform.tfstate" "python-app/terraform.tfstate"; do
        if aws s3 cp "s3://$STATE_BUCKET/$state_key" - 2>/dev/null | jq -r '.resources[].instances[].attributes | select(. != null) | to_entries[]' | grep -q "$resource_id" 2>/dev/null; then
            return 0  # Found in Terraform state
        fi
    done
    return 1  # Not found in any Terraform state
}

# Function to check orphaned VPCs
check_orphaned_vpcs() {
    echo -e "${PURPLE}🌐 Checking VPCs...${NC}"
    ((TOTAL_CHECKS++))
    
    # Get all non-default VPCs
    VPC_IDS=$(aws ec2 describe-vpcs --region $REGION --query 'Vpcs[?IsDefault==`false`].VpcId' --output text 2>/dev/null || echo "")
    
    for vpc_id in $VPC_IDS; do
        if ! is_terraform_managed "vpc" "$vpc_id"; then
            VPC_NAME=$(aws ec2 describe-vpcs --vpc-ids "$vpc_id" --region $REGION --query 'Vpcs[0].Tags[?Key==`Name`].Value' --output text 2>/dev/null || echo "unnamed")
            add_orphaned "VPC" "$vpc_id" "Name: $VPC_NAME"
        fi
    done
}

# Function to check orphaned load balancers
check_orphaned_albs() {
    echo -e "${PURPLE}⚖️  Checking Application Load Balancers...${NC}"
    ((TOTAL_CHECKS++))
    
    ALB_ARNS=$(aws elbv2 describe-load-balancers --region $REGION --query 'LoadBalancers[].LoadBalancerArn' --output text 2>/dev/null || echo "")
    
    for alb_arn in $ALB_ARNS; do
        ALB_NAME=$(echo $alb_arn | cut -d'/' -f2)
        if ! is_terraform_managed "alb" "$ALB_NAME"; then
            ALB_STATE=$(aws elbv2 describe-load-balancers --load-balancer-arns "$alb_arn" --region $REGION --query 'LoadBalancers[0].State.Code' --output text 2>/dev/null || echo "unknown")
            add_orphaned "ALB" "$ALB_NAME" "State: $ALB_STATE, ARN: $alb_arn"
        fi
    done
}

# Function to check orphaned target groups
check_orphaned_target_groups() {
    echo -e "${PURPLE}🎯 Checking Target Groups...${NC}"
    ((TOTAL_CHECKS++))
    
    TG_ARNS=$(aws elbv2 describe-target-groups --region $REGION --query 'TargetGroups[].TargetGroupArn' --output text 2>/dev/null || echo "")
    
    for tg_arn in $TG_ARNS; do
        TG_NAME=$(echo $tg_arn | cut -d'/' -f2)
        if ! is_terraform_managed "target_group" "$TG_NAME"; then
            TG_HEALTH=$(aws elbv2 describe-target-health --target-group-arn "$tg_arn" --region $REGION --query 'length(TargetHealthDescriptions)' --output text 2>/dev/null || echo "0")
            add_orphaned "TARGET_GROUP" "$TG_NAME" "Targets: $TG_HEALTH, ARN: $tg_arn"
        fi
    done
}

# Function to check orphaned ECR repositories
check_orphaned_ecr() {
    echo -e "${PURPLE}📦 Checking ECR Repositories...${NC}"
    ((TOTAL_CHECKS++))
    
    ECR_REPOS=$(aws ecr describe-repositories --region $REGION --query 'repositories[].repositoryName' --output text 2>/dev/null || echo "")
    
    for repo in $ECR_REPOS; do
        if ! is_terraform_managed "ecr" "$repo"; then
            IMAGE_COUNT=$(aws ecr describe-images --repository-name "$repo" --region $REGION --query 'length(imageDetails)' --output text 2>/dev/null || echo "0")
            REPO_SIZE=$(aws ecr describe-repositories --repository-names "$repo" --region $REGION --query 'repositories[0].repositorySizeInBytes' --output text 2>/dev/null || echo "0")
            add_orphaned "ECR_REPO" "$repo" "Images: $IMAGE_COUNT, Size: $REPO_SIZE bytes"
        fi
    done
}

# Function to check orphaned S3 buckets
check_orphaned_s3() {
    echo -e "${PURPLE}🪣 Checking S3 Buckets...${NC}"
    ((TOTAL_CHECKS++))
    
    # Only check buckets related to our applications
    S3_BUCKETS=$(aws s3api list-buckets --query "Buckets[?contains(Name, 'cloud-apps') || contains(Name, 'mrchughes')].Name" --output text 2>/dev/null || echo "")
    
    for bucket in $S3_BUCKETS; do
        # Skip the state bucket
        if [[ "$bucket" == "$STATE_BUCKET" ]]; then
            continue
        fi
        
        if ! is_terraform_managed "s3" "$bucket"; then
            OBJECT_COUNT=$(aws s3 ls "s3://$bucket" --recursive --summarize 2>/dev/null | grep "Total Objects:" | awk '{print $3}' || echo "0")
            BUCKET_SIZE=$(aws s3 ls "s3://$bucket" --recursive --summarize 2>/dev/null | grep "Total Size:" | awk '{print $3}' || echo "0")
            add_orphaned "S3_BUCKET" "$bucket" "Objects: $OBJECT_COUNT, Size: $BUCKET_SIZE bytes"
        fi
    done
}

# Function to check orphaned DynamoDB tables
check_orphaned_dynamodb() {
    echo -e "${PURPLE}🗄️  Checking DynamoDB Tables...${NC}"
    ((TOTAL_CHECKS++))
    
    DYNAMO_TABLES=$(aws dynamodb list-tables --region $REGION --query 'TableNames[]' --output text 2>/dev/null || echo "")
    
    for table in $DYNAMO_TABLES; do
        # Skip the Terraform state locking table
        if [[ "$table" == *"terraform"* ]] && [[ "$table" == *"lock"* ]]; then
            continue
        fi
        
        if ! is_terraform_managed "dynamodb" "$table"; then
            TABLE_STATUS=$(aws dynamodb describe-table --table-name "$table" --region $REGION --query 'Table.TableStatus' --output text 2>/dev/null || echo "unknown")
            ITEM_COUNT=$(aws dynamodb describe-table --table-name "$table" --region $REGION --query 'Table.ItemCount' --output text 2>/dev/null || echo "0")
            add_orphaned "DYNAMODB_TABLE" "$table" "Status: $TABLE_STATUS, Items: $ITEM_COUNT"
        fi
    done
}

# Function to check orphaned Route53 zones
check_orphaned_route53() {
    echo -e "${PURPLE}🌍 Checking Route53 Hosted Zones...${NC}"
    ((TOTAL_CHECKS++))
    
    ZONE_IDS=$(aws route53 list-hosted-zones --query "HostedZones[?Name==\`${DOMAIN}.\`].Id" --output text 2>/dev/null || echo "")
    
    for zone_id in $ZONE_IDS; do
        clean_zone_id=${zone_id#/hostedzone/}
        if ! is_terraform_managed "route53" "$clean_zone_id"; then
            RECORD_COUNT=$(aws route53 list-resource-record-sets --hosted-zone-id "$clean_zone_id" --query 'length(ResourceRecordSets)' --output text 2>/dev/null || echo "0")
            add_orphaned "ROUTE53_ZONE" "$clean_zone_id" "Domain: $DOMAIN, Records: $RECORD_COUNT"
        fi
    done
}

# Function to check orphaned security groups
check_orphaned_security_groups() {
    echo -e "${PURPLE}🛡️  Checking Security Groups...${NC}"
    ((TOTAL_CHECKS++))
    
    # Get all non-default security groups
    SG_IDS=$(aws ec2 describe-security-groups --region $REGION --query 'SecurityGroups[?GroupName!=`default`].GroupId' --output text 2>/dev/null || echo "")
    
    for sg_id in $SG_IDS; do
        if ! is_terraform_managed "security_group" "$sg_id"; then
            SG_NAME=$(aws ec2 describe-security-groups --group-ids "$sg_id" --region $REGION --query 'SecurityGroups[0].GroupName' --output text 2>/dev/null || echo "unnamed")
            VPC_ID=$(aws ec2 describe-security-groups --group-ids "$sg_id" --region $REGION --query 'SecurityGroups[0].VpcId' --output text 2>/dev/null || echo "unknown")
            add_orphaned "SECURITY_GROUP" "$sg_id" "Name: $SG_NAME, VPC: $VPC_ID"
        fi
    done
}

# Function to check orphaned IAM roles
check_orphaned_iam_roles() {
    echo -e "${PURPLE}👤 Checking IAM Roles...${NC}"
    ((TOTAL_CHECKS++))
    
    # Only check roles related to our applications
    IAM_ROLES=$(aws iam list-roles --query "Roles[?contains(RoleName, 'cloud-apps') || contains(RoleName, 'ecs-task') || contains(RoleName, 'github-actions')].RoleName" --output text 2>/dev/null || echo "")
    
    for role in $IAM_ROLES; do
        if ! is_terraform_managed "iam" "$role"; then
            POLICY_COUNT=$(aws iam list-attached-role-policies --role-name "$role" --query 'length(AttachedPolicies)' --output text 2>/dev/null || echo "0")
            LAST_USED=$(aws iam get-role --role-name "$role" --query 'Role.RoleLastUsed.LastUsedDate' --output text 2>/dev/null || echo "never")
            add_orphaned "IAM_ROLE" "$role" "Policies: $POLICY_COUNT, Last used: $LAST_USED"
        fi
    done
}

# Function to check orphaned ECS clusters/services
check_orphaned_ecs() {
    echo -e "${PURPLE}🐳 Checking ECS Resources...${NC}"
    ((TOTAL_CHECKS++))
    
    # Check ECS clusters
    ECS_CLUSTERS=$(aws ecs list-clusters --region $REGION --query 'clusterArns[]' --output text 2>/dev/null || echo "")
    
    for cluster_arn in $ECS_CLUSTERS; do
        cluster_name=$(echo $cluster_arn | cut -d'/' -f2)
        if ! is_terraform_managed "ecs" "$cluster_name"; then
            SERVICE_COUNT=$(aws ecs list-services --cluster "$cluster_name" --region $REGION --query 'length(serviceArns)' --output text 2>/dev/null || echo "0")
            TASK_COUNT=$(aws ecs list-tasks --cluster "$cluster_name" --region $REGION --query 'length(taskArns)' --output text 2>/dev/null || echo "0")
            add_orphaned "ECS_CLUSTER" "$cluster_name" "Services: $SERVICE_COUNT, Tasks: $TASK_COUNT"
        fi
    done
}

# Function to display results
display_results() {
    echo -e "\n${BLUE}📊 ORPHANED RESOURCE DETECTION RESULTS${NC}"
    echo -e "${BLUE}=====================================${NC}"
    echo "Total checks performed: $TOTAL_CHECKS"
    echo "Orphaned resources found: $ORPHANED_COUNT"
    echo ""
    
    if [ $ORPHANED_COUNT -eq 0 ]; then
        echo -e "${GREEN}🎉 No orphaned resources detected!${NC}"
        echo -e "${GREEN}✅ All AWS resources are properly managed by Terraform${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  Found $ORPHANED_COUNT orphaned resources:${NC}"
        echo ""
        
        for resource in "${ORPHANED_RESOURCES[@]}"; do
            echo -e "${RED}❌ $resource${NC}"
        done
        
        echo ""
        echo -e "${YELLOW}💡 These resources may have been created by failed deployments${NC}"
        echo -e "${YELLOW}💡 Consider reviewing and cleaning up manually or with cleanup scripts${NC}"
        return 1
    fi
}

# Function to generate cleanup script
generate_cleanup_script() {
    if [ $ORPHANED_COUNT -eq 0 ]; then
        return 0
    fi
    
    local cleanup_script="$SCRIPT_DIR/generated-orphan-cleanup.sh"
    
    echo -e "\n${BLUE}📝 Generating cleanup script: $(basename $cleanup_script)${NC}"
    
    cat > "$cleanup_script" << 'EOF'
#!/bin/bash
# Generated Orphaned Resource Cleanup Script
# This script was automatically generated by detect-orphaned-resources.sh

set -e

REGION="eu-west-2"

echo "🧹 ORPHANED RESOURCE CLEANUP"
echo "Generated on: $(date)"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}⚠️  WARNING: This will delete orphaned AWS resources!${NC}"
read -p "Are you sure you want to proceed? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Cleanup cancelled."
    exit 1
fi

EOF

    # Add specific cleanup commands for each orphaned resource
    for resource in "${ORPHANED_RESOURCES[@]}"; do
        local resource_type=$(echo "$resource" | cut -d':' -f1)
        local resource_id=$(echo "$resource" | cut -d':' -f2 | cut -d' ' -f2)
        
        case "$resource_type" in
            "VPC")
                echo "echo 'Cleaning up VPC: $resource_id'" >> "$cleanup_script"
                echo "aws ec2 delete-vpc --vpc-id $resource_id --region \$REGION || echo 'Failed to delete VPC $resource_id'" >> "$cleanup_script"
                ;;
            "ALB")
                echo "echo 'Cleaning up ALB: $resource_id'" >> "$cleanup_script"
                echo "ALB_ARN=\$(aws elbv2 describe-load-balancers --names $resource_id --region \$REGION --query 'LoadBalancers[0].LoadBalancerArn' --output text 2>/dev/null || echo '')" >> "$cleanup_script"
                echo "if [[ \"\$ALB_ARN\" != \"\" ]]; then aws elbv2 delete-load-balancer --load-balancer-arn \$ALB_ARN --region \$REGION; fi" >> "$cleanup_script"
                ;;
            "ECR_REPO")
                echo "echo 'Cleaning up ECR repository: $resource_id'" >> "$cleanup_script"
                echo "aws ecr delete-repository --repository-name $resource_id --force --region \$REGION || echo 'Failed to delete ECR repo $resource_id'" >> "$cleanup_script"
                ;;
            "S3_BUCKET")
                echo "echo 'Cleaning up S3 bucket: $resource_id'" >> "$cleanup_script"
                echo "aws s3 rm s3://$resource_id --recursive && aws s3api delete-bucket --bucket $resource_id || echo 'Failed to delete S3 bucket $resource_id'" >> "$cleanup_script"
                ;;
            "DYNAMODB_TABLE")
                echo "echo 'Cleaning up DynamoDB table: $resource_id'" >> "$cleanup_script"
                echo "aws dynamodb delete-table --table-name $resource_id --region \$REGION || echo 'Failed to delete DynamoDB table $resource_id'" >> "$cleanup_script"
                ;;
        esac
        echo "" >> "$cleanup_script"
    done
    
    echo "echo -e '\${GREEN}🎉 Orphaned resource cleanup completed!\${NC}'" >> "$cleanup_script"
    
    chmod +x "$cleanup_script"
    echo -e "${GREEN}✅ Cleanup script generated: $cleanup_script${NC}"
    echo -e "${YELLOW}💡 Review the script before running: cat $cleanup_script${NC}"
    echo -e "${YELLOW}💡 Run cleanup: $cleanup_script${NC}"
}

# Main execution
echo "Starting orphaned resource detection..."
echo ""

# Run all checks
check_orphaned_vpcs
check_orphaned_albs
check_orphaned_target_groups
check_orphaned_ecr
check_orphaned_s3
check_orphaned_dynamodb
check_orphaned_route53
check_orphaned_security_groups
check_orphaned_iam_roles
check_orphaned_ecs

# Display results
display_results
DETECTION_EXIT_CODE=$?

# Generate cleanup script if orphaned resources found
generate_cleanup_script

echo ""
echo -e "${BLUE}📋 RECOMMENDATIONS:${NC}"
echo "1. Review the orphaned resources list carefully"
echo "2. Investigate why these resources were not managed by Terraform"
echo "3. Consider updating Terraform configurations to manage them"
echo "4. Use the generated cleanup script to remove truly orphaned resources"
echo "5. Run this detection script regularly to prevent resource accumulation"

exit $DETECTION_EXIT_CODE
