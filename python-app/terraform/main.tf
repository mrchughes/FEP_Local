# Configure S3 backend for remote state
# Clean deployment with validation fixes and full protection suite
terraform {
  backend "s3" {
    bucket = "cloud-apps-terraform-state-bucket"
    key    = "python-app/terraform.tfstate"
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
  ecs_task_execution_role_arn = data.terraform_remote_state.shared_infra.outputs.ecs_task_execution_role_arn
  app2_tg_arn                 = data.terraform_remote_state.shared_infra.outputs.app2_tg_arn
  s3_bucket_name              = data.terraform_remote_state.shared_infra.outputs.s3_bucket_name
  dynamodb_table_name         = data.terraform_remote_state.shared_infra.outputs.dynamodb_table_name
  domain_name                 = data.terraform_remote_state.shared_infra.outputs.domain_name

  # Deployment tracking
  deployment_id = var.deployment_id != "" ? var.deployment_id : "${formatdate("YYYY-MM-DD-hhmm", timestamp())}"

  # Common tags for Python app resources
  common_tags = {
    Project             = "cloud-apps-bundle"
    Component           = "python-app"
    Environment         = "production"
    ManagedBy           = "terraform"
    DeploymentId        = local.deployment_id
    DeploymentSource    = var.deployment_source
    DeploymentTimestamp = timestamp()
  }
}

resource "aws_ecs_cluster" "python" {
  name = "cloud-apps-python-cluster"

  tags = merge(local.common_tags, {
    Name     = "cloud-apps-python-cluster"
    Resource = "ecs-cluster"
  })
}

resource "aws_security_group" "python_sg" {
  name        = "cloud-apps-python-ecs-sg"
  vpc_id      = local.vpc_id
  description = "Security group for Python app ECS tasks"

  tags = merge(local.common_tags, {
    Name     = "cloud-apps-python-ecs-sg"
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
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_ecs_task_definition" "python_app" {
  family                   = "python-app"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = local.ecs_task_execution_role_arn
  container_definitions = jsonencode([
    {
      name         = "python-app"
      image        = var.ecr_repo_app2
      portMappings = [{ containerPort = 80 }]
      environment = [
        { name = "FLASK_ENV", value = "production" },
        { name = "S3_BUCKET", value = local.s3_bucket_name },
        { name = "DYNAMODB_TABLE", value = local.dynamodb_table_name }
      ]
    }
  ])
}

resource "aws_ecs_service" "python_app" {
  name            = "python-app"
  cluster         = aws_ecs_cluster.python.id
  task_definition = aws_ecs_task_definition.python_app.arn
  launch_type     = "FARGATE"
  desired_count   = 1
  network_configuration {
    subnets          = local.public_subnet_ids
    assign_public_ip = true
    security_groups  = [aws_security_group.python_sg.id]
  }
  load_balancer {
    target_group_arn = local.app2_tg_arn
    container_name   = "python-app"
    container_port   = 5000
  }
}
