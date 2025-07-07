# 🌐 DNS Configuration Guide: Namecheap → Route53

## Overview
You're correct! After deploying the infrastructure, you'll need to get the Route53 name servers and configure them in Namecheap.

## 📋 Step-by-Step DNS Setup

### Step 1: Deploy Infrastructure First
```bash
cd shared-infra/terraform
terraform init
terraform apply
```

### Step 2: Get Route53 Name Servers
After `terraform apply` completes successfully:
```bash
terraform output name_servers
```

**Example output you'll see:**
```
name_servers = [
  "ns-1234.awsdns-56.org",
  "ns-789.awsdns-01.net", 
  "ns-2345.awsdns-67.com",
  "ns-890.awsdns-12.co.uk"
]
```

### Step 3: Configure Namecheap DNS

1. **Login to Namecheap**
   - Go to [namecheap.com](https://namecheap.com)
   - Login to your account
   - Navigate to "Domain List"

2. **Select Your Domain**
   - Click "Manage" next to your domain
   - Go to "Advanced DNS" tab

3. **Change Name Servers**
   - Look for "Name Servers" section
   - Select "Custom DNS" 
   - Enter the 4 Route53 name servers from Step 2:
     ```
     ns-1234.awsdns-56.org
     ns-789.awsdns-01.net
     ns-2345.awsdns-67.com
     ns-890.awsdns-12.co.uk
     ```

4. **Save Changes**
   - Click "Save Changes"
   - You'll see a confirmation message

### Step 4: Wait for DNS Propagation
- **Time Required**: 24-48 hours (usually faster)
- **What Happens**: DNS changes propagate worldwide

### Step 5: Verify DNS Configuration
```bash
# Check if your domain points to Route53
dig your-domain.com NS

# Should show the Route53 name servers
# If still showing old name servers, wait longer
```

## 🔍 Visual Guide - Namecheap Interface

```
┌─────────────────────────────────────────────────┐
│               Namecheap Dashboard               │
├─────────────────────────────────────────────────┤
│ Domain List                                     │
│ ┌─────────────────────┐                        │
│ │ your-domain.com     │ [Manage] ◄── Click here│
│ └─────────────────────┘                        │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│              Domain Management                  │
├─────────────────────────────────────────────────┤
│ [Basic DNS] [Advanced DNS] ◄── Click here      │
│                                                 │
│ Name Servers:                                   │
│ ○ Namecheap BasicDNS                           │
│ ● Custom DNS ◄── Select this                   │
│                                                 │
│ Name Server 1: [ns-1234.awsdns-56.org    ]    │
│ Name Server 2: [ns-789.awsdns-01.net     ]    │
│ Name Server 3: [ns-2345.awsdns-67.com    ]    │ 
│ Name Server 4: [ns-890.awsdns-12.co.uk   ]    │
│                                                 │
│               [Save Changes]                    │
└─────────────────────────────────────────────────┘
```

## ⚡ Quick Commands for DNS Setup

### Get Name Servers (after terraform apply)
```bash
cd shared-infra/terraform
terraform output -raw name_servers
```

### Test DNS Propagation
```bash
# Check current name servers
dig your-domain.com NS +short

# Check from different DNS servers
dig @8.8.8.8 your-domain.com NS +short
dig @1.1.1.1 your-domain.com NS +short
```

### Monitor Certificate Validation
```bash
# Check certificate status
aws acm list-certificates --region eu-west-2 --query 'CertificateSummaryList[?DomainName==`your-domain.com`]'

# Check certificate details
aws acm describe-certificate --certificate-arn <cert-arn> --region eu-west-2
```

## 🕐 Timeline Expectations

| Time | What Happens |
|------|--------------|
| 0 minutes | Change name servers in Namecheap |
| 5-15 minutes | Some DNS servers see the change |
| 1-6 hours | Most DNS servers updated |
| 24-48 hours | Complete worldwide propagation |
| +5-30 minutes | SSL certificate validates automatically |

## ✅ Verification Checklist

- [ ] Terraform apply completed successfully
- [ ] Got 4 Route53 name servers from `terraform output`
- [ ] Updated Namecheap to use Custom DNS
- [ ] Entered all 4 Route53 name servers
- [ ] Saved changes in Namecheap
- [ ] Waited for DNS propagation (24-48 hours)
- [ ] Verified with `dig your-domain.com NS`
- [ ] SSL certificate shows "Issued" status
- [ ] Website accessible via HTTPS

## 🚨 Common Issues & Solutions

### Issue: "Certificate still pending validation"
**Cause**: DNS not yet propagated to AWS
**Solution**: Wait longer, check `dig your-domain.com NS`

### Issue: "Name servers not updating"
**Cause**: Browser cache or local DNS cache
**Solution**: 
```bash
# Clear DNS cache (macOS)
sudo dscacheutil -flushcache

# Check with external tools
nslookup your-domain.com 8.8.8.8
```

### Issue: "Wrong name servers in Namecheap"
**Cause**: Typo or wrong order
**Solution**: Double-check against `terraform output name_servers`

## 🎯 Pro Tips

1. **Copy-Paste**: Always copy name servers directly from terraform output
2. **Order Matters**: Enter them in the same order as terraform shows
3. **Patience**: DNS changes take time - don't panic if not immediate
4. **Backup**: Screenshot your old Namecheap settings before changing
5. **Test**: Use multiple DNS checking tools to verify propagation

## 📞 Support Resources

- **AWS Route53 Docs**: [Route53 Documentation](https://docs.aws.amazon.com/route53/)
- **Namecheap Support**: [DNS Management Guide](https://www.namecheap.com/support/knowledgebase/article.aspx/767/10/how-to-change-dns-for-a-domain/)
- **DNS Propagation Checker**: [whatsmydns.net](https://www.whatsmydns.net/)

---

## 🎉 Summary

**Yes, you're absolutely right!** The process is:

1. 🚀 **Deploy**: `terraform apply` (creates Route53 hosted zone)
2. 📋 **Get**: `terraform output name_servers` (shows 4 name servers)  
3. 🔧 **Configure**: Update Namecheap to use those 4 name servers
4. ⏰ **Wait**: 24-48 hours for DNS propagation
5. ✅ **Verify**: SSL certificate validates automatically

This is exactly how professional deployments work - domain registration separate from DNS management!
