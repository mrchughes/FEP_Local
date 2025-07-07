# SSL Certificate Management Guide

## Overview
This guide covers managing SSL certificates when your domain is registered with Namecheap but using AWS Certificate Manager (ACM) for SSL certificates.

## Current Configuration

### Domain Setup
- **Domain Registrar**: Namecheap
- **DNS Management**: AWS Route53
- **SSL Certificates**: AWS Certificate Manager (ACM)
- **Validation Method**: DNS validation

## ✅ Why This Setup Works Perfectly

This is actually the **recommended approach** because:

1. **Separation of Concerns**: Domain registration and DNS management are separate services
2. **AWS Integration**: ACM integrates seamlessly with AWS services (ALB, CloudFront, etc.)
3. **Automatic Renewal**: ACM certificates auto-renew
4. **No Cost**: ACM certificates are free for AWS resources
5. **DNS Validation**: More reliable than email validation

## 🔧 Required Configuration Steps

### 1. Namecheap DNS Configuration

In your Namecheap domain settings, you MUST point to AWS Route53 name servers:

```
Name Server 1: ns-xxx.awsdns-xx.com
Name Server 2: ns-xxx.awsdns-xx.co.uk  
Name Server 3: ns-xxx.awsdns-xx.net
Name Server 4: ns-xxx.awsdns-xx.org
```

**Get these values from your Terraform output:**
```bash
cd shared-infra/terraform
terraform output name_servers
```

### 2. Certificate Validation Process

AWS ACM will:
1. Generate DNS validation records
2. Terraform automatically creates these records in Route53
3. ACM validates ownership via DNS
4. Certificate becomes valid

### 3. Verification Commands

```bash
# Check Route53 name servers
terraform output name_servers

# Verify certificate status
aws acm list-certificates --region eu-west-2

# Check specific certificate
aws acm describe-certificate --certificate-arn <cert-arn> --region eu-west-2

# Test DNS resolution
nslookup your-domain.com
dig your-domain.com NS
```

## 🚨 Common Issues & Solutions

### Issue 1: Certificate Stuck in "Pending Validation"

**Cause**: Namecheap DNS not pointing to Route53
**Solution**: 
1. Check Namecheap nameservers match Route53 output
2. Wait 24-48 hours for DNS propagation
3. Verify with: `dig your-domain.com NS`

### Issue 2: Certificate Validation Fails

**Cause**: DNS records not created properly
**Solution**:
```bash
# Check validation records exist
aws route53 list-resource-record-sets --hosted-zone-id <zone-id>
```

### Issue 3: Multiple Certificates for Same Domain

**Cause**: Terraform creating duplicate certificates
**Solution**: Import existing certificate or destroy/recreate

## 🔒 Security Best Practices

### 1. Certificate Scope
- Include all required subdomains in SAN (Subject Alternative Names)
- Use wildcard certificates if you have many subdomains

### 2. Monitoring
- Set up CloudWatch alarms for certificate expiration
- Monitor certificate validation status

### 3. Access Control
- Limit who can modify Route53 records
- Use IAM policies for certificate management

## 📋 Checklist for New Domains

- [ ] Domain registered with Namecheap
- [ ] Route53 hosted zone created
- [ ] Name servers updated in Namecheap
- [ ] DNS propagation verified (24-48 hours)
- [ ] ACM certificate requested with DNS validation
- [ ] Validation records automatically created by Terraform
- [ ] Certificate status shows "Issued"
- [ ] ALB configured to use certificate
- [ ] HTTPS redirect enabled (HTTP → HTTPS)

## 🔧 Terraform Configuration Review

Your current setup is correct:

```hcl
# Certificate with DNS validation
resource "aws_acm_certificate" "ssl_cert" {
  domain_name       = var.domain_name
  validation_method = "DNS"
  subject_alternative_names = [
    "${var.app1_subdomain}.${var.domain_name}",
    "${var.app2_subdomain}.${var.domain_name}"
  ]
  lifecycle {
    create_before_destroy = true
  }
}

# Automatic validation record creation
resource "aws_route53_record" "cert_validation_main" {
  zone_id = var.zone_id
  name    = tolist(aws_acm_certificate.ssl_cert.domain_validation_options)[0].resource_record_name
  type    = tolist(aws_acm_certificate.ssl_cert.domain_validation_options)[0].resource_record_type
  records = [tolist(aws_acm_certificate.ssl_cert.domain_validation_options)[0].resource_record_value]
  ttl     = 60
}
```

## ⚡ Quick Verification Script

```bash
#!/bin/bash
# SSL Certificate Health Check

DOMAIN="your-domain.com"
REGION="eu-west-2"

echo "=== SSL Certificate Health Check ==="
echo "Domain: $DOMAIN"
echo "Region: $REGION"
echo

# 1. Check DNS resolution
echo "1. DNS Resolution:"
nslookup $DOMAIN
echo

# 2. Check Route53 name servers
echo "2. Route53 Name Servers:"
dig $DOMAIN NS +short
echo

# 3. Check ACM certificate
echo "3. ACM Certificate Status:"
aws acm list-certificates --region $REGION --query 'CertificateSummaryList[?DomainName==`'$DOMAIN'`]'
echo

# 4. Test HTTPS connection
echo "4. HTTPS Connection Test:"
curl -I https://$DOMAIN
echo

echo "=== Health Check Complete ==="
```

## 🎯 Key Takeaway

**Your setup is CORRECT and RECOMMENDED!**

The combination of:
- Namecheap (domain registration) 
- Route53 (DNS management)
- ACM (SSL certificates)

Is a professional, scalable, and cost-effective approach used by many enterprises.

The only requirement is ensuring Namecheap points to the correct Route53 name servers.
