variable "vpc_id" {}
variable "public_subnet_ids" { type = list(string) }
variable "domain_name" {}
variable "zone_id" {}
variable "app1_subdomain" {}
variable "app2_subdomain" {}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

resource "aws_lb" "shared_alb" {
  name               = "cloud-apps-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = var.public_subnet_ids

  tags = merge(
    {
      Name        = "cloud-apps-alb"
      Project     = "cloud-apps-bundle"
      Environment = "production"
    },
    var.common_tags
  )
}

resource "aws_security_group" "alb_sg" {
  name        = "cloud-apps-alb-sg"
  description = "Security group for Cloud Apps ALB"
  vpc_id      = var.vpc_id

  tags = merge(
    {
      Name    = "cloud-apps-alb-sg"
      Project = "cloud-apps-bundle"
    },
    var.common_tags
  )

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_acm_certificate" "ssl_cert" {
  domain_name       = var.domain_name
  validation_method = "DNS"
  subject_alternative_names = [
    "${var.app1_subdomain}.${var.domain_name}",
    "${var.app2_subdomain}.${var.domain_name}"
  ]

  lifecycle {
    create_before_destroy = true
  }
}

# Use a splat expression instead of for_each to avoid the dependency cycle
resource "aws_route53_record" "cert_validation_main" {
  zone_id = var.zone_id
  name    = tolist(aws_acm_certificate.ssl_cert.domain_validation_options)[0].resource_record_name
  type    = tolist(aws_acm_certificate.ssl_cert.domain_validation_options)[0].resource_record_type
  records = [tolist(aws_acm_certificate.ssl_cert.domain_validation_options)[0].resource_record_value]
  ttl     = 60
}

resource "aws_route53_record" "cert_validation_app1" {
  zone_id = var.zone_id
  name    = tolist(aws_acm_certificate.ssl_cert.domain_validation_options)[1].resource_record_name
  type    = tolist(aws_acm_certificate.ssl_cert.domain_validation_options)[1].resource_record_type
  records = [tolist(aws_acm_certificate.ssl_cert.domain_validation_options)[1].resource_record_value]
  ttl     = 60
}

resource "aws_route53_record" "cert_validation_app2" {
  zone_id = var.zone_id
  name    = tolist(aws_acm_certificate.ssl_cert.domain_validation_options)[2].resource_record_name
  type    = tolist(aws_acm_certificate.ssl_cert.domain_validation_options)[2].resource_record_type
  records = [tolist(aws_acm_certificate.ssl_cert.domain_validation_options)[2].resource_record_value]
  ttl     = 60
}
resource "aws_acm_certificate_validation" "ssl_validation" {
  certificate_arn = aws_acm_certificate.ssl_cert.arn
  validation_record_fqdns = [
    aws_route53_record.cert_validation_main.fqdn,
    aws_route53_record.cert_validation_app1.fqdn,
    aws_route53_record.cert_validation_app2.fqdn,
  ]
}

resource "aws_lb_target_group" "app1" {
  name        = "cloud-apps-app1-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  tags = merge(
    {
      Name        = "cloud-apps-app1-tg"
      Project     = "cloud-apps-bundle"
      Environment = "production"
    },
    var.common_tags
  )

  health_check {
    path     = "/"
    protocol = "HTTP"
  }
}

resource "aws_lb_target_group" "app2" {
  name        = "cloud-apps-app2-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  tags = merge(
    {
      Name        = "cloud-apps-app2-tg"
      Project     = "cloud-apps-bundle"
      Environment = "production"
    },
    var.common_tags
  )

  health_check {
    path     = "/"
    protocol = "HTTP"
  }
}

# Backend API target group for MERN backend
resource "aws_lb_target_group" "backend_api" {
  name        = "cloud-apps-backend-api-tg"
  port        = 5000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  tags = merge(
    {
      Name        = "cloud-apps-backend-api-tg"
      Project     = "cloud-apps-bundle"
      Environment = "production"
    },
    var.common_tags
  )

  health_check {
    path     = "/"
    protocol = "HTTP"
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.shared_alb.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.ssl_validation.certificate_arn

  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Not found"
      status_code  = "404"
    }
  }
}

# Backend API routing rule - higher priority for /api/* paths
resource "aws_lb_listener_rule" "backend_api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 5
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend_api.arn
  }
  condition {
    host_header {
      values = ["${var.app1_subdomain}.${var.domain_name}"]
    }
  }
  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}

resource "aws_lb_listener_rule" "app1" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app1.arn
  }
  condition {
    host_header {
      values = ["${var.app1_subdomain}.${var.domain_name}"]
    }
  }
}

resource "aws_lb_listener_rule" "app2" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 20
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app2.arn
  }
  condition {
    host_header {
      values = ["${var.app2_subdomain}.${var.domain_name}"]
    }
  }
}

resource "aws_route53_record" "app1" {
  zone_id = var.zone_id
  name    = "${var.app1_subdomain}.${var.domain_name}"
  type    = "A"
  alias {
    name                   = aws_lb.shared_alb.dns_name
    zone_id                = aws_lb.shared_alb.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "app2" {
  zone_id = var.zone_id
  name    = "${var.app2_subdomain}.${var.domain_name}"
  type    = "A"
  alias {
    name                   = aws_lb.shared_alb.dns_name
    zone_id                = aws_lb.shared_alb.zone_id
    evaluate_target_health = true
  }
}

output "alb_dns_name" { value = aws_lb.shared_alb.dns_name }
output "app1_tg_arn" { value = aws_lb_target_group.app1.arn }
output "app2_tg_arn" { value = aws_lb_target_group.app2.arn }
output "backend_api_tg_arn" { value = aws_lb_target_group.backend_api.arn }
