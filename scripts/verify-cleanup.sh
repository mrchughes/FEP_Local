#!/bin/bash

# Quick Cleanup Verification Script
# Checks if AWS cleanup was successful

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

REGION="eu-west-2"
DOMAIN="mrchughes.site"

echo -e "${BLUE}🔍 CLEANUP VERIFICATION${NC}"
echo -e "${BLUE}========================${NC}"

# Check AWS credentials
echo -e "\n${BLUE}== Checking AWS Credentials ==${NC}"
if aws sts get-caller-identity >/dev/null 2>&1; then
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    echo -e "✅ AWS credentials valid - Account: $ACCOUNT_ID"
else
    echo -e "❌ AWS credentials not configured"
    exit 1
fi

# Check VPCs
echo -e "\n${BLUE}== Checking VPCs ==${NC}"
CUSTOM_VPCS=$(aws ec2 describe-vpcs --region $REGION --query "Vpcs[?!IsDefault].VpcId" --output text)
if [ -z "$CUSTOM_VPCS" ]; then
    echo -e "✅ No custom VPCs found"
else
    echo -e "⚠️  Custom VPCs still exist:"
    echo "$CUSTOM_VPCS" | tr '\t' '\n' | sed 's/^/   └── /'
fi

# Check ECR repositories
echo -e "\n${BLUE}== Checking ECR Repositories ==${NC}"
ECR_REPOS=$(aws ecr describe-repositories --region $REGION --query "repositories[].repositoryName" --output text 2>/dev/null || echo "")
if [ -z "$ECR_REPOS" ]; then
    echo -e "✅ No ECR repositories found"
else
    echo -e "⚠️  ECR repositories still exist:"
    echo "$ECR_REPOS" | tr '\t' '\n' | sed 's/^/   └── /'
fi

# Check Route53 zones
echo -e "\n${BLUE}== Checking Route53 Zones ==${NC}"
HOSTED_ZONES=$(aws route53 list-hosted-zones --query "HostedZones[?Name=='${DOMAIN}.'].Id" --output text)
if [ -z "$HOSTED_ZONES" ]; then
    echo -e "✅ No Route53 zones found for $DOMAIN"
else
    echo -e "⚠️  Route53 zones still exist:"
    echo "$HOSTED_ZONES" | tr '\t' '\n' | sed 's|/hostedzone/||' | sed 's/^/   └── /'
fi

# Check ALBs
echo -e "\n${BLUE}== Checking Application Load Balancers ==${NC}"
ALB_NAMES=$(aws elbv2 describe-load-balancers --region $REGION --query "LoadBalancers[].LoadBalancerName" --output text 2>/dev/null || echo "")
if [ -z "$ALB_NAMES" ]; then
    echo -e "✅ No Application Load Balancers found"
else
    echo -e "⚠️  ALBs still exist:"
    echo "$ALB_NAMES" | tr '\t' '\n' | sed 's/^/   └── /'
fi

# Check ECS clusters
echo -e "\n${BLUE}== Checking ECS Clusters ==${NC}"
ECS_CLUSTERS=$(aws ecs list-clusters --region $REGION --query "clusterArns[?contains(@, 'cloud-apps')]" --output text 2>/dev/null || echo "")
if [ -z "$ECS_CLUSTERS" ]; then
    echo -e "✅ No cloud-apps ECS clusters found"
else
    echo -e "⚠️  ECS clusters still exist:"
    echo "$ECS_CLUSTERS" | tr '\t' '\n' | sed 's|.*/||' | sed 's/^/   └── /'
fi

# Check SSL certificates
echo -e "\n${BLUE}== Checking SSL Certificates ==${NC}"

# Check us-east-1 (required for CloudFront/ALB)
CERTS_US_EAST=$(aws acm list-certificates --region us-east-1 --query "CertificateSummaryList[?DomainName=='${DOMAIN}' || DomainName=='*.${DOMAIN}' || contains(SubjectAlternativeNameSummaries, '${DOMAIN}')].DomainName" --output text 2>/dev/null || echo "")
if [ -z "$CERTS_US_EAST" ]; then
    echo -e "✅ No SSL certificates found for $DOMAIN in us-east-1"
else
    echo -e "⚠️  SSL certificates still exist in us-east-1:"
    echo "$CERTS_US_EAST" | tr '\t' '\n' | sed 's/^/   └── /'
fi

# Check default region
CERTS_REGION=$(aws acm list-certificates --region $REGION --query "CertificateSummaryList[?DomainName=='${DOMAIN}' || DomainName=='*.${DOMAIN}' || contains(SubjectAlternativeNameSummaries, '${DOMAIN}')].DomainName" --output text 2>/dev/null || echo "")
if [ -z "$CERTS_REGION" ]; then
    echo -e "✅ No SSL certificates found for $DOMAIN in $REGION"
else
    echo -e "⚠️  SSL certificates still exist in $REGION:"
    echo "$CERTS_REGION" | tr '\t' '\n' | sed 's/^/   └── /'
fi

# Check local Terraform files
echo -e "\n${BLUE}== Checking Local Terraform Files ==${NC}"
TERRAFORM_DIRS_FOUND=false

if [ -d "shared-infra/terraform/.terraform" ]; then
    echo -e "⚠️  shared-infra/.terraform directory exists"
    TERRAFORM_DIRS_FOUND=true
fi

if [ -d "mern-app/terraform/.terraform" ]; then
    echo -e "⚠️  mern-app/.terraform directory exists"
    TERRAFORM_DIRS_FOUND=true
fi

if [ -d "python-app/terraform/.terraform" ]; then
    echo -e "⚠️  python-app/.terraform directory exists"
    TERRAFORM_DIRS_FOUND=true
fi

if [ "$TERRAFORM_DIRS_FOUND" = false ]; then
    echo -e "✅ No local .terraform directories found"
fi

# Summary
echo -e "\n${BLUE}== SUMMARY ==${NC}"
echo -e "${GREEN}Cleanup verification complete!${NC}"

if [ -z "$CUSTOM_VPCS" ] && [ -z "$ECR_REPOS" ] && [ -z "$HOSTED_ZONES" ] && [ -z "$ALB_NAMES" ] && [ -z "$ECS_CLUSTERS" ] && [ -z "$CERTS_US_EAST" ] && [ -z "$CERTS_REGION" ] && [ "$TERRAFORM_DIRS_FOUND" = false ]; then
    echo -e "${GREEN}🎉 Environment is completely clean and ready for fresh deployment!${NC}"
    echo -e "\n${YELLOW}Next steps:${NC}"
    echo -e "${YELLOW}1. Commit and push your code to trigger GitHub Actions${NC}"
    echo -e "${YELLOW}2. Monitor deployment at: https://github.com/mrchughes/cloud-apps-monorepo/actions${NC}"
else
    echo -e "${YELLOW}⚠️  Some resources still exist - review the warnings above${NC}"
    echo -e "${YELLOW}If needed, run the cleanup script again: ./scripts/complete-infrastructure-cleanup.sh${NC}"
fi
