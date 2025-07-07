#!/bin/bash

# SSL Certificate and DNS Verification Script
# This script checks the status of your domain, DNS, and SSL certificates

set -e

# Configuration - Update these values
DOMAIN="${DOMAIN:-your-domain.com}"  # Replace with your actual domain
REGION="${REGION:-eu-west-2}"
TERRAFORM_DIR="../shared-infra/terraform"

echo "🔒 SSL Certificate & DNS Health Check"
echo "======================================"
echo "Domain: $DOMAIN"
echo "Region: $REGION"
echo ""

# Check if domain is provided
if [[ "$DOMAIN" == "your-domain.com" ]]; then
    echo "❌ Please set your actual domain name:"
    echo "   DOMAIN=yourdomain.com ./ssl-health-check.sh"
    exit 1
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check required tools
echo "📋 Checking required tools..."
for tool in aws dig curl terraform; do
    if command_exists "$tool"; then
        echo "✅ $tool is available"
    else
        echo "❌ $tool is required but not installed"
        exit 1
    fi
done
echo ""

# 1. Get Route53 name servers from Terraform
echo "🌐 1. Route53 Name Servers (from Terraform):"
if [[ -d "$TERRAFORM_DIR" ]]; then
    cd "$TERRAFORM_DIR"
    if terraform output name_servers >/dev/null 2>&1; then
        terraform output name_servers
    else
        echo "⚠️  Could not get name servers from Terraform output"
        echo "   Run 'terraform output name_servers' in shared-infra/terraform/"
    fi
    cd - >/dev/null
else
    echo "⚠️  Terraform directory not found: $TERRAFORM_DIR"
fi
echo ""

# 2. Check current DNS resolution
echo "🔍 2. Current DNS Resolution:"
if dig "$DOMAIN" NS +short >/dev/null 2>&1; then
    echo "Current name servers for $DOMAIN:"
    dig "$DOMAIN" NS +short
    echo ""
    
    # Check if using AWS name servers
    NS_COUNT=$(dig "$DOMAIN" NS +short | grep -c "awsdns" || true)
    if [[ $NS_COUNT -gt 0 ]]; then
        echo "✅ Domain is using AWS Route53 name servers"
    else
        echo "⚠️  Domain is NOT using AWS Route53 name servers"
        echo "   Update your Namecheap DNS settings to use Route53 name servers"
    fi
else
    echo "❌ Could not resolve DNS for $DOMAIN"
fi
echo ""

# 3. Check ACM certificates
echo "📜 3. ACM Certificate Status:"
if aws acm list-certificates --region "$REGION" >/dev/null 2>&1; then
    CERT_INFO=$(aws acm list-certificates --region "$REGION" --query "CertificateSummaryList[?contains(DomainName, '$DOMAIN') || contains(SubjectAlternativeNameSummary[0], '$DOMAIN')]" --output table)
    
    if [[ -n "$CERT_INFO" && "$CERT_INFO" != *"None"* ]]; then
        echo "$CERT_INFO"
        
        # Get specific certificate details
        CERT_ARN=$(aws acm list-certificates --region "$REGION" --query "CertificateSummaryList[?contains(DomainName, '$DOMAIN') || contains(SubjectAlternativeNameSummary[0], '$DOMAIN')].CertificateArn" --output text | head -1)
        
        if [[ -n "$CERT_ARN" && "$CERT_ARN" != "None" ]]; then
            echo ""
            echo "Certificate Details:"
            aws acm describe-certificate --certificate-arn "$CERT_ARN" --region "$REGION" --query '{Status: Status, DomainName: DomainName, SubjectAlternativeNames: SubjectAlternativeNames, Type: Type, KeyAlgorithm: KeyAlgorithm}' --output table
        fi
    else
        echo "❌ No ACM certificates found for domain: $DOMAIN"
        echo "   Check if certificate was created in region: $REGION"
    fi
else
    echo "❌ Could not access ACM (check AWS credentials and region)"
fi
echo ""

# 4. Test HTTPS connectivity
echo "🔗 4. HTTPS Connectivity Test:"
if curl -I "https://$DOMAIN" --connect-timeout 10 --max-time 30 >/dev/null 2>&1; then
    echo "✅ HTTPS connection successful"
    echo "Response headers:"
    curl -I "https://$DOMAIN" --connect-timeout 10 --max-time 30 2>/dev/null | head -5
else
    echo "❌ HTTPS connection failed"
    echo "   This could mean:"
    echo "   - Certificate not yet issued"
    echo "   - DNS not properly configured"
    echo "   - ALB not configured correctly"
    echo "   - Certificate not attached to ALB"
fi
echo ""

# 5. Certificate validation records check
echo "🏷️  5. Certificate Validation Records:"
if aws route53 list-hosted-zones --query "HostedZones[?Name=='$DOMAIN.'].Id" --output text | head -1 >/dev/null 2>&1; then
    ZONE_ID=$(aws route53 list-hosted-zones --query "HostedZones[?Name=='$DOMAIN.'].Id" --output text | head -1 | sed 's|/hostedzone/||')
    
    if [[ -n "$ZONE_ID" ]]; then
        echo "Checking validation records in hosted zone: $ZONE_ID"
        VALIDATION_RECORDS=$(aws route53 list-resource-record-sets --hosted-zone-id "$ZONE_ID" --query "ResourceRecordSets[?Type=='CNAME' && contains(Name, '_acme-challenge')]" --output table)
        
        if [[ -n "$VALIDATION_RECORDS" && "$VALIDATION_RECORDS" != *"None"* ]]; then
            echo "✅ Certificate validation records found"
            echo "$VALIDATION_RECORDS"
        else
            echo "⚠️  No certificate validation records found"
            echo "   This is normal if certificate is already validated"
        fi
    fi
else
    echo "❌ Could not find Route53 hosted zone for $DOMAIN"
fi
echo ""

# Summary
echo "📊 Summary & Recommendations:"
echo "============================="

# Check overall health
ISSUES=0

if ! dig "$DOMAIN" NS +short | grep -q "awsdns"; then
    echo "❌ DNS: Update Namecheap to use Route53 name servers"
    ((ISSUES++))
fi

if ! curl -I "https://$DOMAIN" --connect-timeout 10 >/dev/null 2>&1; then
    echo "❌ HTTPS: SSL certificate or ALB configuration issue"
    ((ISSUES++))
fi

CERT_COUNT=$(aws acm list-certificates --region "$REGION" --query "CertificateSummaryList[?contains(DomainName, '$DOMAIN') || contains(SubjectAlternativeNameSummary[0], '$DOMAIN')]" --output text | wc -l)
if [[ $CERT_COUNT -eq 0 ]]; then
    echo "❌ Certificate: No ACM certificate found for $DOMAIN"
    ((ISSUES++))
fi

if [[ $ISSUES -eq 0 ]]; then
    echo "✅ All checks passed! Your SSL certificate setup is working correctly."
    echo ""
    echo "🎉 Your Namecheap domain + AWS ACM certificate setup is optimal!"
else
    echo ""
    echo "⚠️  Found $ISSUES issue(s). See SSL_CERTIFICATE_MANAGEMENT.md for solutions."
fi

echo ""
echo "For detailed troubleshooting, see: docs/SSL_CERTIFICATE_MANAGEMENT.md"
