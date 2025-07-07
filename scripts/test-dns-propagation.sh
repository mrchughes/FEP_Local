#!/bin/bash

echo "=== DNS PROPAGATION TEST ==="
echo "Date: $(date)"
echo ""

echo "1. Checking nameservers:"
dig NS mrchughes.site +short
echo ""

echo "2. Expected nameservers (Terraform-managed):"
echo "ns-1015.awsdns-62.net"
echo "ns-1246.awsdns-27.org" 
echo "ns-1798.awsdns-32.co.uk"
echo "ns-90.awsdns-11.com"
echo ""

echo "3. Checking app1 DNS resolution:"
dig app1.mrchughes.site +short
echo ""

echo "4. Expected ALB (after propagation):"
echo "Should resolve to IP of: cloud-apps-alb-1630868822.eu-west-2.elb.amazonaws.com"
echo ""

echo "5. Testing HTTPS access:"
curl -I https://app1.mrchughes.site || echo "Connection failed - check if propagation is complete"
echo ""

echo "6. Terraform verification:"
echo "After DNS propagates, run: cd shared-infra/terraform && terraform plan"
echo "Should show: No changes. Infrastructure is up-to-date."
