variable "domain_name" {}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

resource "aws_route53_zone" "main" {
  name = var.domain_name

  tags = merge(
    {
      Name = "${var.domain_name}-hosted-zone"
    },
    var.common_tags
  )
}

output "zone_id" {
  value = aws_route53_zone.main.zone_id
}

output "name_servers" {
  value       = aws_route53_zone.main.name_servers
  description = "Route53 name servers that need to be configured with your domain provider"
}

output "domain_validation_options" {
  value       = aws_route53_zone.main.name_servers
  description = "Name servers for domain verification"
}
