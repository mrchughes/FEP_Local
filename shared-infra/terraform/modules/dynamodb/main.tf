variable "table_name" {
  description = "Name of the DynamoDB table"
  type        = string
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

resource "aws_dynamodb_table" "app" {
  name         = var.table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "email"

  attribute {
    name = "email"
    type = "S"
  }

  tags = merge(
    {
      Name    = "cloud-apps-table"
      Project = "cloud-apps-bundle"
    },
    var.common_tags
  )
}

output "table_name" {
  value = aws_dynamodb_table.app.id
}
