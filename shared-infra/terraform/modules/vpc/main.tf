variable "aws_region" {}
variable "existing_vpc_id" {
  description = "ID of existing VPC to use (leave empty to create new)"
  type        = string
  default     = ""
}
variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# Create new VPC if no existing one specified
resource "aws_vpc" "main" {
  count                = var.existing_vpc_id == "" ? 1 : 0
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(var.common_tags, {
    Name     = "cloud-apps-vpc"
    Resource = "vpc"
  })
}

# Use existing VPC if specified
data "aws_vpc" "existing" {
  count = var.existing_vpc_id != "" ? 1 : 0
  id    = var.existing_vpc_id
}

# Create subnets only if creating new VPC
resource "aws_subnet" "public_1" {
  count                   = var.existing_vpc_id == "" ? 1 : 0
  vpc_id                  = aws_vpc.main[0].id
  cidr_block              = "10.0.0.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = {
    Name    = "cloud-apps-public-subnet-1"
    Type    = "public"
    Project = "cloud-apps-bundle"
  }
}

resource "aws_subnet" "public_2" {
  count                   = var.existing_vpc_id == "" ? 1 : 0
  vpc_id                  = aws_vpc.main[0].id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.aws_region}b"
  map_public_ip_on_launch = true

  tags = {
    Name    = "cloud-apps-public-subnet-2"
    Type    = "public"
    Project = "cloud-apps-bundle"
  }
}

resource "aws_subnet" "private_1" {
  count             = var.existing_vpc_id == "" ? 1 : 0
  vpc_id            = aws_vpc.main[0].id
  cidr_block        = "10.0.10.0/24"
  availability_zone = "${var.aws_region}a"

  tags = {
    Name    = "cloud-apps-private-subnet-1"
    Type    = "private"
    Project = "cloud-apps-bundle"
  }
}

resource "aws_subnet" "private_2" {
  count             = var.existing_vpc_id == "" ? 1 : 0
  vpc_id            = aws_vpc.main[0].id
  cidr_block        = "10.0.11.0/24"
  availability_zone = "${var.aws_region}b"

  tags = {
    Name    = "cloud-apps-private-subnet-2"
    Type    = "private"
    Project = "cloud-apps-bundle"
  }
}

resource "aws_internet_gateway" "main" {
  count  = var.existing_vpc_id == "" ? 1 : 0
  vpc_id = aws_vpc.main[0].id

  tags = {
    Name    = "cloud-apps-igw"
    Project = "cloud-apps-bundle"
  }
}

resource "aws_route_table" "public" {
  count  = var.existing_vpc_id == "" ? 1 : 0
  vpc_id = aws_vpc.main[0].id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main[0].id
  }

  tags = {
    Name    = "cloud-apps-public-rt"
    Project = "cloud-apps-bundle"
  }
}

resource "aws_route_table_association" "public_1" {
  count          = var.existing_vpc_id == "" ? 1 : 0
  subnet_id      = aws_subnet.public_1[0].id
  route_table_id = aws_route_table.public[0].id
}

resource "aws_route_table_association" "public_2" {
  count          = var.existing_vpc_id == "" ? 1 : 0
  subnet_id      = aws_subnet.public_2[0].id
  route_table_id = aws_route_table.public[0].id
}

# Get existing subnets if using existing VPC
data "aws_subnets" "existing_all" {
  count = var.existing_vpc_id != "" ? 1 : 0
  filter {
    name   = "vpc-id"
    values = [var.existing_vpc_id]
  }
}

data "aws_subnet" "existing_all" {
  count = var.existing_vpc_id != "" ? length(data.aws_subnets.existing_all[0].ids) : 0
  id    = data.aws_subnets.existing_all[0].ids[count.index]
}

# Local values for filtering existing subnets
locals {
  # For existing VPC
  existing_public_subnets = var.existing_vpc_id != "" ? [
    for subnet in data.aws_subnet.existing_all : subnet
    if subnet.map_public_ip_on_launch
  ] : []

  existing_private_subnets = var.existing_vpc_id != "" ? [
    for subnet in data.aws_subnet.existing_all : subnet
    if !subnet.map_public_ip_on_launch
  ] : []

  # For new VPC
  new_public_subnet_ids = var.existing_vpc_id == "" ? [
    aws_subnet.public_1[0].id,
    aws_subnet.public_2[0].id
  ] : []

  new_private_subnet_ids = var.existing_vpc_id == "" ? [
    aws_subnet.private_1[0].id,
    aws_subnet.private_2[0].id
  ] : []

  # Final outputs - use existing or new
  vpc_id             = var.existing_vpc_id != "" ? var.existing_vpc_id : aws_vpc.main[0].id
  public_subnet_ids  = var.existing_vpc_id != "" ? [for s in local.existing_public_subnets : s.id] : local.new_public_subnet_ids
  private_subnet_ids = var.existing_vpc_id != "" ? [for s in local.existing_private_subnets : s.id] : local.new_private_subnet_ids
}

output "vpc_id" {
  value = local.vpc_id
}

output "public_subnet_ids" {
  value = local.public_subnet_ids
}

output "private_subnet_ids" {
  value = local.private_subnet_ids
}
