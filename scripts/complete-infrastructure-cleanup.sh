#!/bin/bash

# Complete AWS Infrastructure Cleanup Script
# Removes ALL resources except Terraform state infrastructure
# This includes: S3 state bucket, DynamoDB state locking table, essential IAM roles

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

REGION="eu-west-2"
DOMAIN="mrchughes.site"
STATE_BUCKET="cloud-apps-terraform-state-bucket"

echo -e "${RED}========================================================================${NC}"
echo -e "${RED}                    COMPLETE INFRASTRUCTURE CLEANUP                    ${NC}"
echo -e "${RED}                        ⚠️  DESTRUCTIVE ACTION ⚠️                      ${NC}"
echo -e "${RED}========================================================================${NC}"

echo -e "${YELLOW}This script will remove ALL AWS resources EXCEPT:${NC}"
echo -e "${GREEN}✓ Terraform state S3 bucket: $STATE_BUCKET${NC}"
echo -e "${GREEN}✓ DynamoDB state locking table (if exists)${NC}"
echo -e "${GREEN}✓ Essential GitHub Actions IAM roles${NC}"
echo -e "${GREEN}✓ Essential Terraform execution IAM roles${NC}"

echo -e "\n${RED}This will REMOVE:${NC}"
echo -e "${RED}✗ ALL Route53 hosted zones for $DOMAIN${NC}"
echo -e "${RED}✗ ALL VPCs and networking${NC}"
echo -e "${RED}✗ ALL ALBs, target groups, certificates${NC}"
echo -e "${RED}✗ ALL ECR repositories${NC}"
echo -e "${RED}✗ ALL application S3 buckets${NC}"
echo -e "${RED}✗ ALL DynamoDB application tables${NC}"
echo -e "${RED}✗ ALL application-related IAM roles${NC}"

read -p "Are you sure you want to proceed with COMPLETE cleanup? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Cleanup cancelled."
    exit 1
fi

# Backup current state
echo -e "\n${BLUE}== Backing up Terraform state ==${NC}"
cd shared-infra/terraform
aws s3 cp s3://${STATE_BUCKET}/shared-infra/terraform.tfstate ./terraform.tfstate.complete.backup.$(date +%Y%m%d_%H%M%S) || echo "Could not backup S3 state"

# Clear Terraform state completely
echo -e "\n${BLUE}== Clearing Terraform state ==${NC}"
echo '{"version": 4, "terraform_version": "1.0.0", "serial": 1, "lineage": "", "outputs": {}, "resources": []}' > terraform.tfstate

# Function to clean up Route53 zones
cleanup_route53() {
    echo -e "\n${BLUE}== Cleaning up ALL Route53 zones for $DOMAIN ==${NC}"
    
    ZONE_IDS=$(aws route53 list-hosted-zones --query "HostedZones[?Name==\`${DOMAIN}.\`].Id" --output text)
    
    for zone_id in $ZONE_IDS; do
        clean_zone_id=${zone_id#/hostedzone/}
        echo "Processing zone: $clean_zone_id"
        
        # Delete all records except NS and SOA
        echo "  Deleting DNS records..."
        
        # Get all records
        RECORDS=$(aws route53 list-resource-record-sets --hosted-zone-id $clean_zone_id --output json)
        
        # Create change batch to delete all non-essential records
        CHANGE_BATCH=$(echo "$RECORDS" | jq '
        {
            "Changes": [
                .ResourceRecordSets[] | 
                select(.Type != "NS" and .Type != "SOA") | 
                {
                    "Action": "DELETE",
                    "ResourceRecordSet": .
                }
            ]
        }')
        
        # Only process if there are records to delete
        if [[ $(echo "$CHANGE_BATCH" | jq '.Changes | length') -gt 0 ]]; then
            echo "$CHANGE_BATCH" | aws route53 change-resource-record-sets --hosted-zone-id $clean_zone_id --change-batch file:///dev/stdin || echo "  Could not delete some records"
            sleep 10  # Wait for propagation
        fi
        
        # Now delete the zone
        echo "  Deleting hosted zone: $clean_zone_id"
        aws route53 delete-hosted-zone --id $clean_zone_id || echo "  Could not delete zone (may still have dependencies)"
    done
}

# Function to clean up VPCs and networking
cleanup_networking() {
    echo -e "\n${BLUE}== Cleaning up ALL VPCs and networking ==${NC}"
    
    # Get all non-default VPCs
    VPC_IDS=$(aws ec2 describe-vpcs --region $REGION --query 'Vpcs[?IsDefault==`false`].VpcId' --output text)
    
    for vpc_id in $VPC_IDS; do
        echo "Cleaning up VPC: $vpc_id"
        
        # Delete Load Balancers first (they prevent other cleanup)
        ALB_ARNS=$(aws elbv2 describe-load-balancers --region $REGION --query "LoadBalancers[?VpcId==\`$vpc_id\`].LoadBalancerArn" --output text)
        for alb_arn in $ALB_ARNS; do
            echo "  Deleting ALB: $alb_arn"
            aws elbv2 delete-load-balancer --load-balancer-arn $alb_arn --region $REGION || true
        done
        
        # Wait for ALBs to be deleted
        sleep 30
        
        # Delete Target Groups
        TG_ARNS=$(aws elbv2 describe-target-groups --region $REGION --query 'TargetGroups[].TargetGroupArn' --output text)
        for tg_arn in $TG_ARNS; do
            TG_VPC=$(aws elbv2 describe-target-groups --target-group-arns $tg_arn --query 'TargetGroups[0].VpcId' --output text)
            if [[ $TG_VPC == $vpc_id ]]; then
                echo "  Deleting Target Group: $tg_arn"
                aws elbv2 delete-target-group --target-group-arn $tg_arn --region $REGION || true
            fi
        done
        
        # Delete NAT Gateways
        NAT_IDS=$(aws ec2 describe-nat-gateways --region $REGION --filter "Name=vpc-id,Values=$vpc_id" --query 'NatGateways[?State==`available`].NatGatewayId' --output text)
        for nat_id in $NAT_IDS; do
            echo "  Deleting NAT Gateway: $nat_id"
            aws ec2 delete-nat-gateway --nat-gateway-id $nat_id --region $REGION || true
        done
        
        # Wait for NAT gateways
        sleep 30
        
        # Delete Internet Gateways
        IGW_IDS=$(aws ec2 describe-internet-gateways --region $REGION --filters "Name=attachment.vpc-id,Values=$vpc_id" --query 'InternetGateways[].InternetGatewayId' --output text)
        for igw_id in $IGW_IDS; do
            echo "  Detaching and deleting Internet Gateway: $igw_id"
            aws ec2 detach-internet-gateway --internet-gateway-id $igw_id --vpc-id $vpc_id --region $REGION || true
            aws ec2 delete-internet-gateway --internet-gateway-id $igw_id --region $REGION || true
        done
        
        # Delete Subnets
        SUBNET_IDS=$(aws ec2 describe-subnets --region $REGION --filters "Name=vpc-id,Values=$vpc_id" --query 'Subnets[].SubnetId' --output text)
        for subnet_id in $SUBNET_IDS; do
            echo "  Deleting subnet: $subnet_id"
            aws ec2 delete-subnet --subnet-id $subnet_id --region $REGION || true
        done
        
        # Delete Route Tables (except main)
        RT_IDS=$(aws ec2 describe-route-tables --region $REGION --filters "Name=vpc-id,Values=$vpc_id" --query 'RouteTables[?Associations[0].Main!=`true`].RouteTableId' --output text)
        for rt_id in $RT_IDS; do
            echo "  Deleting route table: $rt_id"
            aws ec2 delete-route-table --route-table-id $rt_id --region $REGION || true
        done
        
        # Delete Security Groups (except default)
        SG_IDS=$(aws ec2 describe-security-groups --region $REGION --filters "Name=vpc-id,Values=$vpc_id" --query 'SecurityGroups[?GroupName!=`default`].GroupId' --output text)
        for sg_id in $SG_IDS; do
            echo "  Deleting security group: $sg_id"
            aws ec2 delete-security-group --group-id $sg_id --region $REGION || true
        done
        
        # Delete Network ACLs (except default)
        NACL_IDS=$(aws ec2 describe-network-acls --region $REGION --filters "Name=vpc-id,Values=$vpc_id" --query 'NetworkAcls[?IsDefault!=`true`].NetworkAclId' --output text)
        for nacl_id in $NACL_IDS; do
            echo "  Deleting Network ACL: $nacl_id"
            aws ec2 delete-network-acl --network-acl-id $nacl_id --region $REGION || true
        done
        
        # Finally delete the VPC
        echo "  Deleting VPC: $vpc_id"
        aws ec2 delete-vpc --vpc-id $vpc_id --region $REGION || true
    done
}

# Function to clean up ECR repositories
cleanup_ecr() {
    echo -e "\n${BLUE}== Cleaning up ECR repositories ==${NC}"
    ECR_REPOS=$(aws ecr describe-repositories --region $REGION --query 'repositories[].repositoryName' --output text)
    for repo in $ECR_REPOS; do
        echo "Deleting ECR repository: $repo"
        aws ecr delete-repository --repository-name $repo --force --region $REGION || true
    done
}

# Function to clean up S3 buckets (except state bucket)
cleanup_s3() {
    echo -e "\n${BLUE}== Cleaning up S3 buckets (except state bucket) ==${NC}"
    S3_BUCKETS=$(aws s3api list-buckets --query "Buckets[?Name!=\`${STATE_BUCKET}\`].Name" --output text)
    for bucket in $S3_BUCKETS; do
        if [[ $bucket == *"cloud-apps"* ]] || [[ $bucket == *"mrchughes"* ]]; then
            echo "Deleting S3 bucket: $bucket"
            aws s3 rm s3://$bucket --recursive || true
            aws s3api delete-bucket --bucket $bucket || true
        fi
    done
}

# Function to clean up DynamoDB tables (except state locking table)
cleanup_dynamodb() {
    echo -e "\n${BLUE}== Cleaning up DynamoDB tables ==${NC}"
    DDB_TABLES=$(aws dynamodb list-tables --region $REGION --query 'TableNames[]' --output text)
    for table in $DDB_TABLES; do
        # Skip terraform state locking table
        if [[ $table != *"terraform"* ]] && [[ $table != *"lock"* ]]; then
            if [[ $table == *"cloud-apps"* ]] || [[ $table == *"app"* ]]; then
                echo "Deleting DynamoDB table: $table"
                aws dynamodb delete-table --table-name $table --region $REGION || true
            fi
        else
            echo "Preserving Terraform table: $table"
        fi
    done
}

# Function to clean up ACM certificates
cleanup_acm() {
    echo -e "\n${BLUE}== Cleaning up ACM certificates ==${NC}"
    
    # Clean certificates in us-east-1 (required for CloudFront/ALB)
    echo "Checking certificates in us-east-1..."
    CERT_ARNS_US_EAST=$(aws acm list-certificates --region us-east-1 --query "CertificateSummaryList[?DomainName=='${DOMAIN}' || DomainName=='*.${DOMAIN}' || contains(SubjectAlternativeNameSummaries, '${DOMAIN}')].CertificateArn" --output text 2>/dev/null || echo "")
    
    if [ -n "$CERT_ARNS_US_EAST" ]; then
        for cert_arn in $CERT_ARNS_US_EAST; do
            echo "  Deleting certificate in us-east-1: $cert_arn"
            
            # Check if certificate is in use
            CERT_IN_USE=$(aws acm describe-certificate --certificate-arn $cert_arn --region us-east-1 --query 'Certificate.InUse' --output text 2>/dev/null || echo "false")
            
            if [ "$CERT_IN_USE" = "true" ]; then
                echo "    ⚠️  Certificate is in use, will be deleted when resources are removed"
            else
                aws acm delete-certificate --certificate-arn $cert_arn --region us-east-1 || echo "    Could not delete certificate (may be in use)"
            fi
        done
    else
        echo "  No certificates found for domain $DOMAIN in us-east-1"
    fi
    
    # Also clean certificates in the default region
    echo "Checking certificates in $REGION..."
    CERT_ARNS_REGION=$(aws acm list-certificates --region $REGION --query "CertificateSummaryList[?DomainName=='${DOMAIN}' || DomainName=='*.${DOMAIN}' || contains(SubjectAlternativeNameSummaries, '${DOMAIN}')].CertificateArn" --output text 2>/dev/null || echo "")
    
    if [ -n "$CERT_ARNS_REGION" ]; then
        for cert_arn in $CERT_ARNS_REGION; do
            echo "  Deleting certificate in $REGION: $cert_arn"
            
            # Check if certificate is in use
            CERT_IN_USE=$(aws acm describe-certificate --certificate-arn $cert_arn --region $REGION --query 'Certificate.InUse' --output text 2>/dev/null || echo "false")
            
            if [ "$CERT_IN_USE" = "true" ]; then
                echo "    ⚠️  Certificate is in use, will be deleted when resources are removed"
            else
                aws acm delete-certificate --certificate-arn $cert_arn --region $REGION || echo "    Could not delete certificate (may be in use)"
            fi
        done
    else
        echo "  No certificates found for domain $DOMAIN in $REGION"
    fi
    
    echo "✓ ACM certificate cleanup complete"
}

# Function to clean up application IAM roles (preserve essential ones)
cleanup_iam() {
    echo -e "\n${BLUE}== Cleaning up application IAM roles ==${NC}"
    IAM_ROLES=$(aws iam list-roles --query 'Roles[].RoleName' --output text)
    for role in $IAM_ROLES; do
        # Preserve essential roles for Terraform and GitHub Actions
        if [[ $role != *"github"* ]] && [[ $role != *"terraform"* ]] && [[ $role != *"aws-service-role"* ]] && [[ $role != *"OrganizationAccountAccessRole"* ]]; then
            if [[ $role == *"cloud-apps"* ]] || [[ $role == *"ecs"* ]] || [[ $role == *"app"* ]]; then
                echo "Deleting IAM role: $role"
                
                # Detach policies first
                ATTACHED_POLICIES=$(aws iam list-attached-role-policies --role-name $role --query 'AttachedPolicies[].PolicyArn' --output text)
                for policy_arn in $ATTACHED_POLICIES; do
                    aws iam detach-role-policy --role-name $role --policy-arn $policy_arn || true
                done
                
                # Delete inline policies
                INLINE_POLICIES=$(aws iam list-role-policies --role-name $role --query 'PolicyNames[]' --output text)
                for policy_name in $INLINE_POLICIES; do
                    aws iam delete-role-policy --role-name $role --policy-name $policy_name || true
                done
                
                # Delete the role
                aws iam delete-role --role-name $role || true
            fi
        else
            echo "Preserving essential role: $role"
        fi
    done
}

# Function to clean up ECS clusters and services
cleanup_ecs() {
    echo -e "\n${BLUE}== Cleaning up ECS clusters and services ==${NC}"
    
    # Get all ECS clusters
    CLUSTERS=$(aws ecs list-clusters --region $REGION --query 'clusterArns[]' --output text)
    
    for cluster_arn in $CLUSTERS; do
        cluster_name=$(echo $cluster_arn | awk -F'/' '{print $NF}')
        echo "Processing ECS cluster: $cluster_name"
        
        # Get all services in the cluster
        SERVICES=$(aws ecs list-services --cluster $cluster_name --region $REGION --query 'serviceArns[]' --output text)
        
        for service_arn in $SERVICES; do
            service_name=$(echo $service_arn | awk -F'/' '{print $NF}')
            echo "  Scaling down service: $service_name"
            
            # Scale service to 0
            aws ecs update-service --cluster $cluster_name --service $service_name --desired-count 0 --region $REGION || true
            
            # Wait for tasks to drain
            echo "  Waiting for tasks to drain..."
            aws ecs wait services-stable --cluster $cluster_name --services $service_name --region $REGION || true
            
            # Delete the service
            echo "  Deleting service: $service_name"
            aws ecs delete-service --cluster $cluster_name --service $service_name --region $REGION || true
        done
        
        # Get all task definitions and deregister them
        TASK_DEFINITIONS=$(aws ecs list-task-definitions --region $REGION --query 'taskDefinitionArns[]' --output text)
        for task_def_arn in $TASK_DEFINITIONS; do
            echo "  Deregistering task definition: $(echo $task_def_arn | awk -F'/' '{print $NF}')"
            aws ecs deregister-task-definition --task-definition $task_def_arn --region $REGION || true
        done
        
        # Delete the cluster
        echo "  Deleting ECS cluster: $cluster_name"
        aws ecs delete-cluster --cluster $cluster_name --region $REGION || true
    done
}

# Function to clean up local Terraform files
cleanup_local_terraform() {
    echo -e "\n${BLUE}== Cleaning up local Terraform files ==${NC}"
    
    # Start from project root
    cd ../../
    
    echo "Cleaning up .terraform directories and plan files..."
    
    # Clean shared-infra
    if [ -d "shared-infra/terraform/.terraform" ]; then
        echo "  Removing shared-infra/.terraform directory"
        rm -rf shared-infra/terraform/.terraform
    fi
    if [ -f "shared-infra/terraform/tfplan" ]; then
        echo "  Removing shared-infra/tfplan"
        rm -f shared-infra/terraform/tfplan
    fi
    if [ -f "shared-infra/terraform/.terraform.lock.hcl" ]; then
        echo "  Removing shared-infra/.terraform.lock.hcl"
        rm -f shared-infra/terraform/.terraform.lock.hcl
    fi
    
    # Clean mern-app
    if [ -d "mern-app/terraform/.terraform" ]; then
        echo "  Removing mern-app/.terraform directory"
        rm -rf mern-app/terraform/.terraform
    fi
    if [ -f "mern-app/terraform/mern-tfplan" ]; then
        echo "  Removing mern-app/mern-tfplan"
        rm -f mern-app/terraform/mern-tfplan
    fi
    if [ -f "mern-app/terraform/.terraform.lock.hcl" ]; then
        echo "  Removing mern-app/.terraform.lock.hcl"
        rm -f mern-app/terraform/.terraform.lock.hcl
    fi
    
    # Clean python-app
    if [ -d "python-app/terraform/.terraform" ]; then
        echo "  Removing python-app/.terraform directory"
        rm -rf python-app/terraform/.terraform
    fi
    if [ -f "python-app/terraform/python-tfplan" ]; then
        echo "  Removing python-app/python-tfplan"
        rm -f python-app/terraform/python-tfplan
    fi
    if [ -f "python-app/terraform/.terraform.lock.hcl" ]; then
        echo "  Removing python-app/.terraform.lock.hcl"
        rm -f python-app/terraform/.terraform.lock.hcl
    fi
    
    echo "✓ Local Terraform cleanup complete"
    
    # Return to shared-infra/terraform for consistency
    cd shared-infra/terraform
}

# Function to verify cleanup completion
verify_cleanup() {
    echo -e "\n${BLUE}== Verifying cleanup completion ==${NC}"
    
    # Check VPCs
    CUSTOM_VPCS=$(aws ec2 describe-vpcs --region $REGION --query "Vpcs[?!IsDefault].VpcId" --output text)
    if [ -z "$CUSTOM_VPCS" ]; then
        echo "✅ No custom VPCs found"
    else
        echo "⚠️  Custom VPCs still exist: $CUSTOM_VPCS"
    fi
    
    # Check ECR repositories
    ECR_REPOS=$(aws ecr describe-repositories --region $REGION --query "repositories[].repositoryName" --output text 2>/dev/null | wc -l)
    if [ "$ECR_REPOS" -eq 0 ]; then
        echo "✅ No ECR repositories found"
    else
        echo "⚠️  ECR repositories still exist: $(aws ecr describe-repositories --region $REGION --query "repositories[].repositoryName" --output text 2>/dev/null)"
    fi
    
    # Check Route53 zones
    HOSTED_ZONES=$(aws route53 list-hosted-zones --query "HostedZones[?Name=='${DOMAIN}.'].Id" --output text)
    if [ -z "$HOSTED_ZONES" ]; then
        echo "✅ No Route53 zones found for $DOMAIN"
    else
        echo "⚠️  Route53 zones still exist: $HOSTED_ZONES"
    fi
    
    # Check ALBs
    ALB_COUNT=$(aws elbv2 describe-load-balancers --region $REGION --query "LoadBalancers[].LoadBalancerArn" --output text 2>/dev/null | wc -l)
    if [ "$ALB_COUNT" -eq 0 ]; then
        echo "✅ No Application Load Balancers found"
    else
        echo "⚠️  ALBs still exist: $(aws elbv2 describe-load-balancers --region $REGION --query "LoadBalancers[].LoadBalancerName" --output text 2>/dev/null)"
    fi
    
    # Check ECS clusters
    ECS_CLUSTERS=$(aws ecs list-clusters --region $REGION --query "clusterArns[?contains(@, 'cloud-apps')]" --output text 2>/dev/null)
    if [ -z "$ECS_CLUSTERS" ]; then
        echo "✅ No ECS clusters found"
    else
        echo "⚠️  ECS clusters still exist: $ECS_CLUSTERS"
    fi
    
    echo "✓ Verification complete"
}

# Execute cleanup functions in order
echo -e "\n${YELLOW}Starting complete cleanup...${NC}"

cleanup_ecs         # Clean ECS first (has dependencies on other resources)
cleanup_acm
cleanup_networking  # This includes ALBs, so do it early
cleanup_ecr
cleanup_s3
cleanup_dynamodb
cleanup_iam
cleanup_route53     # Do this last as it might have dependencies
cleanup_local_terraform  # Clean up local files
verify_cleanup      # Verify everything is clean

echo -e "\n${GREEN}== Complete Cleanup Finished! ==${NC}"
echo -e "${GREEN}Preserved infrastructure:${NC}"
echo -e "${GREEN}✓ S3 state bucket: $STATE_BUCKET${NC}"
echo -e "${GREEN}✓ DynamoDB state locking tables${NC}"
echo -e "${GREEN}✓ Essential IAM roles for Terraform/GitHub${NC}"

echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "${YELLOW}1. Run 'terraform init' to reinitialize${NC}"
echo -e "${YELLOW}2. Run 'terraform plan' to see what will be created fresh${NC}"
echo -e "${YELLOW}3. Run 'terraform apply' to create new infrastructure${NC}"
echo -e "${YELLOW}4. Update Namecheap DNS with new Route53 nameservers${NC}"

echo -e "\n${BLUE}Current Terraform state:${NC}"
terraform state list || echo "State is clean (empty)"
