# Infrastructure Configuration Standards

## PURPOSE
Prevent configuration drift and ensure consistency across all Terraform components.

---

## 🎯 MANDATORY STANDARDS

### 1. STATE KEY NAMING CONVENTION
**Pattern**: `{component-name}/terraform.tfstate`

**Examples**:
```hcl
# ✅ CORRECT
terraform {
  backend "s3" {
    bucket = "cloud-apps-terraform-state-bucket"
    key    = "shared-infra/terraform.tfstate"
    region = "eu-west-2"
  }
}

# ✅ CORRECT
terraform {
  backend "s3" {
    bucket = "cloud-apps-terraform-state-bucket"
    key    = "mern-app/terraform.tfstate"
    region = "eu-west-2"
  }
}

# ❌ WRONG - no component directory
terraform {
  backend "s3" {
    bucket = "cloud-apps-terraform-state-bucket"
    key    = "terraform.tfstate"  # NEVER USE ROOT LEVEL
    region = "eu-west-2"
  }
}
```

### 2. REMOTE STATE REFERENCE PATTERN
**Rule**: Always reference the full path to the component's state

```hcl
# ✅ CORRECT - Reference shared-infra from any other component
data "terraform_remote_state" "shared_infra" {
  backend = "s3"
  config = {
    bucket = "cloud-apps-terraform-state-bucket"
    key    = "shared-infra/terraform.tfstate"  # Full path
    region = "eu-west-2"
  }
}

# ❌ WRONG - incomplete or incorrect path
data "terraform_remote_state" "shared_infra" {
  backend = "s3"
  config = {
    bucket = "cloud-apps-terraform-state-bucket"
    key    = "terraform.tfstate"  # Missing component directory
    region = "eu-west-2"
  }
}
```

### 3. AWS PROVIDER REGION CONSISTENCY
**Rule**: All components must use eu-west-2

```hcl
# ✅ CORRECT - Variable reference (preferred)
provider "aws" {
  region = var.aws_region  # defaults to "eu-west-2" in variables.tf
}

# ✅ CORRECT - Hardcoded (acceptable)
provider "aws" {
  region = "eu-west-2"
}

# ❌ WRONG - Different region
provider "aws" {
  region = "us-east-1"  # NEVER use different regions
}
```

### 4. DIRECTORY STRUCTURE STANDARD
```
component-name/
├── terraform/
│   ├── main.tf           # Contains backend config + main resources
│   ├── provider.tf       # Contains provider configuration
│   ├── variables.tf      # Contains variable definitions (optional)
│   ├── outputs.tf        # Contains output definitions
│   └── modules/          # Component-specific modules (if any)
```

### 5. BACKEND CONFIGURATION TEMPLATE
**Copy this template for new components**:

```hcl
# Configure S3 backend for remote state
terraform {
  backend "s3" {
    bucket = "cloud-apps-terraform-state-bucket"
    key    = "COMPONENT-NAME/terraform.tfstate"  # REPLACE COMPONENT-NAME
    region = "eu-west-2"
  }
}
```

---

## 🛡️ VALIDATION REQUIREMENTS

### Before Any Infrastructure Changes:
1. **Run validation script**: `./scripts/validate-state-keys.sh`
2. **Check terraform format**: `terraform fmt -check -recursive`
3. **Validate configurations**: `terraform validate` in each component
4. **Verify S3 state accessibility**: `aws s3 ls s3://cloud-apps-terraform-state-bucket/`

### After Infrastructure Changes:
1. **Re-run validation script**
2. **Test cross-component access**: Verify remote state data sources work
3. **Check for orphaned resources**: Review terraform plan output
4. **Update documentation**: Document any new components or dependencies

---

## 🤖 AI ASSISTANT GUIDELINES

### For Any AI Helping with Infrastructure:

#### BEFORE Creating/Modifying Files:
1. **Review existing patterns**: Check how other components are configured
2. **Follow naming conventions**: Use the standard patterns above
3. **Verify cross-references**: Ensure remote state keys match actual state locations
4. **Check region consistency**: All configs must use eu-west-2

#### DURING File Creation/Modification:
1. **Use templates**: Start with the standard backend configuration template
2. **Validate syntax**: Ensure proper HCL syntax and structure
3. **Check dependencies**: Verify all referenced resources exist
4. **Document choices**: Explain any deviations from standards

#### AFTER File Creation/Modification:
1. **Run validation script**: `./scripts/validate-state-keys.sh`
2. **Test terraform init**: Ensure backend initialization works
3. **Verify terraform validate**: Check configuration syntax
4. **Test cross-component access**: Confirm remote state references work

#### MANDATORY CHECKLIST:
- [ ] Backend key follows `component-name/terraform.tfstate` pattern
- [ ] Remote state references use full paths
- [ ] All providers use eu-west-2 region
- [ ] Validation script passes
- [ ] Terraform validate passes
- [ ] Cross-component references work

---

## 🚨 COMMON MISTAKES TO AVOID

### 1. State Key Mistakes
- ❌ Using root-level state keys (`terraform.tfstate`)
- ❌ Inconsistent naming between backend and references
- ❌ Missing component directories in state paths

### 2. Cross-Reference Mistakes
- ❌ Referencing wrong state file paths
- ❌ Hardcoding bucket names inconsistently
- ❌ Using different regions in references

### 3. Region Mistakes
- ❌ Mixed regions across components
- ❌ Hardcoding wrong regions
- ❌ Inconsistent region variables

### 4. Structure Mistakes
- ❌ Putting backend config in wrong files
- ❌ Missing provider configurations
- ❌ Inconsistent directory structures

---

## 🔄 REGULAR MAINTENANCE

### Weekly Tasks:
- Run comprehensive validation script
- Review S3 bucket for orphaned state files
- Check for configuration drift

### Monthly Tasks:
- Full infrastructure audit
- Review and update standards if needed
- Test disaster recovery procedures

### Before Major Changes:
- Backup current state files
- Document current configuration
- Plan rollback procedures
- Test in staging environment

---

## 📞 ESCALATION

### When Issues Are Found:
1. **Stop all deployments** until resolved
2. **Run diagnostic scripts** to identify scope
3. **Document the issue** and impact
4. **Fix root cause** not just symptoms
5. **Update prevention measures** to avoid recurrence

### Contact Points:
- Infrastructure Lead: Review architectural decisions
- DevOps Team: Implementation and validation
- Security Team: Compliance and best practices
