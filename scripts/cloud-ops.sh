#!/bin/bash

# Cloud Apps Bundle - Quick Operations Script
# Usage: ./scripts/cloud-ops.sh [command]

set -e

# Configuration
AWS_REGION="eu-west-2"
ECR_REGISTRY="357402308721.dkr.ecr.eu-west-2.amazonaws.com"
CLUSTER_NAME="cloud-apps-mern-cluster"
DOMAIN="app1.mrchughes.site"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI not found. Please install it first."
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker not found. Please install it first."
        exit 1
    fi
    
    # Check Terraform
    if ! command -v terraform &> /dev/null; then
        log_error "Terraform not found. Please install it first."
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured or invalid."
        exit 1
    fi
    
    log_success "All prerequisites met!"
}

# Deploy shared infrastructure
deploy_shared_infra() {
    log_info "Deploying shared infrastructure..."
    cd shared-infra/terraform
    
    terraform init
    terraform validate
    terraform plan -out=tfplan
    terraform apply tfplan
    
    log_success "Shared infrastructure deployed!"
    cd ../../
}

# Build and push Docker images
build_and_push_images() {
    log_info "Building and pushing Docker images..."
    
    # Login to ECR
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY
    
    # Build frontend
    log_info "Building frontend image..."
    cd mern-app/frontend
    docker build --platform linux/amd64 -t $ECR_REGISTRY/mern-app-frontend:latest .
    docker push $ECR_REGISTRY/mern-app-frontend:latest
    cd ../../
    
    # Build backend
    log_info "Building backend image..."
    cd mern-app/backend
    docker build --platform linux/amd64 -t $ECR_REGISTRY/mern-app-backend:latest .
    docker push $ECR_REGISTRY/mern-app-backend:latest
    cd ../../
    
    log_success "Docker images built and pushed!"
}

# Deploy MERN app infrastructure
deploy_mern_app() {
    log_info "Deploying MERN app infrastructure..."
    cd mern-app/terraform
    
    terraform init
    terraform validate
    terraform plan \
        -var="ecr_repo_backend=$ECR_REGISTRY/mern-app-backend:latest" \
        -var="ecr_repo_frontend=$ECR_REGISTRY/mern-app-frontend:latest" \
        -out=tfplan
    terraform apply tfplan
    
    log_success "MERN app infrastructure deployed!"
    cd ../../
}

# Full deployment
full_deploy() {
    log_info "Starting full deployment..."
    check_prerequisites
    deploy_shared_infra
    build_and_push_images
    deploy_mern_app
    health_check
    log_success "Full deployment completed!"
}

# Health check
health_check() {
    log_info "Running health checks..."
    
    # Check ECS services
    log_info "Checking ECS services..."
    aws ecs describe-services \
        --cluster $CLUSTER_NAME \
        --services cloud-apps-mern-backend cloud-apps-mern-frontend \
        --query 'services[*].{Name:serviceName,Status:status,Running:runningCount,Desired:desiredCount}' \
        --output table
    
    # Get ALB DNS
    cd shared-infra/terraform
    ALB_DNS=$(terraform output -raw alb_dns_name)
    cd ../../
    
    # Test endpoints
    log_info "Testing application endpoints..."
    
    if curl -f -k -H "Host: $DOMAIN" https://$ALB_DNS/ > /dev/null 2>&1; then
        log_success "Frontend is responding!"
    else
        log_error "Frontend is not responding!"
    fi
    
    if curl -f -k -H "Host: $DOMAIN" https://$ALB_DNS/api/ > /dev/null 2>&1; then
        log_success "Backend API is responding!"
    else
        log_error "Backend API is not responding!"
    fi
}

# Scale down services (cost optimization)
scale_down() {
    log_info "Scaling down ECS services..."
    
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service cloud-apps-mern-backend \
        --desired-count 0
    
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service cloud-apps-mern-frontend \
        --desired-count 0
    
    log_success "Services scaled down to save costs!"
}

# Scale up services
scale_up() {
    log_info "Scaling up ECS services..."
    
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service cloud-apps-mern-backend \
        --desired-count 1
    
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service cloud-apps-mern-frontend \
        --desired-count 1
    
    log_success "Services scaled up!"
}

# Complete teardown
teardown() {
    log_warning "This will destroy ALL infrastructure. Are you sure? (y/N)"
    read -r confirmation
    
    if [[ $confirmation =~ ^[Yy]$ ]]; then
        log_info "Destroying MERN app infrastructure..."
        cd mern-app/terraform
        terraform destroy -auto-approve
        cd ../../
        
        log_info "Destroying shared infrastructure..."
        cd shared-infra/terraform
        terraform destroy -auto-approve
        cd ../../
        
        log_success "Complete teardown completed!"
    else
        log_info "Teardown cancelled."
    fi
}

# View logs
view_logs() {
    log_info "Fetching recent application logs..."
    
    # Get log groups
    aws logs describe-log-groups --log-group-name-prefix "/ecs/cloud-apps-mern" --query 'logGroups[*].logGroupName' --output text | while read -r log_group; do
        if [ -n "$log_group" ]; then
            log_info "Logs from $log_group:"
            aws logs tail "$log_group" --since 1h --follow=false
        fi
    done
}

# Get status
status() {
    log_info "Current deployment status:"
    
    # ECS cluster status
    aws ecs describe-clusters --clusters $CLUSTER_NAME --query 'clusters[0].{Name:clusterName,Status:status,ActiveServices:activeServicesCount,RunningTasks:runningTasksCount}' --output table
    
    # Services status
    aws ecs describe-services \
        --cluster $CLUSTER_NAME \
        --services cloud-apps-mern-backend cloud-apps-mern-frontend \
        --query 'services[*].{Name:serviceName,Status:status,Running:runningCount,Desired:desiredCount}' \
        --output table
    
    # ALB status
    aws elbv2 describe-load-balancers --names cloud-apps-alb --query 'LoadBalancers[0].{DNSName:DNSName,State:State.Code}' --output table
}

# Show help
show_help() {
    echo "Cloud Apps Bundle Operations Script"
    echo
    echo "Usage: $0 [command]"
    echo
    echo "Commands:"
    echo "  check              Check prerequisites"
    echo "  deploy-shared      Deploy shared infrastructure only"
    echo "  build-images       Build and push Docker images only"
    echo "  deploy-app         Deploy MERN app infrastructure only"
    echo "  deploy             Full deployment (shared + app + images)"
    echo "  health             Run health checks"
    echo "  scale-down         Scale services to 0 (cost optimization)"
    echo "  scale-up           Scale services back up"
    echo "  teardown           Destroy all infrastructure"
    echo "  logs               View recent application logs"
    echo "  status             Show current deployment status"
    echo "  help               Show this help message"
    echo
    echo "Examples:"
    echo "  $0 deploy          # Full deployment"
    echo "  $0 health          # Check if everything is running"
    echo "  $0 scale-down      # Save costs when not using"
    echo "  $0 scale-up        # Restart after scaling down"
}

# Main script logic
case "${1:-help}" in
    check)
        check_prerequisites
        ;;
    deploy-shared)
        check_prerequisites
        deploy_shared_infra
        ;;
    build-images)
        check_prerequisites
        build_and_push_images
        ;;
    deploy-app)
        check_prerequisites
        deploy_mern_app
        ;;
    deploy)
        full_deploy
        ;;
    health)
        health_check
        ;;
    scale-down)
        scale_down
        ;;
    scale-up)
        scale_up
        ;;
    teardown)
        teardown
        ;;
    logs)
        view_logs
        ;;
    status)
        status
        ;;
    help)
        show_help
        ;;
    *)
        log_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
