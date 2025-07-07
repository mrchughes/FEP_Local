variable "app1_repo" {}
variable "app2_repo" {}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

resource "aws_ecr_repository" "app1_frontend" {
  name = "${var.app1_repo}-frontend"

  tags = merge(
    {
      Name      = "${var.app1_repo}-frontend-ecr"
      Project   = "cloud-apps-bundle"
      Component = "frontend"
    },
    var.common_tags
  )

  lifecycle {
    ignore_changes  = [image_scanning_configuration, image_tag_mutability]
    prevent_destroy = false
  }
}

resource "aws_ecr_repository" "app1_backend" {
  name = "${var.app1_repo}-backend"

  tags = merge(
    {
      Name      = "${var.app1_repo}-backend-ecr"
      Project   = "cloud-apps-bundle"
      Component = "backend"
    },
    var.common_tags
  )

  lifecycle {
    ignore_changes  = [image_scanning_configuration, image_tag_mutability]
    prevent_destroy = false
  }
}

resource "aws_ecr_repository" "app2" {
  name = var.app2_repo

  tags = merge(
    {
      Name      = "${var.app2_repo}-ecr"
      Project   = "cloud-apps-bundle"
      Component = "python-app"
    },
    var.common_tags
  )

  lifecycle {
    ignore_changes  = [image_scanning_configuration, image_tag_mutability]
    prevent_destroy = false
  }
}

output "app1_frontend_repo_url" { value = aws_ecr_repository.app1_frontend.repository_url }
output "app1_backend_repo_url" { value = aws_ecr_repository.app1_backend.repository_url }
output "app2_repo_url" { value = aws_ecr_repository.app2.repository_url }
