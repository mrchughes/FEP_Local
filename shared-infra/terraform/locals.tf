# Consistent naming convention for all resources
locals {
  project_name   = "cloud-apps-bundle"
  project_prefix = "cloud-apps"

  # Deployment tracking variables
  deployment_id     = var.deployment_id != "" ? var.deployment_id : "${formatdate("YYYY-MM-DD-hhmm", timestamp())}"
  deployment_source = var.deployment_source != "" ? var.deployment_source : "manual"

  # Common tags to apply to all resources
  common_tags = {
    Project             = local.project_name
    Environment         = "production"
    ManagedBy           = "terraform"
    DeploymentId        = local.deployment_id
    DeploymentSource    = local.deployment_source
    DeploymentTimestamp = timestamp()
    Component           = "infrastructure"
  }

  # Consistent naming patterns
  vpc_name   = "${local.project_prefix}-vpc"
  alb_name   = "${local.project_prefix}-alb"
  ecr_prefix = local.project_prefix

  # For ECS clusters
  mern_cluster_name   = "${local.project_prefix}-mern-cluster"
  python_cluster_name = "${local.project_prefix}-python-cluster"

  # For storage
  dynamodb_table_name = "${local.project_prefix}-table"
  s3_bucket_name      = "${local.project_prefix}-shared-bucket"
}
