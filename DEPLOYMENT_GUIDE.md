# Cloud Apps Bundle - Complete Deployment Guide

## Table of Contents
1. [Quick Start Checklist](#quick-start-checklist)
2. [Prerequisites](#prerequisites)
3. [Git-Based Deployment Workflow](#git-based-deployment-workflow)
4. [Shared Infrastructure Deployment](#shared-infrastructure-deployment)
5. [Application Infrastructure Deployment](#application-infrastructure-deployment)
6. [Application Code Deployment](#application-code-deployment)
7. [Deployment Failure Recovery](#deployment-failure-recovery)
8. [Environment Teardown](#environment-teardown)
9. [Troubleshooting](#troubleshooting)

---

## Quick Start Checklist

Before deploying anything, ensure you have:
- [ ] AWS CLI configured with appropriate credentials
- [ ] Terraform installed (v1.0+)
- [ ] Docker installed and running
- [ ] Node.js and npm installed
- [ ] Domain name configured (if using custom domains)
- [ ] Git repository set up with CI/CD pipeline

---

## Prerequisites

### 1. AWS Setup
```bash
# Configure AWS CLI
aws configure
# Verify access
aws sts get-caller-identity
```

### 2. Docker Setup
```bash
# Start Docker daemon
docker --version
docker ps
```

### 3. Terraform Setup
```bash
# Verify Terraform
terraform --version
```

---

## Git-Based Deployment Workflow

### Repository Structure
```
cloud-apps-bundle/
├── .github/workflows/          # CI/CD pipelines
├── shared-infra/              # Core AWS infrastructure
├── mern-app/                  # MERN stack application
├── python-app/                # Python application (future)
└── scripts/                   # Deployment scripts
```

### Deployment Branches
- **`main`**: Production deployments
- **`staging`**: Staging environment
- **`develop`**: Development environment

---

## Shared Infrastructure Deployment

### 🎯 What This Deploys
- VPC, Subnets, Internet Gateway
- Application Load Balancer (ALB)
- Route53 DNS records
- S3 buckets
- DynamoDB tables
- ECR repositories
- IAM roles and policies

### 🚀 Git Push Deployment

**Step 1: Make Infrastructure Changes**
```bash
# Navigate to shared infrastructure
cd shared-infra/terraform

# Edit Terraform files
vim main.tf variables.tf

# Test changes locally
terraform validate
terraform plan
```

**Step 2: Commit and Push**
```bash
git add .
git commit -m "feat: update shared infrastructure - add new S3 bucket"
git push origin main
```

**Step 3: Monitor Deployment**
- Check GitHub Actions workflow
- Monitor AWS CloudFormation/Terraform state
- Verify resources in AWS Console

### 📝 Manual Deployment (if needed)
```bash
cd shared-infra/terraform

# Initialize Terraform
terraform init

# Plan changes
terraform plan -out=tfplan

# Apply changes
terraform apply tfplan

# Verify outputs
terraform output
```

---

## Application Infrastructure Deployment

### 🎯 What This Deploys
- ECS Cluster
- ECS Task Definitions
- ECS Services
- Security Groups
- Target Groups (connects to ALB)
- IAM task roles

### 🚀 Git Push Deployment

**Step 1: Update Application Infrastructure**
```bash
cd mern-app/terraform

# Edit infrastructure
vim main.tf

# Update variables if needed
vim variables.tf
```

**Step 2: Commit and Push**
```bash
git add .
git commit -m "feat: update MERN app infrastructure - increase task memory"
git push origin main
```

### 📋 Required Environment Variables
Ensure these are set in your CI/CD pipeline:
```bash
AWS_ACCESS_KEY_ID=xxxxx
AWS_SECRET_ACCESS_KEY=xxxxx
AWS_DEFAULT_REGION=eu-west-2
ECR_REPO_BACKEND=357402308721.dkr.ecr.eu-west-2.amazonaws.com/mern-app-backend
ECR_REPO_FRONTEND=357402308721.dkr.ecr.eu-west-2.amazonaws.com/mern-app-frontend
```

---

## Application Code Deployment

### 🎯 What This Deploys
- Docker images for frontend/backend
- Application code updates
- Environment configuration
- Rolling updates to ECS services

### 🚀 Frontend Changes (React)

**Step 1: Make Code Changes**
```bash
cd mern-app/frontend

# Edit React components
vim src/components/FormStep.js
vim src/pages/FormPage.js

# Test locally
npm start
```

**Step 2: Push Changes**
```bash
git add .
git commit -m "feat: improve form validation UI"
git push origin main
```

**CI/CD Pipeline Will:**
1. Build React app (`npm run build`)
2. Create Docker image with `--platform linux/amd64`
3. Push to ECR
4. Update ECS task definition
5. Deploy new version with rolling update

### 🚀 Backend Changes (Express/Node.js)

**Step 1: Make Code Changes**
```bash
cd mern-app/backend

# Edit API routes
vim routes/formRoutes.js
vim controllers/formController.js

# Test locally
npm start
```

**Step 2: Push Changes**
```bash
git add .
git commit -m "feat: add new API endpoint for file upload"
git push origin main
```

### 📋 Environment Variables for Applications

**Backend (.env):**
```env
NODE_ENV=production
PORT=5000
AWS_REGION=eu-west-2
DYNAMO_TABLE_NAME=cloud-apps-table
S3_BUCKET_NAME=cloud-apps-shared-bucket-xxxxx
JWT_SECRET=xxxxx
FRONTEND_URL=https://app1.mrchughes.site
```

**Frontend (.env):**
```env
REACT_APP_API_URL=https://app1.mrchughes.site/api
REACT_APP_S3_BUCKET=cloud-apps-shared-bucket-xxxxx
```

---

## Deployment Failure Recovery

### 🚨 Common Failure Scenarios

#### 1. Docker Build Failures
**Symptoms:**
- Build fails in CI/CD
- "Platform mismatch" errors
- Missing dependencies

**Recovery Steps:**
```bash
# Local debugging
cd mern-app/frontend  # or backend
docker build --platform linux/amd64 -t test-image .

# Check Dockerfile
vim Dockerfile

# Fix common issues:
# - Add missing packages to package.json
# - Fix COPY paths
# - Ensure proper base image
```

#### 2. ECS Task Failures
**Symptoms:**
- Tasks fail to start
- Tasks stop immediately
- Health check failures

**Recovery Steps:**
```bash
# Check ECS task logs
aws ecs describe-tasks --cluster cloud-apps-mern-cluster --tasks TASK_ID

# Check CloudWatch logs
aws logs describe-log-groups --log-group-name-prefix "/ecs/"

# Common fixes:
# - Check environment variables
# - Verify IAM permissions
# - Check security group rules
# - Verify target group health checks
```

#### 3. Terraform State Issues
**Symptoms:**
- State lock errors
- Resource conflicts
- "Resource already exists" errors

**Recovery Steps:**
```bash
# Check state lock
terraform force-unlock LOCK_ID

# Import existing resources
terraform import aws_s3_bucket.example bucket-name

# Refresh state
terraform refresh

# Nuclear option - recreate state
terraform state rm RESOURCE
terraform import RESOURCE RESOURCE_ID
```

#### 4. DNS/Route53 Issues
**Symptoms:**
- Domain not resolving
- SSL certificate errors
- Wrong IP addresses

**Recovery Steps:**
```bash
# Check Route53 records
aws route53 list-resource-record-sets --hosted-zone-id ZONE_ID

# Verify ALB DNS
aws elbv2 describe-load-balancers --names cloud-apps-alb

# Test direct ALB access
curl -k -H "Host: app1.mrchughes.site" https://ALB_DNS_NAME

# Clear DNS cache
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder
```

### 🔧 Emergency Rollback

#### Quick Rollback via Git
```bash
# Find last working commit
git log --oneline

# Revert to last working version
git revert HEAD
git push origin main

# Or force rollback
git reset --hard LAST_GOOD_COMMIT
git push --force origin main
```

#### Manual ECS Rollback
```bash
# List task definitions
aws ecs list-task-definitions --family-prefix cloud-apps-mern-backend

# Update service to previous task definition
aws ecs update-service \
  --cluster cloud-apps-mern-cluster \
  --service cloud-apps-mern-backend \
  --task-definition cloud-apps-mern-backend:PREVIOUS_REVISION
```

---

## Environment Teardown

### 🛑 Complete Environment Shutdown

When you want to bring down the entire environment (to save costs), follow this order:

#### 1. Stop Applications (Keep Infrastructure)
```bash
# Scale ECS services to 0
aws ecs update-service \
  --cluster cloud-apps-mern-cluster \
  --service cloud-apps-mern-backend \
  --desired-count 0

aws ecs update-service \
  --cluster cloud-apps-mern-cluster \
  --service cloud-apps-mern-frontend \
  --desired-count 0
```

#### 2. Destroy Application Infrastructure
```bash
cd mern-app/terraform

# Destroy app infrastructure
terraform destroy -auto-approve
```

#### 3. Destroy Shared Infrastructure
```bash
cd shared-infra/terraform

# Destroy shared infrastructure
terraform destroy -auto-approve
```

### 🔄 Quick Restart from Shutdown

#### Option 1: Git Push (Recommended)
```bash
# Make a small change to trigger redeployment
echo "# Restart $(date)" >> README.md
git add README.md
git commit -m "chore: restart environment"
git push origin main
```

#### Option 2: Manual Restart
```bash
# 1. Deploy shared infrastructure
cd shared-infra/terraform
terraform apply -auto-approve

# 2. Deploy app infrastructure
cd ../../mern-app/terraform
terraform apply \
  -var="ecr_repo_backend=357402308721.dkr.ecr.eu-west-2.amazonaws.com/mern-app-backend:latest" \
  -var="ecr_repo_frontend=357402308721.dkr.ecr.eu-west-2.amazonaws.com/mern-app-frontend:latest" \
  -auto-approve
```

### 💰 Cost Optimization Schedule

**Automated Shutdown Script:**
```bash
#!/bin/bash
# scripts/nightly-shutdown.sh

# Scale down ECS services at night
aws ecs update-service --cluster cloud-apps-mern-cluster --service cloud-apps-mern-backend --desired-count 0
aws ecs update-service --cluster cloud-apps-mern-cluster --service cloud-apps-mern-frontend --desired-count 0

echo "Environment scaled down at $(date)"
```

**Automated Startup Script:**
```bash
#!/bin/bash
# scripts/morning-startup.sh

# Scale up ECS services in the morning
aws ecs update-service --cluster cloud-apps-mern-cluster --service cloud-apps-mern-backend --desired-count 1
aws ecs update-service --cluster cloud-apps-mern-cluster --service cloud-apps-mern-frontend --desired-count 1

echo "Environment scaled up at $(date)"
```

**Add to crontab:**
```bash
# Edit crontab
crontab -e

# Add these lines:
# Scale down at 10 PM every day
0 22 * * * /path/to/scripts/nightly-shutdown.sh

# Scale up at 8 AM every weekday
0 8 * * 1-5 /path/to/scripts/morning-startup.sh
```

---

## Troubleshooting

### 🔍 Health Check Commands

#### Check Everything Status
```bash
# ECS Services
aws ecs describe-services --cluster cloud-apps-mern-cluster --services cloud-apps-mern-backend cloud-apps-mern-frontend

# Target Groups
aws elbv2 describe-target-health --target-group-arn TARGET_GROUP_ARN

# ALB
aws elbv2 describe-load-balancers --names cloud-apps-alb

# Route53
aws route53 list-resource-record-sets --hosted-zone-id ZONE_ID
```

#### Test Application Endpoints
```bash
# Get ALB DNS
ALB_DNS=$(terraform output -raw alb_dns_name)

# Test frontend
curl -k -H "Host: app1.mrchughes.site" https://$ALB_DNS

# Test backend API
curl -k -H "Host: app1.mrchughes.site" https://$ALB_DNS/api/

# Test with actual domain (once DNS propagates)
curl https://app1.mrchughes.site
```

### 📞 Emergency Contacts

- **AWS Support**: Create support case in AWS Console
- **Domain Provider**: Contact for DNS issues
- **DevOps Team**: [Add contact information]

### 📚 Useful Resources

- [AWS ECS Troubleshooting Guide](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/troubleshooting.html)
- [Terraform State Management](https://www.terraform.io/docs/language/state/index.html)
- [Docker Multi-platform Builds](https://docs.docker.com/build/building/multi-platform/)

---

## Summary

This guide covers the complete lifecycle of deploying and managing your cloud applications. The key principle is **Git Push Deployment** - most changes should be deployed by simply pushing to the main branch.

**Remember the deployment order:**
1. 🏗️ Shared Infrastructure First
2. 🔧 Application Infrastructure Second  
3. 📱 Application Code Last

**For emergencies:**
- Use the rollback procedures
- Check the troubleshooting section
- Scale down for cost optimization when not in use

**Daily Operations:**
- Monitor ECS services health
- Check CloudWatch logs for errors
- Verify DNS resolution
- Monitor AWS costs

Happy deploying! 🚀
