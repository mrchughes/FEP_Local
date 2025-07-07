#!/bin/bash

echo "=== DNS MONITORING AND HEALTH CHECK ==="
echo "Date: $(date)"
echo ""

# Configuration
DOMAIN="mrchughes.site"
SUBDOMAIN="app1.mrchughes.site"
EXPECTED_ALB="cloud-apps-alb-1630868822.eu-west-2.elb.amazonaws.com"
TERRAFORM_NS_SET="Z092568170SANHCM65S"

SUCCESS=true
WARNINGS=()

# Function to log warnings
log_warning() {
    WARNINGS+=("⚠️  $1")
}

echo "1. ROUTE53 HOSTED ZONE STATUS"
echo "==============================="

# Get current hosted zones
ZONES=$(aws route53 list-hosted-zones --query 'HostedZones[?Name==`mrchughes.site.`].[Id,Name,Config.Comment]' --output table)
ZONE_COUNT=$(aws route53 list-hosted-zones --query 'HostedZones[?Name==`mrchughes.site.`]' --output json | jq length)

echo "Total hosted zones for $DOMAIN: $ZONE_COUNT"
if [ "$ZONE_COUNT" -gt 1 ]; then
    log_warning "Multiple hosted zones detected - cleanup needed"
    echo "$ZONES"
else
    echo "✅ Single hosted zone (expected)"
fi
echo ""

echo "2. NAMESERVER DELEGATION CHECK"
echo "==============================="

# Check nameserver delegation
echo "Checking nameserver delegation from domain registrar..."
DELEGATED_NS=$(dig NS $DOMAIN +short | sort)
TERRAFORM_NS=$(aws route53 get-hosted-zone --id "/hostedzone/$TERRAFORM_NS_SET" --query 'DelegationSet.NameServers' --output json | jq -r '.[]' | sort)

echo "Delegated nameservers:"
echo "$DELEGATED_NS"
echo ""
echo "Terraform-managed nameservers:"
echo "$TERRAFORM_NS"
echo ""

if [ "$DELEGATED_NS" = "$TERRAFORM_NS" ]; then
    echo "✅ Nameserver delegation is correct"
else
    log_warning "Nameserver mismatch detected"
    echo "Domain registrar needs to be updated with Terraform nameservers"
    SUCCESS=false
fi
echo ""

echo "3. DNS RESOLUTION CHECK"
echo "======================="

# Check A record resolution
echo "Resolving $SUBDOMAIN..."
RESOLVED_IP=$(dig $SUBDOMAIN +short | head -1)
EXPECTED_IP=$(dig $EXPECTED_ALB +short | head -1)

echo "Resolved IP: $RESOLVED_IP"
echo "Expected IP (from ALB): $EXPECTED_IP"

if [ "$RESOLVED_IP" = "$EXPECTED_IP" ]; then
    echo "✅ DNS resolution correct"
else
    log_warning "DNS resolution mismatch"
    echo "Check Route53 A record configuration"
    SUCCESS=false
fi
echo ""

echo "4. HTTP/HTTPS CONNECTIVITY"
echo "=========================="

# Test HTTP connectivity
echo "Testing HTTP connectivity..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "http://$SUBDOMAIN" || echo "000")
echo "HTTP status: $HTTP_STATUS"

if [ "$HTTP_STATUS" = "301" ] || [ "$HTTP_STATUS" = "302" ]; then
    echo "✅ HTTP redirect working (expected for HTTPS-only sites)"
elif [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ HTTP connectivity OK"
else
    log_warning "HTTP connectivity issue - status $HTTP_STATUS"
fi

# Test HTTPS connectivity
echo "Testing HTTPS connectivity..."
HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "https://$SUBDOMAIN" || echo "000")
echo "HTTPS status: $HTTPS_STATUS"

if [ "$HTTPS_STATUS" = "200" ]; then
    echo "✅ HTTPS connectivity OK"
else
    log_warning "HTTPS connectivity issue - status $HTTPS_STATUS"
    SUCCESS=false
fi
echo ""

echo "5. SSL CERTIFICATE CHECK"
echo "========================"

# Check SSL certificate
echo "Checking SSL certificate..."
SSL_INFO=$(echo | openssl s_client -servername $SUBDOMAIN -connect $SUBDOMAIN:443 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)

if [ $? -eq 0 ]; then
    echo "✅ SSL certificate valid"
    echo "$SSL_INFO"
else
    log_warning "SSL certificate issue"
fi
echo ""

echo "6. ALB HEALTH CHECK"
echo "=================="

# Check ALB target health
ALB_ARN=$(aws elbv2 describe-load-balancers --names cloud-apps-alb --query 'LoadBalancers[0].LoadBalancerArn' --output text 2>/dev/null)

if [ "$ALB_ARN" != "None" ] && [ "$ALB_ARN" != "" ]; then
    echo "ALB ARN: $ALB_ARN"
    
    # Get target groups
    TARGET_GROUPS=$(aws elbv2 describe-target-groups --load-balancer-arn "$ALB_ARN" --query 'TargetGroups[*].TargetGroupArn' --output text)
    
    for TG_ARN in $TARGET_GROUPS; do
        echo "Checking target group: $(aws elbv2 describe-target-groups --target-group-arns "$TG_ARN" --query 'TargetGroups[0].TargetGroupName' --output text)"
        HEALTH=$(aws elbv2 describe-target-health --target-group-arn "$TG_ARN" --query 'TargetHealthDescriptions[*].[Target.Id,TargetHealth.State]' --output table)
        echo "$HEALTH"
    done
    echo ""
else
    log_warning "Could not find ALB or access denied"
fi

echo "7. TERRAFORM STATE CONSISTENCY"
echo "=============================="

# Quick check of Terraform outputs
if [ -f "../terraform-outputs.json" ]; then
    echo "Recent Terraform outputs available:"
    HOSTED_ZONE_ID=$(jq -r '.hosted_zone_id.value // empty' ../terraform-outputs.json)
    ALB_DNS=$(jq -r '.alb_dns_name.value // empty' ../terraform-outputs.json)
    
    echo "Terraform Hosted Zone ID: $HOSTED_ZONE_ID"
    echo "Terraform ALB DNS: $ALB_DNS"
    
    if [ "$HOSTED_ZONE_ID" = "$TERRAFORM_NS_SET" ]; then
        echo "✅ Terraform state matches expected hosted zone"
    else
        log_warning "Terraform state hosted zone mismatch"
    fi
else
    echo "No recent Terraform outputs found"
fi

echo ""
echo "8. SUMMARY"
echo "=========="

if [ "$SUCCESS" = true ] && [ ${#WARNINGS[@]} -eq 0 ]; then
    echo "✅ ALL CHECKS PASSED - DNS and infrastructure healthy"
elif [ "$SUCCESS" = true ] && [ ${#WARNINGS[@]} -gt 0 ]; then
    echo "⚠️  WARNINGS DETECTED - Review needed:"
    for warning in "${WARNINGS[@]}"; do
        echo "  $warning"
    done
elif [ "$SUCCESS" = false ]; then
    echo "❌ CRITICAL ISSUES DETECTED - Immediate attention required"
    for warning in "${WARNINGS[@]}"; do
        echo "  $warning"
    done
    exit 1
fi

echo ""
echo "Next scheduled check: $(date -d '+1 hour' 2>/dev/null || date -v+1H 2>/dev/null || echo 'Run again in 1 hour')"
