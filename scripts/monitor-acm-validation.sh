#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGION="eu-west-2"
DOMAIN="mrchughes.site"
CHECK_INTERVAL=30 # seconds

echo -e "${BLUE}🔍 ACM Certificate Validation Monitor${NC}"
echo "======================================"
echo "Domain: $DOMAIN"
echo "Region: $REGION"
echo "Check interval: ${CHECK_INTERVAL}s"
echo ""

# Function to check certificate status
check_certificate_status() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')] Checking certificate status...${NC}"
    
    # Get certificate ARN
    CERT_ARN=$(aws acm list-certificates --region $REGION --query "CertificateSummaryList[?DomainName=='$DOMAIN'].CertificateArn" --output text)
    
    if [ -z "$CERT_ARN" ]; then
        echo -e "${RED}❌ No certificate found for domain $DOMAIN${NC}"
        return 1
    fi
    
    echo "Certificate ARN: $CERT_ARN"
    
    # Get detailed certificate status
    aws acm describe-certificate --certificate-arn $CERT_ARN --region $REGION --query 'Certificate.DomainValidationOptions[].[DomainName,ValidationStatus]' --output table
    
    # Check overall status
    OVERALL_STATUS=$(aws acm list-certificates --region $REGION --query "CertificateSummaryList[?CertificateArn=='$CERT_ARN'].Status" --output text)
    echo -e "\nOverall Status: ${YELLOW}$OVERALL_STATUS${NC}"
    
    if [ "$OVERALL_STATUS" = "ISSUED" ]; then
        echo -e "${GREEN}🎉 Certificate validation complete!${NC}"
        return 0
    fi
    
    return 1
}

# Function to check deployment status
check_deployment_status() {
    echo -e "\n${BLUE}Checking deployment resources...${NC}"
    
    # Check ALB listeners
    ALB_ARN=$(aws elbv2 describe-load-balancers --region $REGION --query 'LoadBalancers[0].LoadBalancerArn' --output text 2>/dev/null)
    if [ "$ALB_ARN" != "None" ] && [ -n "$ALB_ARN" ]; then
        LISTENER_COUNT=$(aws elbv2 describe-listeners --load-balancer-arn $ALB_ARN --region $REGION --query 'length(Listeners)' --output text 2>/dev/null || echo "0")
        echo "ALB Listeners configured: $LISTENER_COUNT"
    else
        echo "ALB: Not found"
    fi
    
    # Check ECS clusters
    CLUSTER_COUNT=$(aws ecs list-clusters --region $REGION --query 'length(clusterArns)' --output text 2>/dev/null || echo "0")
    echo "ECS Clusters: $CLUSTER_COUNT"
    
    # Check ECS services
    if [ "$CLUSTER_COUNT" != "0" ]; then
        CLUSTERS=$(aws ecs list-clusters --region $REGION --query 'clusterArns' --output text)
        for cluster in $CLUSTERS; do
            CLUSTER_NAME=$(basename $cluster)
            SERVICE_COUNT=$(aws ecs list-services --cluster $cluster --region $REGION --query 'length(serviceArns)' --output text 2>/dev/null || echo "0")
            echo "  Cluster $CLUSTER_NAME services: $SERVICE_COUNT"
        done
    fi
}

# Main monitoring loop
echo -e "${YELLOW}Starting monitoring... Press Ctrl+C to stop${NC}"
echo ""

while true; do
    if check_certificate_status; then
        echo -e "\n${GREEN}✅ Certificate validation successful!${NC}"
        check_deployment_status
        echo -e "\n${GREEN}🚀 You can now proceed with testing the application${NC}"
        break
    fi
    
    echo -e "${YELLOW}⏳ Waiting ${CHECK_INTERVAL} seconds before next check...${NC}"
    echo "───────────────────────────────────────────────"
    sleep $CHECK_INTERVAL
done

echo -e "\n${BLUE}Monitor completed${NC}"
