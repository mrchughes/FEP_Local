#!/bin/bash

# Comprehensive AWS Resource Scanner
# Scans ALL AWS resources across ALL regions to detect any orphaned resources

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 COMPREHENSIVE AWS RESOURCE SCANNER${NC}"
echo "====================================="
echo "This will scan ALL regions for ALL resource types"
echo ""

# Get all available regions
echo -e "${CYAN}Getting all available AWS regions...${NC}"
ALL_REGIONS=$(aws ec2 describe-regions --query 'Regions[].RegionName' --output text)
echo "Regions to scan: $(echo $ALL_REGIONS | wc -w)"
echo ""

# Track findings
TOTAL_RESOURCES=0
declare -A RESOURCE_COUNT

# Function to check and count resources
check_resource() {
    local region=$1
    local service=$2
    local resource_type=$3
    local aws_command=$4
    local query=$5
    
    local result=$(eval "$aws_command --region $region --query '$query' --output text 2>/dev/null" || echo "")
    
    if [ -n "$result" ] && [ "$result" != "None" ] && [ "$result" != "" ]; then
        local count=$(echo "$result" | wc -w)
        if [ $count -gt 0 ]; then
            echo -e "  ${YELLOW}$resource_type${NC}: $count found"
            echo "    $result"
            TOTAL_RESOURCES=$((TOTAL_RESOURCES + count))
            RESOURCE_COUNT["$service-$resource_type"]+=$count
        fi
    fi
}

# Scan each region
for region in $ALL_REGIONS; do
    echo -e "${BLUE}📍 Scanning region: $region${NC}"
    echo "----------------------------------------"
    
    REGION_HAS_RESOURCES=false
    
    # EC2 Resources
    echo -e "${CYAN}EC2 Resources:${NC}"
    check_resource $region "EC2" "VPCs" "aws ec2 describe-vpcs" "Vpcs[?!IsDefault].VpcId"
    check_resource $region "EC2" "Instances" "aws ec2 describe-instances" "Reservations[].Instances[?State.Name!='terminated'].InstanceId"
    check_resource $region "EC2" "Security-Groups" "aws ec2 describe-security-groups" "SecurityGroups[?GroupName!='default'].GroupId"
    check_resource $region "EC2" "Key-Pairs" "aws ec2 describe-key-pairs" "KeyPairs[].KeyName"
    check_resource $region "EC2" "Elastic-IPs" "aws ec2 describe-addresses" "Addresses[].AllocationId"
    check_resource $region "EC2" "NAT-Gateways" "aws ec2 describe-nat-gateways" "NatGateways[?State=='available'].NatGatewayId"
    check_resource $region "EC2" "Internet-Gateways" "aws ec2 describe-internet-gateways" "InternetGateways[?length(Attachments)==\`0\`].InternetGatewayId"
    
    # ECS Resources
    echo -e "${CYAN}ECS Resources:${NC}"
    check_resource $region "ECS" "Clusters" "aws ecs list-clusters" "clusterArns"
    
    # ECR Resources
    echo -e "${CYAN}ECR Resources:${NC}"
    check_resource $region "ECR" "Repositories" "aws ecr describe-repositories" "repositories[].repositoryName"
    
    # ELB Resources
    echo -e "${CYAN}Load Balancer Resources:${NC}"
    check_resource $region "ELB" "ALBs" "aws elbv2 describe-load-balancers" "LoadBalancers[].LoadBalancerName"
    check_resource $region "ELB" "Target-Groups" "aws elbv2 describe-target-groups" "TargetGroups[].TargetGroupName"
    check_resource $region "ELB" "Classic-LBs" "aws elb describe-load-balancers" "LoadBalancerDescriptions[].LoadBalancerName"
    
    # RDS Resources
    echo -e "${CYAN}RDS Resources:${NC}"
    check_resource $region "RDS" "DB-Instances" "aws rds describe-db-instances" "DBInstances[].DBInstanceIdentifier"
    check_resource $region "RDS" "DB-Clusters" "aws rds describe-db-clusters" "DBClusters[].DBClusterIdentifier"
    
    # DynamoDB Resources
    echo -e "${CYAN}DynamoDB Resources:${NC}"
    check_resource $region "DynamoDB" "Tables" "aws dynamodb list-tables" "TableNames"
    
    # S3 Resources (only in us-east-1 since S3 is global)
    if [ "$region" == "us-east-1" ]; then
        echo -e "${CYAN}S3 Resources (Global):${NC}"
        check_resource $region "S3" "Buckets" "aws s3api list-buckets" "Buckets[].Name"
    fi
    
    # Lambda Resources
    echo -e "${CYAN}Lambda Resources:${NC}"
    check_resource $region "Lambda" "Functions" "aws lambda list-functions" "Functions[].FunctionName"
    
    # CloudFormation Resources
    echo -e "${CYAN}CloudFormation Resources:${NC}"
    check_resource $region "CloudFormation" "Stacks" "aws cloudformation describe-stacks" "Stacks[?StackStatus!='DELETE_COMPLETE'].StackName"
    
    # ACM Certificates
    echo -e "${CYAN}ACM Certificates:${NC}"
    check_resource $region "ACM" "Certificates" "aws acm list-certificates" "CertificateSummaryList[].DomainName"
    
    # Route53 (only in us-east-1 since it's global)
    if [ "$region" == "us-east-1" ]; then
        echo -e "${CYAN}Route53 Resources (Global):${NC}"
        check_resource $region "Route53" "Hosted-Zones" "aws route53 list-hosted-zones" "HostedZones[].Name"
    fi
    
    # IAM (only in us-east-1 since it's global)
    if [ "$region" == "us-east-1" ]; then
        echo -e "${CYAN}IAM Resources (Global):${NC}"
        check_resource $region "IAM" "Users" "aws iam list-users" "Users[].UserName"
        check_resource $region "IAM" "Roles" "aws iam list-roles" "Roles[?!starts_with(RoleName, 'AWS')].RoleName"
        check_resource $region "IAM" "Policies" "aws iam list-policies" "Policies[?!starts_with(PolicyName, 'AWS')].PolicyName"
    fi
    
    # Auto Scaling Resources
    echo -e "${CYAN}Auto Scaling Resources:${NC}"
    check_resource $region "AutoScaling" "Groups" "aws autoscaling describe-auto-scaling-groups" "AutoScalingGroups[].AutoScalingGroupName"
    
    # ElastiCache Resources
    echo -e "${CYAN}ElastiCache Resources:${NC}"
    check_resource $region "ElastiCache" "Clusters" "aws elasticache describe-cache-clusters" "CacheClusters[].CacheClusterId"
    
    # CloudWatch Resources
    echo -e "${CYAN}CloudWatch Resources:${NC}"
    check_resource $region "CloudWatch" "Alarms" "aws cloudwatch describe-alarms" "MetricAlarms[].AlarmName"
    
    # API Gateway
    echo -e "${CYAN}API Gateway Resources:${NC}"
    check_resource $region "APIGateway" "REST-APIs" "aws apigateway get-rest-apis" "items[].name"
    check_resource $region "APIGateway" "HTTP-APIs" "aws apigatewayv2 get-apis" "Items[].Name"
    
    # Secrets Manager
    echo -e "${CYAN}Secrets Manager:${NC}"
    check_resource $region "SecretsManager" "Secrets" "aws secretsmanager list-secrets" "SecretList[].Name"
    
    echo ""
done

# Summary
echo -e "${BLUE}📊 SCAN SUMMARY${NC}"
echo "================"
echo -e "Total resources found: ${YELLOW}$TOTAL_RESOURCES${NC}"

if [ $TOTAL_RESOURCES -eq 0 ]; then
    echo -e "${GREEN}🎉 No resources found! Your AWS account is clean.${NC}"
else
    echo -e "${RED}⚠️  Resources found that may need cleanup:${NC}"
    echo ""
    for key in "${!RESOURCE_COUNT[@]}"; do
        echo -e "  ${YELLOW}$key${NC}: ${RESOURCE_COUNT[$key]}"
    done
    
    echo ""
    echo -e "${YELLOW}💡 Recommendations:${NC}"
    echo "1. Review the resources listed above"
    echo "2. Delete any unnecessary resources to avoid charges"
    echo "3. Verify that remaining resources are intentional"
    echo ""
    echo -e "${RED}💰 Estimated monthly cost impact: \$10-\$500+ depending on resource types${NC}"
fi

echo ""
echo -e "${BLUE}🔍 Scan completed at $(date)${NC}"
