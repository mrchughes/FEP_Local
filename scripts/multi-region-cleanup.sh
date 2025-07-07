#!/bin/bash

# Comprehensive Multi-Region Cleanup Script
# This script cleans up AWS resources that were accidentally created outside eu-west-2

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MAIN_REGION="eu-west-2"
CLEANUP_REGIONS=("us-east-1" "us-west-2" "eu-west-1" "ap-southeast-1")
DOMAIN="mrchughes.site"

echo -e "${RED}🚨 MULTI-REGION CLEANUP SCRIPT${NC}"
echo "================================"
echo -e "${YELLOW}⚠️  This will DELETE resources in regions other than $MAIN_REGION${NC}"
echo ""

# Function to cleanup resources in a region
cleanup_region() {
    local region=$1
    echo -e "\n${BLUE}🧹 Cleaning up region: $region${NC}"
    echo "----------------------------------------"
    
    # 1. Delete ECS Services and Clusters
    echo "Checking ECS clusters..."
    CLUSTERS=$(aws ecs list-clusters --region $region --query 'clusterArns' --output text 2>/dev/null || echo "")
    if [ -n "$CLUSTERS" ] && [ "$CLUSTERS" != "None" ]; then
        for cluster_arn in $CLUSTERS; do
            cluster_name=$(basename $cluster_arn)
            echo "  Deleting services in cluster: $cluster_name"
            
            # Delete services
            SERVICES=$(aws ecs list-services --cluster $cluster_arn --region $region --query 'serviceArns' --output text 2>/dev/null || echo "")
            if [ -n "$SERVICES" ] && [ "$SERVICES" != "None" ]; then
                for service_arn in $SERVICES; do
                    service_name=$(basename $service_arn)
                    echo "    Scaling down service: $service_name"
                    aws ecs update-service --cluster $cluster_name --service $service_name --desired-count 0 --region $region >/dev/null 2>&1 || true
                    echo "    Deleting service: $service_name"
                    aws ecs delete-service --cluster $cluster_name --service $service_name --region $region >/dev/null 2>&1 || true
                done
            fi
            
            echo "  Deleting cluster: $cluster_name"
            aws ecs delete-cluster --cluster $cluster_name --region $region >/dev/null 2>&1 || true
        done
    else
        echo "  No ECS clusters found"
    fi
    
    # 2. Delete Load Balancers
    echo "Checking Load Balancers..."
    LB_ARNS=$(aws elbv2 describe-load-balancers --region $region --query 'LoadBalancers[].LoadBalancerArn' --output text 2>/dev/null || echo "")
    if [ -n "$LB_ARNS" ] && [ "$LB_ARNS" != "None" ]; then
        for lb_arn in $LB_ARNS; do
            lb_name=$(aws elbv2 describe-load-balancers --load-balancer-arns $lb_arn --region $region --query 'LoadBalancers[0].LoadBalancerName' --output text)
            echo "  Deleting Load Balancer: $lb_name"
            aws elbv2 delete-load-balancer --load-balancer-arn $lb_arn --region $region >/dev/null 2>&1 || true
        done
    else
        echo "  No Load Balancers found"
    fi
    
    # 3. Delete Target Groups
    echo "Checking Target Groups..."
    TG_ARNS=$(aws elbv2 describe-target-groups --region $region --query 'TargetGroups[].TargetGroupArn' --output text 2>/dev/null || echo "")
    if [ -n "$TG_ARNS" ] && [ "$TG_ARNS" != "None" ]; then
        for tg_arn in $TG_ARNS; do
            tg_name=$(aws elbv2 describe-target-groups --target-group-arns $tg_arn --region $region --query 'TargetGroups[0].TargetGroupName' --output text)
            echo "  Deleting Target Group: $tg_name"
            aws elbv2 delete-target-group --target-group-arn $tg_arn --region $region >/dev/null 2>&1 || true
        done
    else
        echo "  No Target Groups found"
    fi
    
    # 4. Delete ECR Repositories
    echo "Checking ECR repositories..."
    REPOS=$(aws ecr describe-repositories --region $region --query 'repositories[].repositoryName' --output text 2>/dev/null || echo "")
    if [ -n "$REPOS" ] && [ "$REPOS" != "None" ]; then
        for repo in $REPOS; do
            echo "  Deleting ECR repository: $repo"
            aws ecr delete-repository --repository-name $repo --force --region $region >/dev/null 2>&1 || true
        done
    else
        echo "  No ECR repositories found"
    fi
    
    # 5. Delete VPC resources (subnets, security groups, etc.)
    echo "Checking VPCs..."
    VPCS=$(aws ec2 describe-vpcs --region $region --query 'Vpcs[?!IsDefault].VpcId' --output text 2>/dev/null || echo "")
    if [ -n "$VPCS" ] && [ "$VPCS" != "None" ]; then
        for vpc_id in $VPCS; do
            echo "  Processing VPC: $vpc_id"
            
            # Delete NAT Gateways
            NAT_GWS=$(aws ec2 describe-nat-gateways --region $region --filter "Name=vpc-id,Values=$vpc_id" --query 'NatGateways[?State==`available`].NatGatewayId' --output text 2>/dev/null || echo "")
            if [ -n "$NAT_GWS" ] && [ "$NAT_GWS" != "None" ]; then
                for nat_gw in $NAT_GWS; do
                    echo "    Deleting NAT Gateway: $nat_gw"
                    aws ec2 delete-nat-gateway --nat-gateway-id $nat_gw --region $region >/dev/null 2>&1 || true
                done
                echo "    Waiting for NAT Gateways to delete..."
                sleep 30
            fi
            
            # Delete Internet Gateways
            IGW_IDS=$(aws ec2 describe-internet-gateways --region $region --filters "Name=attachment.vpc-id,Values=$vpc_id" --query 'InternetGateways[].InternetGatewayId' --output text 2>/dev/null || echo "")
            if [ -n "$IGW_IDS" ] && [ "$IGW_IDS" != "None" ]; then
                for igw_id in $IGW_IDS; do
                    echo "    Detaching and deleting Internet Gateway: $igw_id"
                    aws ec2 detach-internet-gateway --internet-gateway-id $igw_id --vpc-id $vpc_id --region $region >/dev/null 2>&1 || true
                    aws ec2 delete-internet-gateway --internet-gateway-id $igw_id --region $region >/dev/null 2>&1 || true
                done
            fi
            
            # Delete Subnets
            SUBNET_IDS=$(aws ec2 describe-subnets --region $region --filters "Name=vpc-id,Values=$vpc_id" --query 'Subnets[].SubnetId' --output text 2>/dev/null || echo "")
            if [ -n "$SUBNET_IDS" ] && [ "$SUBNET_IDS" != "None" ]; then
                for subnet_id in $SUBNET_IDS; do
                    echo "    Deleting subnet: $subnet_id"
                    aws ec2 delete-subnet --subnet-id $subnet_id --region $region >/dev/null 2>&1 || true
                done
            fi
            
            # Delete Route Tables (non-main)
            RT_IDS=$(aws ec2 describe-route-tables --region $region --filters "Name=vpc-id,Values=$vpc_id" --query 'RouteTables[?!Associations[?Main==`true`]].RouteTableId' --output text 2>/dev/null || echo "")
            if [ -n "$RT_IDS" ] && [ "$RT_IDS" != "None" ]; then
                for rt_id in $RT_IDS; do
                    echo "    Deleting route table: $rt_id"
                    aws ec2 delete-route-table --route-table-id $rt_id --region $region >/dev/null 2>&1 || true
                done
            fi
            
            # Delete Security Groups (non-default)
            SG_IDS=$(aws ec2 describe-security-groups --region $region --filters "Name=vpc-id,Values=$vpc_id" --query 'SecurityGroups[?GroupName!=`default`].GroupId' --output text 2>/dev/null || echo "")
            if [ -n "$SG_IDS" ] && [ "$SG_IDS" != "None" ]; then
                for sg_id in $SG_IDS; do
                    echo "    Deleting security group: $sg_id"
                    aws ec2 delete-security-group --group-id $sg_id --region $region >/dev/null 2>&1 || true
                done
            fi
            
            # Finally delete VPC
            echo "    Deleting VPC: $vpc_id"
            aws ec2 delete-vpc --vpc-id $vpc_id --region $region >/dev/null 2>&1 || true
        done
    else
        echo "  No non-default VPCs found"
    fi
    
    echo -e "${GREEN}✓ Region $region cleanup complete${NC}"
}

# Main execution
echo -e "${YELLOW}Starting multi-region cleanup...${NC}"
echo ""

for region in "${CLEANUP_REGIONS[@]}"; do
    cleanup_region $region
done

echo -e "\n${GREEN}🎉 Multi-region cleanup complete!${NC}"
echo -e "${BLUE}💡 Recommendation: Verify your Terraform configuration only targets $MAIN_REGION${NC}"
