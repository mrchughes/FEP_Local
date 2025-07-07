# Configure S3 backend for remote state
# Clean deployment with validation fixes and constraint enforcement
terraform {
  backend "s3" {
    bucket = "cloud-apps-terraform-state-bucket"
    key    = "mern-app/terraform.tfstate"
    region = "eu-west-2"
  }
}

# Get infrastructure outputs from shared-infra state
data "terraform_remote_state" "shared_infra" {
  backend = "s3"
  config = {
    bucket = "cloud-apps-terraform-state-bucket"
    key    = "shared-infra/terraform.tfstate"
    region = "eu-west-2"
  }
}

# Use data from shared infrastructure and add deployment tracking
locals {
  vpc_id                      = data.terraform_remote_state.shared_infra.outputs.vpc_id
  public_subnet_ids           = data.terraform_remote_state.shared_infra.outputs.public_subnet_ids
  private_subnet_ids          = data.terraform_remote_state.shared_infra.outputs.private_subnet_ids
  domain_name                 = data.terraform_remote_state.shared_infra.outputs.domain_name
  ecs_task_execution_role_arn = data.terraform_remote_state.shared_infra.outputs.ecs_task_execution_role_arn
  app1_tg_arn                 = data.terraform_remote_state.shared_infra.outputs.app1_tg_arn
  backend_api_tg_arn          = data.terraform_remote_state.shared_infra.outputs.backend_api_tg_arn
  s3_bucket_name              = data.terraform_remote_state.shared_infra.outputs.s3_bucket_name
  dynamodb_table_name         = data.terraform_remote_state.shared_infra.outputs.dynamodb_table_name

  # Deployment tracking
  deployment_id = var.deployment_id != "" ? var.deployment_id : "${formatdate("YYYY-MM-DD-hhmm", timestamp())}"

  # Common tags for MERN app resources
  common_tags = {
    Project             = "cloud-apps-bundle"
    Component           = "mern-app"
    Environment         = "production"
    ManagedBy           = "terraform"
    DeploymentId        = local.deployment_id
    DeploymentSource    = var.deployment_source
    DeploymentTimestamp = timestamp()
  }
}

# Random JWT secret for production security
resource "random_id" "jwt_secret" {
  byte_length = 32
}

# CloudWatch Log Groups for ECS logging
resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/ecs/cloud-apps-mern-frontend"
  retention_in_days = 14

  tags = merge(local.common_tags, {
    Name     = "cloud-apps-mern-frontend-logs"
    Resource = "cloudwatch-log-group"
  })
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/cloud-apps-mern-backend"
  retention_in_days = 14

  tags = merge(local.common_tags, {
    Name     = "cloud-apps-mern-backend-logs"
    Resource = "cloudwatch-log-group"
  })
}

# IAM role for ECS tasks to access AWS services
resource "aws_iam_role" "ecs_task_role" {
  name = "cloud-apps-mern-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name     = "cloud-apps-mern-ecs-task-role"
    Resource = "iam-role"
  })
}

resource "aws_iam_role_policy" "ecs_task_policy" {
  name = "cloud-apps-mern-ecs-task-policy"
  role = aws_iam_role.ecs_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = "arn:aws:dynamodb:eu-west-2:*:table/${local.dynamodb_table_name}"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "arn:aws:s3:::${local.s3_bucket_name}/*"
      }
    ]
  })
}

resource "aws_ecs_cluster" "mern" {
  name = "cloud-apps-mern-cluster"

  tags = merge(local.common_tags, {
    Name     = "cloud-apps-mern-cluster"
    Resource = "ecs-cluster"
  })
}

# Security group allowing proper ports for frontend (80) and backend (5000)
resource "aws_security_group" "mern_sg" {
  name        = "cloud-apps-mern-ecs-sg"
  vpc_id      = local.vpc_id
  description = "Security group for MERN app ECS tasks"

  tags = merge(local.common_tags, {
    Name     = "cloud-apps-mern-ecs-sg"
    Resource = "security-group"
  })
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 5000
    to_port     = 5000
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"] # VPC CIDR for backend communication
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_ecs_task_definition" "frontend" {
  family                   = "cloud-apps-mern-frontend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = local.ecs_task_execution_role_arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  tags = merge(local.common_tags, {
    Name     = "cloud-apps-mern-frontend-task"
    Resource = "ecs-task-definition"
  })

  container_definitions = jsonencode([
    {
      name         = "frontend"
      image        = var.ecr_repo_frontend
      portMappings = [{ containerPort = 80 }]
      environment = [
        { name = "REACT_APP_API_URL", value = "https://app1.${local.domain_name}/api" },
        { name = "REACT_APP_S3_BUCKET", value = local.s3_bucket_name }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/cloud-apps-mern-frontend"
          "awslogs-region"        = "eu-west-2"
          "awslogs-stream-prefix" = "ecs"
        }
      }
      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:80/ || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])
  
  # Critical: Force new task definition when image changes
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_ecs_service" "frontend" {
  name            = "cloud-apps-mern-frontend"
  cluster         = aws_ecs_cluster.mern.id
  task_definition = aws_ecs_task_definition.frontend.arn
  launch_type     = "FARGATE"
  desired_count   = 1
  
  # Force new deployment when task definition changes (CRITICAL FIX)
  force_new_deployment = true
  
  # Health check grace period to prevent premature failures
  health_check_grace_period_seconds = 120
  
  network_configuration {
    subnets          = local.public_subnet_ids
    assign_public_ip = true
    security_groups  = [aws_security_group.mern_sg.id]
  }
  load_balancer {
    target_group_arn = local.app1_tg_arn
    container_name   = "frontend"
    container_port   = 80
  }
  
  # Ensure load balancer is ready before creating service
  depends_on = [aws_ecs_task_definition.frontend]
}

resource "aws_ecs_task_definition" "backend" {
  family                   = "cloud-apps-mern-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = local.ecs_task_execution_role_arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  tags = merge(local.common_tags, {
    Name     = "cloud-apps-mern-backend-task"
    Resource = "ecs-task-definition"
  })

  container_definitions = jsonencode([
    {
      name         = "backend"
      image        = var.ecr_repo_backend
      portMappings = [{ containerPort = 5000 }]
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "5000" },
        { name = "FRONTEND_URL", value = "https://app1.${local.domain_name}" },
        { name = "DYNAMO_TABLE_NAME", value = local.dynamodb_table_name },
        { name = "S3_BUCKET_NAME", value = local.s3_bucket_name },
        { name = "JWT_SECRET", value = "mern-cloud-apps-jwt-secret-2025-${random_id.jwt_secret.hex}" },
        { name = "AWS_REGION", value = "eu-west-2" }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/cloud-apps-mern-backend"
          "awslogs-region"        = "eu-west-2"
          "awslogs-stream-prefix" = "ecs"
        }
      }
      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:5000/api/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])
  
  # Critical: Force new task definition when image changes
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_ecs_service" "backend" {
  name            = "cloud-apps-mern-backend"
  cluster         = aws_ecs_cluster.mern.id
  task_definition = aws_ecs_task_definition.backend.arn
  launch_type     = "FARGATE"
  desired_count   = 1
  
  # Force new deployment when task definition changes (CRITICAL FIX)
  force_new_deployment = true
  
  # Health check grace period to prevent premature failures
  health_check_grace_period_seconds = 120
  
  network_configuration {
    subnets          = local.public_subnet_ids
    assign_public_ip = true
    security_groups  = [aws_security_group.mern_sg.id]
  }
  load_balancer {
    target_group_arn = local.backend_api_tg_arn
    container_name   = "backend"
    container_port   = 5000
  }
  
  # Ensure load balancer is ready before creating service
  depends_on = [aws_ecs_task_definition.backend]
}
