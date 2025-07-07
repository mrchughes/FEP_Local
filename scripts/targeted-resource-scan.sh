#!/bin/bash

# Targeted AWS Resource Scan - Focus on Billable Resources
# This script checks for the most common resources that cause unexpected charges

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Main regions to check (most commonly used)
REGIONS=("us-east-1" "us-west-2" "eu-west-1" "eu-west-2" "ap-southeast-1")

echo -e "${BLUE}🔍 TARGETED AWS RESOURCE SCAN${NC}"
echo "============================="
echo -e "${YELLOW}Checking for billable resources across major regions...${NC}"
echo ""

TOTAL_RESOURCES=0
BILLABLE_RESOURCES=()

# Function to check resources in a region
check_region() {
    local region=$1
    local region_resources=0
    
    echo -e "${BLUE}📍 Region: $region${NC}"
    echo "─────────────────────"
    
    # 1. EC2 Instances (EXPENSIVE)
    echo -n "EC2 Instances: "
    INSTANCES=$(aws ec2 describe-instances --region $region --query 'Reservations[].Instances[?State.Name!=`terminated`].InstanceId' --output text 2>/dev/null | wc -w)
    if [ "$INSTANCES" -gt 0 ]; then
        echo -e "${RED}$INSTANCES found ⚠️${NC}"
        BILLABLE_RESOURCES+=("$region: $INSTANCES EC2 instances")
        region_resources=$((region_resources + INSTANCES))
    else
        echo -e "${GREEN}0${NC}"
    fi
    
    # 2. RDS Instances (EXPENSIVE)
    echo -n "RDS Instances: "
    RDS=$(aws rds describe-db-instances --region $region --query 'length(DBInstances)' --output text 2>/dev/null || echo "0")
    if [ "$RDS" -gt 0 ]; then
        echo -e "${RED}$RDS found ⚠️${NC}"
        BILLABLE_RESOURCES+=("$region: $RDS RDS instances")
        region_resources=$((region_resources + RDS))
    else
        echo -e "${GREEN}0${NC}"
    fi
    
    # 3. NAT Gateways (EXPENSIVE)
    echo -n "NAT Gateways: "
    NATS=$(aws ec2 describe-nat-gateways --region $region --query 'NatGateways[?State==`available`].NatGatewayId' --output text 2>/dev/null | wc -w)
    if [ "$NATS" -gt 0 ]; then
        echo -e "${RED}$NATS found ⚠️${NC}"
        BILLABLE_RESOURCES+=("$region: $NATS NAT Gateways")
        region_resources=$((region_resources + NATS))
    else
        echo -e "${GREEN}0${NC}"
    fi
    
    # 4. Load Balancers
    echo -n "Load Balancers: "
    ALBS=$(aws elbv2 describe-load-balancers --region $region --query 'length(LoadBalancers)' --output text 2>/dev/null || echo "0")
    if [ "$ALBS" -gt 0 ]; then
        echo -e "${YELLOW}$ALBS found${NC}"
        BILLABLE_RESOURCES+=("$region: $ALBS Load Balancers")
        region_resources=$((region_resources + ALBS))
    else
        echo -e "${GREEN}0${NC}"
    fi
    
    # 5. ECS Clusters/Services
    echo -n "ECS Clusters: "
    ECS=$(aws ecs list-clusters --region $region --query 'length(clusterArns)' --output text 2>/dev/null || echo "0")
    if [ "$ECS" -gt 0 ]; then
        echo -e "${YELLOW}$ECS found${NC}"
        region_resources=$((region_resources + ECS))
    else
        echo -e "${GREEN}0${NC}"
    fi
    
    # 6. VPCs (check for non-default)
    echo -n "Custom VPCs: "
    VPCS=$(aws ec2 describe-vpcs --region $region --query 'Vpcs[?!IsDefault].VpcId' --output text 2>/dev/null | wc -w)
    if [ "$VPCS" -gt 0 ]; then
        echo -e "${YELLOW}$VPCS found${NC}"
        region_resources=$((region_resources + VPCS))
    else
        echo -e "${GREEN}0${NC}"
    fi
    
    # 7. S3 Buckets (global, but check once)
    if [ "$region" = "us-east-1" ]; then
        echo -n "S3 Buckets: "
        S3=$(aws s3api list-buckets --query 'length(Buckets)' --output text 2>/dev/null || echo "0")
        if [ "$S3" -gt 0 ]; then
            echo -e "${YELLOW}$S3 found${NC}"
            region_resources=$((region_resources + S3))
        else
            echo -e "${GREEN}0${NC}"
        fi
    fi
    
    # 8. Route53 Hosted Zones (global, but check once)
    if [ "$region" = "us-east-1" ]; then
        echo -n "Route53 Zones: "
        R53=$(aws route53 list-hosted-zones --query 'length(HostedZones)' --output text 2>/dev/null || echo "0")
        if [ "$R53" -gt 0 ]; then
            echo -e "${YELLOW}$R53 found${NC}"
            region_resources=$((region_resources + R53))
        else
            echo -e "${GREEN}0${NC}"
        fi
    fi
    
    # 9. CloudFront Distributions (global, but check once)
    if [ "$region" = "us-east-1" ]; then
        echo -n "CloudFront: "
        CF=$(aws cloudfront list-distributions --query 'length(DistributionList.Items)' --output text 2>/dev/null || echo "0")
        if [ "$CF" -gt 0 ]; then
            echo -e "${YELLOW}$CF found${NC}"
            region_resources=$((region_resources + CF))
        else
            echo -e "${GREEN}0${NC}"
        fi
    fi
    
    echo ""
    TOTAL_RESOURCES=$((TOTAL_RESOURCES + region_resources))
}

# Check each region
for region in "${REGIONS[@]}"; do
    check_region $region
done

# Summary
echo -e "${BLUE}📊 SUMMARY${NC}"
echo "=========="
echo "Total resources found: $TOTAL_RESOURCES"
echo ""

if [ ${#BILLABLE_RESOURCES[@]} -gt 0 ]; then
    echo -e "${RED}⚠️  HIGH-COST RESOURCES DETECTED:${NC}"
    for resource in "${BILLABLE_RESOURCES[@]}"; do
        echo -e "${RED}  • $resource${NC}"
    done
    echo ""
    echo -e "${YELLOW}💡 Consider cleaning these up to avoid charges${NC}"
else
    echo -e "${GREEN}✅ No high-cost resources detected${NC}"
fi

if [ "$TOTAL_RESOURCES" -eq 0 ]; then
    echo -e "${GREEN}🎉 Your AWS account is clean!${NC}"
else
    echo -e "${YELLOW}📋 Review the resources above to ensure they're needed${NC}"
fi

echo ""
echo -e "${BLUE}💰 For detailed billing analysis, check AWS Cost Explorer${NC}"
