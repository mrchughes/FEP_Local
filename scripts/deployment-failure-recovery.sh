#!/bin/bash

# Deployment Failure Recovery Script
# Handles cleanup and recovery from failed Terraform deployments

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REGION="eu-west-2"
STATE_BUCKET="cloud-apps-terraform-state-bucket"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Recovery tracking
RECOVERY_ACTIONS=()
FAILED_ACTIONS=()

echo -e "${RED}🚨 DEPLOYMENT FAILURE RECOVERY${NC}"
echo -e "${RED}==============================${NC}"
echo "Date: $(date)"
echo "Region: $REGION"
echo ""

# Function to log recovery action
log_recovery() {
    local action="$1"
    local status="$2"
    local details="$3"
    
    if [[ "$status" == "SUCCESS" ]]; then
        RECOVERY_ACTIONS+=("✅ $action - $details")
        echo -e "${GREEN}✅ $action${NC} - $details"
    else
        FAILED_ACTIONS+=("❌ $action - $details")
        echo -e "${RED}❌ $action${NC} - $details"
    fi
}

# Function to backup current state
backup_terraform_state() {
    echo -e "\n${BLUE}💾 Backing up Terraform state files...${NC}"
    
    local backup_dir="$SCRIPT_DIR/state-backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    for component in "shared-infra" "mern-app" "python-app"; do
        local state_key="$component/terraform.tfstate"
        local backup_file="$backup_dir/${component}-terraform.tfstate"
        
        if aws s3 cp "s3://$STATE_BUCKET/$state_key" "$backup_file" 2>/dev/null; then
            log_recovery "State Backup" "SUCCESS" "$component state backed up to $backup_file"
        else
            log_recovery "State Backup" "FAILED" "Could not backup $component state"
        fi
    done
}

# Function to detect stuck resources
detect_stuck_resources() {
    echo -e "\n${BLUE}🔍 Detecting stuck resources...${NC}"
    
    # Check for resources in CREATE_IN_PROGRESS state
    local stuck_stacks=$(aws cloudformation list-stacks --region $REGION --stack-status-filter CREATE_IN_PROGRESS UPDATE_IN_PROGRESS DELETE_IN_PROGRESS --query 'StackSummaries[].StackName' --output text 2>/dev/null || echo "")
    
    if [[ -n "$stuck_stacks" ]]; then
        for stack in $stuck_stacks; do
            log_recovery "Stuck Stack Detection" "SUCCESS" "Found stuck CloudFormation stack: $stack"
        done
    fi
    
    # Check for ECS services in pending state
    local ecs_clusters=$(aws ecs list-clusters --region $REGION --query 'clusterArns[]' --output text 2>/dev/null || echo "")
    for cluster_arn in $ecs_clusters; do
        local cluster_name=$(echo $cluster_arn | cut -d'/' -f2)
        local pending_services=$(aws ecs list-services --cluster "$cluster_name" --region $REGION --query 'serviceArns[]' --output text 2>/dev/null || echo "")
        
        for service_arn in $pending_services; do
            local service_name=$(echo $service_arn | cut -d'/' -f3)
            local service_status=$(aws ecs describe-services --cluster "$cluster_name" --services "$service_name" --region $REGION --query 'services[0].status' --output text 2>/dev/null || echo "")
            
            if [[ "$service_status" == "PENDING" ]] || [[ "$service_status" == "DRAINING" ]]; then
                log_recovery "Stuck ECS Service" "SUCCESS" "Found stuck ECS service: $service_name in cluster $cluster_name"
            fi
        done
    done
}

# Function to force cleanup stuck resources
cleanup_stuck_resources() {
    echo -e "\n${BLUE}🧹 Cleaning up stuck resources...${NC}"
    
    # Force stop stuck ECS tasks
    local ecs_clusters=$(aws ecs list-clusters --region $REGION --query 'clusterArns[]' --output text 2>/dev/null || echo "")
    for cluster_arn in $ecs_clusters; do
        local cluster_name=$(echo $cluster_arn | cut -d'/' -f2)
        local running_tasks=$(aws ecs list-tasks --cluster "$cluster_name" --region $REGION --desired-status RUNNING --query 'taskArns[]' --output text 2>/dev/null || echo "")
        
        for task_arn in $running_tasks; do
            local task_id=$(echo $task_arn | cut -d'/' -f3)
            if aws ecs stop-task --cluster "$cluster_name" --task "$task_id" --region $REGION >/dev/null 2>&1; then
                log_recovery "ECS Task Cleanup" "SUCCESS" "Stopped stuck task: $task_id"
            else
                log_recovery "ECS Task Cleanup" "FAILED" "Could not stop task: $task_id"
            fi
        done
    done
    
    # Wait for tasks to stop
    sleep 30
    
    # Force delete stuck security groups
    local vpc_ids=$(aws ec2 describe-vpcs --region $REGION --query 'Vpcs[?IsDefault==`false`].VpcId' --output text 2>/dev/null || echo "")
    for vpc_id in $vpc_ids; do
        local sg_ids=$(aws ec2 describe-security-groups --region $REGION --filters "Name=vpc-id,Values=$vpc_id" --query 'SecurityGroups[?GroupName!=`default`].GroupId' --output text 2>/dev/null || echo "")
        
        for sg_id in $sg_ids; do
            # Remove all rules first
            local egress_rules=$(aws ec2 describe-security-groups --group-ids "$sg_id" --region $REGION --query 'SecurityGroups[0].IpPermissionsEgress' --output json 2>/dev/null || echo "[]")
            local ingress_rules=$(aws ec2 describe-security-groups --group-ids "$sg_id" --region $REGION --query 'SecurityGroups[0].IpPermissions' --output json 2>/dev/null || echo "[]")
            
            if [[ "$egress_rules" != "[]" ]] && [[ "$egress_rules" != "null" ]]; then
                if echo "$egress_rules" | aws ec2 revoke-security-group-egress --group-id "$sg_id" --ip-permissions file:///dev/stdin --region $REGION >/dev/null 2>&1; then
                    log_recovery "Security Group Rules" "SUCCESS" "Removed egress rules from $sg_id"
                fi
            fi
            
            if [[ "$ingress_rules" != "[]" ]] && [[ "$ingress_rules" != "null" ]]; then
                if echo "$ingress_rules" | aws ec2 revoke-security-group-ingress --group-id "$sg_id" --ip-permissions file:///dev/stdin --region $REGION >/dev/null 2>&1; then
                    log_recovery "Security Group Rules" "SUCCESS" "Removed ingress rules from $sg_id"
                fi
            fi
        done
    done
}

# Function to refresh Terraform state
refresh_terraform_state() {
    echo -e "\n${BLUE}🔄 Refreshing Terraform state...${NC}"
    
    for component in "shared-infra" "mern-app" "python-app"; do
        local terraform_dir="$REPO_ROOT/$component/terraform"
        
        if [[ -d "$terraform_dir" ]]; then
            cd "$terraform_dir"
            
            echo "Refreshing $component..."
            
            # Initialize Terraform
            if terraform init >/dev/null 2>&1; then
                log_recovery "Terraform Init" "SUCCESS" "$component initialized"
            else
                log_recovery "Terraform Init" "FAILED" "$component initialization failed"
                continue
            fi
            
            # Refresh state
            if terraform refresh -auto-approve >/dev/null 2>&1; then
                log_recovery "Terraform Refresh" "SUCCESS" "$component state refreshed"
            else
                log_recovery "Terraform Refresh" "FAILED" "$component state refresh failed"
            fi
            
            # Plan to check state
            if terraform plan -detailed-exitcode >/dev/null 2>&1; then
                local plan_exit_code=$?
                if [[ $plan_exit_code -eq 0 ]]; then
                    log_recovery "Terraform Plan" "SUCCESS" "$component - no changes needed"
                elif [[ $plan_exit_code -eq 2 ]]; then
                    log_recovery "Terraform Plan" "SUCCESS" "$component - changes detected"
                else
                    log_recovery "Terraform Plan" "FAILED" "$component - plan failed"
                fi
            fi
            
            cd - >/dev/null
        else
            log_recovery "Terraform Directory" "FAILED" "$terraform_dir not found"
        fi
    done
}

# Function to validate infrastructure consistency
validate_infrastructure() {
    echo -e "\n${BLUE}🔍 Validating infrastructure consistency...${NC}"
    
    # Run the existing validation scripts
    if [[ -f "$SCRIPT_DIR/validate-state-keys.sh" ]]; then
        if "$SCRIPT_DIR/validate-state-keys.sh" >/dev/null 2>&1; then
            log_recovery "State Key Validation" "SUCCESS" "All state keys are consistent"
        else
            log_recovery "State Key Validation" "FAILED" "State key mismatches detected"
        fi
    fi
    
    if [[ -f "$SCRIPT_DIR/validate-port-alignment.sh" ]]; then
        if "$SCRIPT_DIR/validate-port-alignment.sh" >/dev/null 2>&1; then
            log_recovery "Port Alignment Validation" "SUCCESS" "All ports are aligned"
        else
            log_recovery "Port Alignment Validation" "FAILED" "Port misalignments detected"
        fi
    fi
    
    if [[ -f "$SCRIPT_DIR/prevent-config-drift.sh" ]]; then
        if "$SCRIPT_DIR/prevent-config-drift.sh" shared-infra >/dev/null 2>&1; then
            log_recovery "Config Drift Validation" "SUCCESS" "No configuration drift detected"
        else
            log_recovery "Config Drift Validation" "FAILED" "Configuration drift detected"
        fi
    fi
}

# Function to attempt safe recovery
attempt_safe_recovery() {
    echo -e "\n${BLUE}🛠️  Attempting safe recovery...${NC}"
    
    # Try to apply shared infrastructure first
    local shared_infra_dir="$REPO_ROOT/shared-infra/terraform"
    if [[ -d "$shared_infra_dir" ]]; then
        cd "$shared_infra_dir"
        
        echo "Attempting shared infrastructure recovery..."
        if terraform apply -auto-approve >/dev/null 2>&1; then
            log_recovery "Shared Infrastructure Recovery" "SUCCESS" "Shared infrastructure deployed successfully"
        else
            log_recovery "Shared Infrastructure Recovery" "FAILED" "Shared infrastructure deployment failed"
        fi
        
        cd - >/dev/null
    fi
    
    # Wait for infrastructure to stabilize
    sleep 60
    
    # Try application deployments
    for app in "mern-app" "python-app"; do
        local app_dir="$REPO_ROOT/$app/terraform"
        if [[ -d "$app_dir" ]]; then
            cd "$app_dir"
            
            echo "Attempting $app recovery..."
            if terraform apply -auto-approve >/dev/null 2>&1; then
                log_recovery "$app Recovery" "SUCCESS" "$app deployed successfully"
            else
                log_recovery "$app Recovery" "FAILED" "$app deployment failed"
            fi
            
            cd - >/dev/null
        fi
    done
}

# Function to generate recovery report
generate_recovery_report() {
    echo -e "\n${BLUE}📊 RECOVERY REPORT${NC}"
    echo -e "${BLUE}=================${NC}"
    
    local total_actions=$((${#RECOVERY_ACTIONS[@]} + ${#FAILED_ACTIONS[@]}))
    local success_count=${#RECOVERY_ACTIONS[@]}
    local failure_count=${#FAILED_ACTIONS[@]}
    
    echo "Total recovery actions attempted: $total_actions"
    echo "Successful actions: $success_count"
    echo "Failed actions: $failure_count"
    echo ""
    
    if [[ $success_count -gt 0 ]]; then
        echo -e "${GREEN}✅ Successful Recovery Actions:${NC}"
        for action in "${RECOVERY_ACTIONS[@]}"; do
            echo "  $action"
        done
        echo ""
    fi
    
    if [[ $failure_count -gt 0 ]]; then
        echo -e "${RED}❌ Failed Recovery Actions:${NC}"
        for action in "${FAILED_ACTIONS[@]}"; do
            echo "  $action"
        done
        echo ""
    fi
    
    # Generate recovery report file
    local report_file="$SCRIPT_DIR/recovery-reports/recovery-$(date +%Y%m%d_%H%M%S).log"
    mkdir -p "$(dirname "$report_file")"
    
    {
        echo "DEPLOYMENT FAILURE RECOVERY REPORT"
        echo "Generated: $(date)"
        echo "Region: $REGION"
        echo ""
        echo "SUMMARY:"
        echo "Total actions: $total_actions"
        echo "Successful: $success_count"
        echo "Failed: $failure_count"
        echo ""
        echo "SUCCESSFUL ACTIONS:"
        for action in "${RECOVERY_ACTIONS[@]}"; do
            echo "$action"
        done
        echo ""
        echo "FAILED ACTIONS:"
        for action in "${FAILED_ACTIONS[@]}"; do
            echo "$action"
        done
    } > "$report_file"
    
    echo -e "${BLUE}📝 Recovery report saved to: $report_file${NC}"
    
    if [[ $failure_count -eq 0 ]]; then
        echo -e "\n${GREEN}🎉 RECOVERY COMPLETED SUCCESSFULLY!${NC}"
        return 0
    else
        echo -e "\n${YELLOW}⚠️  RECOVERY COMPLETED WITH ISSUES${NC}"
        return 1
    fi
}

# Function to show next steps
show_next_steps() {
    echo -e "\n${BLUE}📋 NEXT STEPS:${NC}"
    
    if [[ ${#FAILED_ACTIONS[@]} -eq 0 ]]; then
        echo "1. ✅ Recovery completed successfully"
        echo "2. 🔍 Run infrastructure validation: ./scripts/comprehensive-test.sh"
        echo "3. 🚀 Attempt normal deployment process"
        echo "4. 📊 Monitor deployment status: ./scripts/monitor-deployment.sh"
    else
        echo "1. 🔍 Review failed recovery actions above"
        echo "2. 🧹 Consider running orphaned resource detection: ./scripts/detect-orphaned-resources.sh"
        echo "3. 🆘 For critical failures, consider emergency cleanup: ./scripts/complete-infrastructure-cleanup.sh"
        echo "4. 📞 Escalate to infrastructure team if issues persist"
        echo "5. 📝 Document lessons learned for future deployments"
    fi
    
    echo ""
    echo -e "${YELLOW}💡 PREVENTION TIPS:${NC}"
    echo "- Always run pre-deployment validation scripts"
    echo "- Use deployment monitoring during critical changes"
    echo "- Keep Terraform state backups current"
    echo "- Test deployment rollback procedures regularly"
}

# Main recovery workflow
main() {
    echo -e "${YELLOW}⚠️  Starting deployment failure recovery...${NC}"
    echo ""
    
    # Ask for confirmation
    read -p "Continue with deployment failure recovery? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        echo "Recovery cancelled."
        exit 1
    fi
    
    echo ""
    
    # Execute recovery steps
    backup_terraform_state
    detect_stuck_resources
    cleanup_stuck_resources
    refresh_terraform_state
    validate_infrastructure
    attempt_safe_recovery
    
    # Generate report and show next steps
    generate_recovery_report
    RECOVERY_EXIT_CODE=$?
    show_next_steps
    
    exit $RECOVERY_EXIT_CODE
}

# Script usage information
if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
    echo "Deployment Failure Recovery Script"
    echo ""
    echo "This script helps recover from failed Terraform deployments by:"
    echo "1. Backing up current Terraform state"
    echo "2. Detecting stuck AWS resources"
    echo "3. Cleaning up stuck resources"
    echo "4. Refreshing Terraform state"
    echo "5. Validating infrastructure consistency"
    echo "6. Attempting safe recovery deployment"
    echo ""
    echo "Usage: $0 [--help]"
    echo ""
    echo "The script will prompt for confirmation before making changes."
    exit 0
fi

# Run main recovery workflow
main
