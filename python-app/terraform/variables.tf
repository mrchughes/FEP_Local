variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-2"
}

# Variable for container image (passed from CI/CD)
variable "ecr_repo_app2" {
  description = "Python app ECR repository URL with tag"
  type        = string
}

# Deployment tracking variables
variable "deployment_id" {
  description = "Unique identifier for this deployment"
  type        = string
  default     = ""
}

variable "deployment_source" {
  description = "Source of the deployment"
  type        = string
  default     = "manual"
}
