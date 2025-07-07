# 🔒 SSL Certificate Setup Checklist

## Quick Verification for Namecheap Domain + AWS ACM

### ✅ Step 1: Verify Your Setup is Correct
Your configuration is **PERFECTLY VALID**:
- ✅ Domain registered with Namecheap
- ✅ DNS managed by AWS Route53  
- ✅ SSL certificates from AWS Certificate Manager
- ✅ DNS validation method

This is the **recommended enterprise approach**!

### ✅ Step 2: Key Requirements

1. **Namecheap DNS Settings**
   - In Namecheap, change "Custom DNS" to point to your Route53 name servers
   - You'll get these from: `terraform output name_servers`
   - Format: `ns-xxx.awsdns-xx.com`, `ns-xxx.awsdns-xx.co.uk`, etc.

2. **DNS Propagation**
   - Wait 24-48 hours after changing name servers
   - Verify with: `dig yourdomain.com NS`

3. **Certificate Validation**
   - AWS automatically creates DNS validation records
   - Certificate shows "Issued" status in ACM console

### ✅ Step 3: Common Gotchas & Solutions

| Issue | Symptom | Solution |
|-------|---------|----------|
| Certificate pending | "Pending validation" status | Check Namecheap points to Route53 NS |
| DNS not resolving | Domain doesn't resolve | Wait for propagation (24-48h) |
| HTTPS not working | SSL errors | Ensure ALB uses the certificate |
| Multiple certificates | Terraform errors | Import existing or recreate |

### ✅ Step 4: Quick Health Check Commands

```bash
# 1. Check current DNS
dig yourdomain.com NS

# 2. Verify Route53 name servers
cd shared-infra/terraform
terraform output name_servers

# 3. Check certificate status
aws acm list-certificates --region eu-west-2

# 4. Test HTTPS
curl -I https://yourdomain.com
```

### ✅ Step 5: What's Normal vs Concerning

**✅ NORMAL:**
- Certificate takes 5-30 minutes to validate after DNS is correct
- Temporary "Pending validation" during DNS propagation
- Multiple SAN (Subject Alternative Name) entries for subdomains

**❌ CONCERNING:**
- Certificate stuck "Pending validation" for >48 hours
- DNS resolution fails completely
- Getting certificate errors from different CA

### ✅ Step 6: Pro Tips

1. **Use DNS validation** (not email) - more reliable
2. **Include all subdomains** in certificate SAN
3. **Monitor certificate expiration** - ACM auto-renews
4. **Use consistent regions** - certificates are region-specific
5. **Document your name servers** - you'll need them again

## 🎯 Bottom Line

Your approach is **100% correct** and used by most professional AWS deployments. The key is just ensuring:

1. Namecheap → Route53 name server configuration
2. Allowing time for DNS propagation  
3. Verifying certificate validation completes

**No issues expected** - this is the gold standard setup! 🏆
