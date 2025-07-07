# Deployment Constraint Validation
# This file enforces region and domain constraints in Terraform

# Get current region from provider
data "aws_region" "current" {}

# Get current caller identity for validation
data "aws_caller_identity" "current" {}

# Validate that the current region is eu-west-2
locals {
  is_valid_region = data.aws_region.current.name == "eu-west-2"
  is_valid_domain = var.domain_name == "mrchughes.site"
}

# Create a validation check that will fail if constraints are violated
resource "null_resource" "region_validation" {
  count = local.is_valid_region ? 0 : 1

  provisioner "local-exec" {
    command = "echo '🚨 CONSTRAINT VIOLATION: aws_region must be eu-west-2. Current value: ${data.aws_region.current.name}. This prevents accidental deployments to other regions.' && exit 1"
  }
}

resource "null_resource" "domain_validation" {
  count = local.is_valid_domain ? 0 : 1

  provisioner "local-exec" {
    command = "echo '🚨 CONSTRAINT VIOLATION: domain_name must be mrchughes.site. Current value: ${var.domain_name}. This prevents accidental deployments for other domains.' && exit 1"
  }
}

# Output validation results for logging
output "deployment_constraints_validated" {
  description = "Confirmation that deployment constraints are satisfied"
  value = {
    region_constraint = "✅ Region constrained to: ${data.aws_region.current.name}"
    domain_constraint = "✅ Domain constrained to: ${var.domain_name}"
    validation_status = "✅ All deployment constraints satisfied"
    current_region    = data.aws_region.current.name
    account_id        = data.aws_caller_identity.current.account_id
    timestamp         = timestamp()
  }

  depends_on = [
    null_resource.region_validation,
    null_resource.domain_validation
  ]
}
