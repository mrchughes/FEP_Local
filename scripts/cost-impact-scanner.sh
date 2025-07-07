#!/bin/bash

# Quick Cost-Impact Resource Scanner
# Focuses on resources that typically incur the highest costs

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${RED}💰 HIGH-COST RESOURCE SCANNER${NC}"
echo "=============================="
echo "Scanning for resources that typically incur high costs"
echo ""

# Common high-cost regions to check
HIGH_COST_REGIONS=("us-east-1" "us-west-2" "eu-west-1" "eu-west-2" "ap-southeast-1")

total_cost_risk=0

for region in "${HIGH_COST_REGIONS[@]}"; do
    echo -e "${BLUE}📍 Checking high-cost resources in: $region${NC}"
    echo "------------------------------------------------"
    
    # EC2 Instances (highest cost risk)
    instances=$(aws ec2 describe-instances --region $region --query 'Reservations[].Instances[?State.Name==`running`].[InstanceId,InstanceType]' --output text 2>/dev/null || echo "")
    if [ -n "$instances" ]; then
        instance_count=$(echo "$instances" | wc -l)
        echo -e "  ${RED}🚨 Running EC2 Instances: $instance_count${NC}"
        echo "$instances" | while read line; do
            echo "    $line"
        done
        total_cost_risk=$((total_cost_risk + instance_count * 50)) # Estimate $50/month per instance
    fi
    
    # RDS Instances (high cost)
    rds_instances=$(aws rds describe-db-instances --region $region --query 'DBInstances[?DBInstanceStatus==`available`].[DBInstanceIdentifier,DBInstanceClass]' --output text 2>/dev/null || echo "")
    if [ -n "$rds_instances" ]; then
        rds_count=$(echo "$rds_instances" | wc -l)
        echo -e "  ${RED}🚨 Running RDS Instances: $rds_count${NC}"
        echo "$rds_instances" | while read line; do
            echo "    $line"
        done
        total_cost_risk=$((total_cost_risk + rds_count * 30)) # Estimate $30/month per RDS
    fi
    
    # NAT Gateways (moderate cost)
    nat_gws=$(aws ec2 describe-nat-gateways --region $region --query 'NatGateways[?State==`available`].NatGatewayId' --output text 2>/dev/null || echo "")
    if [ -n "$nat_gws" ]; then
        nat_count=$(echo "$nat_gws" | wc -w)
        echo -e "  ${YELLOW}⚠️  NAT Gateways: $nat_count${NC}"
        echo "    $nat_gws"
        total_cost_risk=$((total_cost_risk + nat_count * 45)) # $45/month per NAT Gateway
    fi
    
    # Application Load Balancers (moderate cost)
    albs=$(aws elbv2 describe-load-balancers --region $region --query 'LoadBalancers[].LoadBalancerName' --output text 2>/dev/null || echo "")
    if [ -n "$albs" ]; then
        alb_count=$(echo "$albs" | wc -w)
        echo -e "  ${YELLOW}⚠️  Application Load Balancers: $alb_count${NC}"
        echo "    $albs"
        total_cost_risk=$((total_cost_risk + alb_count * 25)) # $25/month per ALB
    fi
    
    # Elastic IPs (if not attached)
    eips=$(aws ec2 describe-addresses --region $region --query 'Addresses[?!InstanceId].AllocationId' --output text 2>/dev/null || echo "")
    if [ -n "$eips" ]; then
        eip_count=$(echo "$eips" | wc -w)
        echo -e "  ${YELLOW}⚠️  Unattached Elastic IPs: $eip_count${NC}"
        echo "    $eips"
        total_cost_risk=$((total_cost_risk + eip_count * 4)) # $4/month per unattached EIP
    fi
    
    # ECS Services with running tasks
    clusters=$(aws ecs list-clusters --region $region --query 'clusterArns' --output text 2>/dev/null || echo "")
    if [ -n "$clusters" ]; then
        for cluster in $clusters; do
            services=$(aws ecs list-services --cluster $cluster --region $region --query 'serviceArns' --output text 2>/dev/null || echo "")
            if [ -n "$services" ]; then
                service_count=$(echo "$services" | wc -w)
                echo -e "  ${YELLOW}⚠️  ECS Services in $(basename $cluster): $service_count${NC}"
                total_cost_risk=$((total_cost_risk + service_count * 20)) # $20/month per service
            fi
        done
    fi
    
    echo ""
done

# Check S3 buckets (global)
echo -e "${BLUE}📍 Checking S3 Buckets (Global)${NC}"
echo "-------------------------------"
buckets=$(aws s3api list-buckets --query 'Buckets[].Name' --output text 2>/dev/null || echo "")
if [ -n "$buckets" ]; then
    bucket_count=$(echo "$buckets" | wc -w)
    echo -e "  ${YELLOW}⚠️  S3 Buckets: $bucket_count${NC}"
    for bucket in $buckets; do
        size=$(aws s3 ls s3://$bucket --recursive --summarize 2>/dev/null | grep "Total Size" | awk '{print $3}' || echo "0")
        echo "    $bucket (size: $size bytes)"
    done
    total_cost_risk=$((total_cost_risk + bucket_count * 5)) # $5/month per bucket estimate
fi

echo ""
echo -e "${BLUE}💰 COST RISK SUMMARY${NC}"
echo "===================="
if [ $total_cost_risk -eq 0 ]; then
    echo -e "${GREEN}🎉 No high-cost resources detected!${NC}"
else
    echo -e "${RED}⚠️  Estimated monthly cost risk: \$$total_cost_risk${NC}"
    echo ""
    echo -e "${YELLOW}💡 Immediate actions recommended:${NC}"
    echo "1. Stop/terminate any unused EC2 instances"
    echo "2. Delete unused RDS instances"
    echo "3. Remove unnecessary NAT Gateways"
    echo "4. Delete unused Load Balancers"
    echo "5. Release unattached Elastic IPs"
    echo "6. Scale down ECS services to 0 if not needed"
    echo "7. Empty and delete unused S3 buckets"
fi

echo ""
echo -e "${BLUE}📊 Scan completed at $(date)${NC}"
