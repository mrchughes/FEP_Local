# Configure S3 backend for remote state
# Fixed import logic - check state before import - 2025-07-04
terraform {
  backend "s3" {
    bucket = "cloud-apps-terraform-state-bucket"
    key    = "shared-infra/terraform.tfstate"
    region = "eu-west-2"
  }
}

module "vpc" {
  source     = "./modules/vpc"
  aws_region = var.aws_region
  # Leave existing_vpc_id empty to create new VPC since we cleaned everything
  existing_vpc_id = ""
  common_tags     = local.common_tags
}
module "route53" {
  source      = "./modules/route53"
  domain_name = var.domain_name
  common_tags = local.common_tags
}
module "alb" {
  source            = "./modules/alb"
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
  domain_name       = var.domain_name
  zone_id           = module.route53.zone_id
  app1_subdomain    = var.app1_subdomain
  app2_subdomain    = var.app2_subdomain
  common_tags       = local.common_tags
}
module "ecr" {
  source      = "./modules/ecr"
  app1_repo   = "mern-app"
  app2_repo   = "python-app"
  common_tags = local.common_tags
}
module "iam" {
  source      = "./modules/iam"
  common_tags = local.common_tags
}
module "s3" {
  source      = "./modules/s3"
  common_tags = local.common_tags
}
module "dynamodb" {
  source      = "./modules/dynamodb"
  table_name  = local.dynamodb_table_name
  common_tags = local.common_tags
}
module "nacl" {
  source             = "./modules/nacl"
  vpc_id             = module.vpc.vpc_id
  public_subnet_ids  = module.vpc.public_subnet_ids
  private_subnet_ids = module.vpc.private_subnet_ids
  common_tags        = local.common_tags
}
# Force infrastructure deployment by updating timestamp
# Updated: Wed Jul  2 17:53:11 BST 2025
# Cleanup completed: Wed Jul  2 13:57:20 BST 2025
# VPC cleanup completed: Wed Jul  2 14:10:32 BST 2025
# Deployment triggered: Wed Jul  2 17:53:11 BST 2025
# Resources cleaned again: Wed Jul  2 14:19:01 BST 2025
