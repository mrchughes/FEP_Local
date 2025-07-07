# Route53 and ALB Sync Investigation

## Problem Summary
The Route53 DNS configuration and ALB got out of sync due to multiple duplicate hosted zones being created for `mrchughes.site`.

## Root Cause Analysis

### 1. Multiple Hosted Zones Created
Found **13 duplicate hosted zones** for `mrchughes.site`:
- Z08566691RX0JZKNYI8SX (2 records)
- Z08953451BC143JM2GA06 (7 records)
- Z092568170SANHCM65S (7 records) ← **Terraform-managed**
- Z06605961YMUHP42VSTIS (7 records)
- Z06745535EQNTFPODDK3 (5 records)
- Z01450871P9NE9M109ST3 (7 records)
- Z01562083KVMDM0LWKIQV (5 records)
- Z01628911Y2ZZ8D4VHIZI (5 records)
- Z01495213PRHFK9189YRQ (5 records)
- Z017235728QDHZXRA306F (5 records)
- Z0987498T45WYVEK4WFN (3 records)
- Z0508506ZUAC31F51K14 (7 records) ← **Active (domain registrar points here)**
- Z00318673H0WNK7J6TIO2 (7 records)

### 2. Domain Registrar vs Terraform Mismatch

**Domain Registrar Configuration:**
- Points to nameservers: ns-1049.awsdns-03.org, ns-130.awsdns-16.com, ns-1802.awsdns-33.co.uk, ns-668.awsdns-19.net
- These belong to hosted zone: `Z0508506ZUAC31F51K14`

**Terraform State:**
- Manages hosted zone: `Z092568170SANHCM65S`
- With nameservers: ns-1246.awsdns-27.org, ns-1015.awsdns-62.net, ns-90.awsdns-11.com, ns-1798.awsdns-32.co.uk

### 3. DNS Record Discrepancies

**Active Zone (Z0508506ZUAC31F51K14) - Where traffic actually goes:**
```
app1.mrchughes.site → shared-alb-662223684.us-east-1.elb.amazonaws.com (WRONG ALB)
app2.mrchughes.site → shared-alb-662223684.us-east-1.elb.amazonaws.com (WRONG ALB)
```

**Terraform-managed Zone (Z092568170SANHCM65S) - Where Terraform updates:**
```
app1.mrchughes.site → cloud-apps-alb-1630868822.eu-west-2.elb.amazonaws.com (CORRECT ALB)
app2.mrchughes.site → cloud-apps-alb-1630868822.eu-west-2.elb.amazonaws.com (CORRECT ALB)
```

### 4. How This Happened
1. **Multiple Terraform Deployments**: Each clean deployment or state issue created a new hosted zone
2. **Nameserver Updates Missed**: Domain registrar was never updated to point to the latest Terraform-managed zone
3. **Manual Fixes to Wrong Zone**: Manual DNS fixes were applied to the active zone instead of the Terraform-managed zone
4. **Terraform Updates Ignored**: Terraform continued updating the wrong (non-active) zone

## Impact
- DNS changes made via Terraform had no effect on actual traffic
- Manual DNS fixes were temporary and got lost during Terraform deployments
- Applications pointed to wrong ALBs, causing connection issues
- SSL certificates and domain validation became inconsistent

## Resolution Plan

### Phase 1: Immediate Fix
1. **Update Domain Registrar**: Point domain to Terraform-managed zone nameservers
2. **Verify DNS Propagation**: Ensure traffic flows to correct ALB
3. **Test Application Access**: Confirm apps work via DNS

### Phase 2: Cleanup Redundant Zones
1. **Identify Safe-to-Delete Zones**: All zones except the Terraform-managed one
2. **Backup Important Records**: Export any unique records before deletion
3. **Delete Duplicate Zones**: Remove 12 out of 13 hosted zones
4. **Cost Optimization**: Save $0.50/month per zone ($6/month total)

### Phase 3: Prevention
1. **Terraform State Management**: Ensure consistent state handling
2. **Deployment Documentation**: Document nameserver update process
3. **Monitoring**: Add alerts for DNS configuration drift
