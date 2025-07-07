variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

resource "aws_s3_bucket" "app" {
  bucket        = "cloud-apps-shared-bucket-${random_string.bucket_suffix.result}"
  force_destroy = true

  tags = merge(var.common_tags, {
    Name     = "cloud-apps-shared-bucket"
    Resource = "s3-bucket"
  })
}

resource "random_string" "bucket_suffix" {
  length  = 8
  special = false
  upper   = false
}

output "bucket_name" {
  value = aws_s3_bucket.app.id
}
