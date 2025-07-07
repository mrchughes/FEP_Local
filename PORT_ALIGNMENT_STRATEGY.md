# 🔌 PORT ALIGNMENT STRATEGY
## Ensuring Port Consistency Across All Deployment Layers

### 🎯 **OVERVIEW**
Port misalignment is one of the most common causes of deployment failures. This strategy ensures ports stay aligned across Docker, Terraform, ALB, and application configurations through:

1. **📋 Single Source of Truth** - Port standards documented
2. **🔍 Automated Validation** - Scripts to check alignment
3. **🛡️ Pre-commit Protection** - Prevent bad commits
4. **🚀 CI/CD Integration** - Block deployments with misaligned ports
5. **📖 Clear Change Process** - Structured approach to port changes

---

## 📋 **CURRENT PORT CONFIGURATION**

| Service | Layer | Configuration | Port | Status |
|---------|-------|---------------|------|---------|
| **MERN Frontend** | Docker | `EXPOSE 80` | 80 | ✅ |
| | Terraform | `containerPort = 80` | 80 | ✅ |
| | ALB Target Group | `port = 80` | 80 | ✅ |
| | Nginx | Default HTTP | 80 | ✅ |
| **MERN Backend** | Docker | `EXPOSE 5000` | 5000 | ✅ |
| | Terraform | `containerPort = 5000` | 5000 | ✅ |
| | ALB Target Group | `port = 5000` | 5000 | ✅ |
| | Express App | `process.env.PORT \|\| 5000` | 5000 | ✅ |
| **Python App** | Docker | `EXPOSE 80` | 80 | ✅ |
| | Terraform | `containerPort = 80` | 80 | ✅ |
| | ALB Target Group | `port = 80` | 80 | ✅ |
| | Gunicorn | `-b 0.0.0.0:80` | 80 | ✅ |

---

## 🔍 **AUTOMATED VALIDATION LAYERS**

### **1. Pre-Commit Hook Validation**
```bash
# Runs automatically before every git commit
./scripts/validate-port-alignment.sh
```
**What it checks:**
- Docker EXPOSE statements
- Terraform containerPort configurations  
- ALB target group port settings
- Application listening ports

### **2. GitHub Actions CI/CD Validation**
```yaml
# Runs during deployment pipeline
- name: Infrastructure Configuration Validation
  run: ./scripts/validate-port-alignment.sh
```
**When it runs:**
- Before infrastructure deployment
- Before application deployment
- On pull requests

### **3. Manual Validation Command**
```bash
# Run anytime to check port alignment
./scripts/validate-port-alignment.sh
```

---

## 🛡️ **PORT CHANGE PROTECTION STRATEGY**

### **A. Prevention Mechanisms**

1. **📝 Documentation First**
   - `PORT_STANDARDS.md` defines canonical port assignments
   - All changes must update documentation first

2. **🔒 Git Hooks**
   - Pre-commit validation prevents bad commits
   - Automatic port alignment checking

3. **🚫 CI/CD Blocks**
   - Deployment pipeline fails on port mismatches
   - No manual override without validation

4. **👥 Code Review Requirements**
   - Port changes require senior developer review
   - Checklist includes all 4 layers

### **B. Detection Mechanisms**

1. **🎯 Comprehensive Scanning**
   ```bash
   # Validates 4 critical layers:
   - Docker EXPOSE ports
   - Terraform containerPort
   - ALB target group ports  
   - Application listening ports
   ```

2. **📊 Cross-Reference Validation**
   - Compares expected vs actual ports
   - Identifies mismatches with specific file locations

3. **🚨 Clear Error Reporting**
   - Exact file and line number
   - Expected vs actual port values
   - Color-coded pass/fail status

---

## 🔧 **SAFE PORT CHANGE PROCESS**

### **Step 1: Plan the Change**
```bash
# 1. Document the change reason
echo "Why changing port? Security/Architecture/Requirements?"

# 2. Identify all affected layers
echo "List all files that need updates"
```

### **Step 2: Update All Layers Simultaneously**
```bash
# 1. Update PORT_STANDARDS.md first
vim PORT_STANDARDS.md

# 2. Update Docker files
vim */*/Dockerfile*

# 3. Update application code
vim */*/app.* */*/server.*

# 4. Update Terraform configurations
vim */terraform/main.tf

# 5. Update ALB target group configurations
vim shared-infra/terraform/modules/alb/main.tf
```

### **Step 3: Validate Before Commit**
```bash
# Run validation script
./scripts/validate-port-alignment.sh

# If validation fails:
# - Fix all reported mismatches
# - Re-run validation
# - Repeat until all checks pass
```

### **Step 4: Test Locally**
```bash
# Build and test Docker containers
docker build -t test-app ./app-directory/
docker run -p HOST_PORT:CONTAINER_PORT test-app

# Verify port accessibility
curl localhost:HOST_PORT/health
```

### **Step 5: Commit with Validation**
```bash
# Pre-commit hook will automatically validate
git add -A
git commit -m "Update service port: OLD_PORT → NEW_PORT

- Updated Docker EXPOSE statements
- Updated Terraform containerPort
- Updated ALB target group ports
- Updated application listening ports
- All validation checks passed"
```

---

## 🚨 **EMERGENCY PORT MISMATCH RESOLUTION**

### **If Deployment Fails Due to Port Mismatch:**

1. **🔍 Immediate Diagnosis**
   ```bash
   # Run port validation to identify mismatches
   ./scripts/validate-port-alignment.sh
   
   # Check ALB target group health
   aws elbv2 describe-target-health --target-group-arn <ARN>
   
   # Check ECS service status
   aws ecs describe-services --cluster <CLUSTER> --services <SERVICE>
   ```

2. **🚑 Quick Fix Process**
   ```bash
   # Option A: Fix and redeploy (RECOMMENDED)
   # 1. Fix all reported port mismatches
   # 2. Run validation until all pass
   # 3. Commit and redeploy
   
   # Option B: Emergency rollback
   # 1. Revert to last known good state
   # 2. Fix port alignment in separate PR
   # 3. Plan proper deployment
   ```

3. **🛡️ Prevention for Next Time**
   - Review why validation was bypassed
   - Strengthen pre-commit hooks if needed
   - Add additional validation layers

---

## 📊 **MONITORING & MAINTENANCE**

### **Regular Health Checks**
```bash
# Weekly validation (add to cron)
0 9 * * 1 cd /path/to/repo && ./scripts/validate-port-alignment.sh

# Before any infrastructure changes
./scripts/validate-port-alignment.sh

# After any port-related changes
./scripts/validate-port-alignment.sh
```

### **Validation Script Maintenance**
- Update script when adding new services
- Enhance pattern matching for new file types
- Add validation for new deployment layers

### **Documentation Updates**
- Keep `PORT_STANDARDS.md` current
- Update this strategy guide with lessons learned
- Document any new port requirements

---

## ✅ **SUCCESS METRICS**

- **Zero deployment failures** due to port mismatches
- **100% port alignment** across all services
- **Automatic prevention** of port misconfigurations
- **Clear resolution path** when issues occur

---

## 🎯 **SUMMARY**

This multi-layered port alignment strategy ensures:

1. **🔒 Prevention** - Stops port mismatches before they happen
2. **🔍 Detection** - Automatically finds any existing mismatches  
3. **🚑 Resolution** - Clear process to fix issues quickly
4. **📊 Monitoring** - Ongoing validation and maintenance

**Result: Zero-downtime deployments with perfect port alignment.**
