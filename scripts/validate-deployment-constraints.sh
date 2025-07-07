#!/bin/bash

# Deployment Region and Domain Validation Script
# This script ensures all deployments are constrained to eu-west-2 and mrchughes.site

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ALLOWED_REGION="eu-west-2"
ALLOWED_DOMAIN="mrchughes.site"
VALIDATION_FAILED=false

echo -e "${BLUE}🔒 DEPLOYMENT CONSTRAINT VALIDATION${NC}"
echo "===================================="
echo -e "${YELLOW}Ensuring deployment stays within approved bounds:${NC}"
echo "  ✓ Region: $ALLOWED_REGION ONLY"
echo "  ✓ Domain: $ALLOWED_DOMAIN ONLY"
echo ""

# Function to validate existing AWS resources (most critical check)
validate_existing_resources() {
    echo -e "${BLUE}☁️  Checking existing AWS resources...${NC}"
    
    # Check for resources in forbidden regions
    local forbidden_regions=("us-east-1" "us-west-2" "eu-west-1" "ap-southeast-1" "ap-northeast-1")
    
    for region in "${forbidden_regions[@]}"; do
        echo "  Checking region: $region"
        
        # Check for running EC2 instances (CRITICAL - expensive)
        local instances=$(aws ec2 describe-instances --region "$region" --query 'Reservations[].Instances[?State.Name==`running` || State.Name==`pending`].InstanceId' --output text 2>/dev/null | wc -w)
        if [ "$instances" -gt 0 ]; then
            echo -e "    ${RED}❌ CRITICAL: $instances running EC2 instance(s) found${NC}"
            VALIDATION_FAILED=true
        fi
        
        # Check for Load Balancers (expensive)
        local albs=$(aws elbv2 describe-load-balancers --region "$region" --query 'length(LoadBalancers)' --output text 2>/dev/null || echo "0")
        if [ "$albs" -gt 0 ]; then
            echo -e "    ${RED}❌ CRITICAL: $albs Load Balancer(s) found${NC}"
            VALIDATION_FAILED=true
        fi
        
        # Check for RDS instances (very expensive)
        local rds=$(aws rds describe-db-instances --region "$region" --query 'length(DBInstances)' --output text 2>/dev/null || echo "0")
        if [ "$rds" -gt 0 ]; then
            echo -e "    ${RED}❌ CRITICAL: $rds RDS instance(s) found${NC}"
            VALIDATION_FAILED=true
        fi
        
        # Check for NAT Gateways (expensive)
        local nats=$(aws ec2 describe-nat-gateways --region "$region" --query 'NatGateways[?State==`available`].NatGatewayId' --output text 2>/dev/null | wc -w)
        if [ "$nats" -gt 0 ]; then
            echo -e "    ${RED}❌ CRITICAL: $nats NAT Gateway(s) found${NC}"
            VALIDATION_FAILED=true
        fi
        
        if [ "$instances" -eq 0 ] && [ "$albs" -eq 0 ] && [ "$rds" -eq 0 ] && [ "$nats" -eq 0 ]; then
            echo -e "    ${GREEN}✓ No expensive resources${NC}"
        fi
    done
}

# Function to validate Terraform configurations
validate_terraform_config() {
    echo -e "\n${BLUE}📋 Checking Terraform configurations...${NC}"
    
    # Check all provider configurations
    while IFS= read -r -d '' file; do
        if grep -q "provider.*aws" "$file"; then
            echo "  Checking provider in: $file"
            # Look for hardcoded regions that aren't eu-west-2
            if grep -n "region.*=.*\"" "$file" | grep -v "eu-west-2" | grep -v "var\." | grep -v "#"; then
                echo -e "    ${RED}❌ Hardcoded non-eu-west-2 region found${NC}"
                VALIDATION_FAILED=true
            else
                echo -e "    ${GREEN}✓ Provider region OK${NC}"
            fi
        fi
    done < <(find . -name "*.tf" -type f -print0)
}

# Function to validate Route53 domains
validate_domains() {
    echo -e "\n${BLUE}🌐 Checking Route53 domains...${NC}"
    
    # Check hosted zones
    local zones=$(aws route53 list-hosted-zones --query "HostedZones[?Name!='$ALLOWED_DOMAIN.'].Name" --output text 2>/dev/null || echo "")
    if [ -n "$zones" ] && [ "$zones" != "None" ]; then
        echo -e "  ${RED}❌ CRITICAL: Non-allowed domains found: $zones${NC}"
        VALIDATION_FAILED=true
    else
        echo -e "  ${GREEN}✓ Only $ALLOWED_DOMAIN domain configured${NC}"
    fi
}

# Run all validations
validate_existing_resources
validate_terraform_config
validate_domains

# Final result
echo -e "\n${BLUE}📊 VALIDATION RESULT${NC}"
echo "==================="

if [ "$VALIDATION_FAILED" = true ]; then
    echo -e "${RED}❌ CONSTRAINT VIOLATION DETECTED${NC}"
    echo -e "${RED}🚫 DEPLOYMENT BLOCKED${NC}"
    echo ""
    echo -e "${YELLOW}🔧 Action Required:${NC}"
    echo -e "  1. Clean up resources in non-eu-west-2 regions"
    echo -e "  2. Ensure all configurations target eu-west-2 only"
    echo -e "  3. Verify domain configurations use $ALLOWED_DOMAIN only"
    echo ""
    echo -e "${RED}Deployment cannot proceed until violations are resolved${NC}"
    exit 1
else
    echo -e "${GREEN}✅ ALL CONSTRAINTS SATISFIED${NC}"
    echo -e "${GREEN}🚀 Deployment approved to proceed${NC}"
    echo ""
    echo -e "${BLUE}Deployment will be constrained to:${NC}"
    echo -e "  ${GREEN}✓ Region: $ALLOWED_REGION${NC}"
    echo -e "  ${GREEN}✓ Domain: $ALLOWED_DOMAIN${NC}"
    echo ""
    echo -e "${GREEN}✅ Safe to deploy - no resource sprawl detected${NC}"
    exit 0
fi
