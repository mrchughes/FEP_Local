variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-2"
}
variable "domain_name" {
  description = "Your root domain name"
  type        = string
  default     = "mrchughes.site"
}
variable "app1_subdomain" {
  description = "Subdomain for MERN app"
  type        = string
  default     = "app1"
}
variable "app2_subdomain" {
  description = "Subdomain for Python app"
  type        = string
  default     = "app2"
}

# Deployment tracking variables
variable "deployment_id" {
  description = "Unique identifier for this deployment (e.g., GitHub run ID)"
  type        = string
  default     = ""
}

variable "deployment_source" {
  description = "Source of the deployment (e.g., github-actions, manual, terraform-cloud)"
  type        = string
  default     = ""
}
