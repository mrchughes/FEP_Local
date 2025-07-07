# Cloud Apps Bundle - Scripts Directory

This directory contains all utility scripts for managing the cloud apps bundle project.

## 📁 Script Organization

All scripts are now centralized in this `scripts/` directory for better organization:

### 🚀 **Deployment & Management**
- `cloud-ops.sh` - All-in-one management script
- `monitor-deployment.sh` - Deployment monitoring
- `complete-infrastructure-cleanup.sh` - Emergency cleanup tool

### �️ **Protection & Recovery**
- `detect-orphaned-resources.sh` - **NEW** - Comprehensive orphaned resource detection and cleanup generation
- `deployment-failure-recovery.sh` - **NEW** - Automated recovery from failed deployments
- `complete-infrastructure-cleanup.sh` - Emergency cleanup tool

### �🔍 **Monitoring & Validation**  
- `prevent-config-drift.sh` - Configuration drift prevention
- `monitor-dns-health.sh` - DNS health monitoring
- `validate-state-keys.sh` - Terraform state validation
- `validate-port-alignment.sh` - Port configuration validation
- `comprehensive-test.sh` - Complete infrastructure testing

### ⚙️ **Setup & Tools**
- `setup-monitoring.sh` - Monitoring setup
- `test-dns-propagation.sh` - DNS propagation testing

## 🎯 Quick Operations Script

### `cloud-ops.sh` - All-in-One Management Script

A comprehensive script for deploying, managing, and troubleshooting your cloud applications.

#### Usage
```bash
./scripts/cloud-ops.sh [command]
```

#### Available Commands

**Deployment:**
- `deploy` - Full deployment (shared infra + app + images)
- `deploy-shared` - Deploy shared infrastructure only
- `deploy-app` - Deploy MERN app infrastructure only
- `build-images` - Build and push Docker images only

**Management:**
- `scale-up` - Scale services up (restart after shutdown)
- `scale-down` - Scale services to 0 (cost optimization)
- `health` - Run comprehensive health checks
- `status` - Show current deployment status
- `logs` - View recent application logs

**Maintenance:**
- `check` - Verify all prerequisites
- `teardown` - Destroy all infrastructure (with confirmation)
- `help` - Show detailed help

#### Quick Examples

**Daily Operations:**
```bash
# Check if everything is running
./scripts/cloud-ops.sh status

# Save costs when not using
./scripts/cloud-ops.sh scale-down

# Restart when needed
./scripts/cloud-ops.sh scale-up

# Check application health
./scripts/cloud-ops.sh health
```

**Full Deployment:**
```bash
# Deploy everything from scratch
./scripts/cloud-ops.sh deploy

# Or step by step:
./scripts/cloud-ops.sh deploy-shared
./scripts/cloud-ops.sh build-images  
./scripts/cloud-ops.sh deploy-app
```

**Troubleshooting:**
```bash
# View recent logs
./scripts/cloud-ops.sh logs

# Check detailed status
./scripts/cloud-ops.sh status

# Run health checks
./scripts/cloud-ops.sh health
```

**Cost Management:**
```bash
# Stop everything to save money
./scripts/cloud-ops.sh scale-down

# Restart when needed
./scripts/cloud-ops.sh scale-up

# Complete teardown (nuclear option)
./scripts/cloud-ops.sh teardown
```

## Legacy Scripts

### Cleanup Scripts
- `complete-infrastructure-cleanup.sh` - Emergency cleanup tool for all AWS resources

### Archive
- `archive/` - Contains older utility scripts

## Prerequisites

Before using any scripts, ensure you have:
- AWS CLI configured (`aws configure`)
- Docker installed and running
- Terraform installed (v1.0+)
- Node.js and npm (for building applications)
- Appropriate AWS permissions

## Configuration

The main script uses these default values:
- **AWS Region:** `eu-west-2`
- **ECR Registry:** `357402308721.dkr.ecr.eu-west-2.amazonaws.com`
- **ECS Cluster:** `cloud-apps-mern-cluster`
- **Domain:** `app1.mrchughes.site`

Edit the script header to modify these values for your environment.

## Integration with Git Workflow

These scripts complement the automated GitHub Actions workflow:
- Use GitHub Actions for production deployments via git push
- Use these scripts for development, testing, and manual operations
- Use `scale-down`/`scale-up` for cost optimization during development

## Troubleshooting

If you encounter issues:
1. Run `./scripts/cloud-ops.sh check` to verify prerequisites
2. Check AWS credentials: `aws sts get-caller-identity`
3. Verify Docker is running: `docker ps`
4. See the main `DEPLOYMENT_GUIDE.md` for detailed troubleshooting

## Safety Features

- **Confirmation prompts** for destructive operations
- **Color-coded output** for easy status identification
- **Prerequisite checks** before major operations
- **Automatic rollback** capabilities in CI/CD pipeline
