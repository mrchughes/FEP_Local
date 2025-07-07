#!/bin/bash

# Terraform State Reset Script
# This script removes all resources from Terraform state except Route53
# and then destroys the actual AWS resources, leaving only the Route53 zone

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${RED}========================================================================${NC}"
echo -e "${RED}                 TERRAFORM STATE RESET & CLEANUP                       ${NC}"
echo -e "${RED}========================================================================${NC}"

cd shared-infra/terraform

echo -e "${YELLOW}This script will:${NC}"
echo -e "${YELLOW}1. Backup current Terraform state${NC}"
echo -e "${YELLOW}2. Remove all resources from Terraform state${NC}"
echo -e "${YELLOW}3. Destroy remaining AWS resources${NC}"
echo -e "${YELLOW}4. Keep only Route53 zone and S3 state bucket${NC}"

read -p "Are you sure you want to proceed? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Operation cancelled."
    exit 1
fi

# Step 1: Backup state
echo -e "\n${BLUE}== Step 1: Backing up Terraform state ==${NC}"
cp terraform.tfstate terraform.tfstate.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || echo "No local state file"
aws s3 cp s3://cloud-apps-terraform-state-bucket/shared-infra/terraform.tfstate ./terraform.tfstate.s3.backup.$(date +%Y%m%d_%H%M%S) || echo "Could not backup S3 state"

# Step 2: Remove resources from state (except Route53)
echo -e "\n${BLUE}== Step 2: Removing resources from Terraform state ==${NC}"

# Let user choose which Route53 zone to keep
echo -e "\n${YELLOW}Current Route53 zone in state:${NC}"
if terraform state list | grep -q route53; then
    terraform state show module.route53.aws_route53_zone.main | grep -E "(id|name_servers)"
    CURRENT_ZONE=$(terraform state show module.route53.aws_route53_zone.main | grep "id.*=" | cut -d'"' -f2)
    echo "Current zone ID: $CURRENT_ZONE"
else
    echo "No Route53 zone in current state"
    CURRENT_ZONE=""
fi

echo -e "\n${YELLOW}Available zones for mrchughes.site:${NC}"
aws route53 list-hosted-zones --query "HostedZones[?Name==\`mrchughes.site.\`].[Id,Name]" --output table

read -p "Do you want to keep the current zone ($CURRENT_ZONE) or specify a different one? (keep/change): " -r choice

if [[ $choice == "change" ]]; then
    read -p "Enter the zone ID to keep (without /hostedzone/ prefix): " -r ZONE_TO_KEEP
    
    # Remove current Route53 from state
    if terraform state list | grep -q route53; then
        terraform state rm module.route53.aws_route53_zone.main
    fi
    
    # Import the correct zone
    terraform import module.route53.aws_route53_zone.main $ZONE_TO_KEEP
fi

# Remove all other resources from state
echo "Removing non-Route53 resources from state..."
terraform state list | grep -v route53 | while read resource; do
    echo "Removing $resource from state..."
    terraform state rm "$resource" || echo "Failed to remove $resource"
done

# Step 3: Destroy remaining resources
echo -e "\n${BLUE}== Step 3: Destroying AWS resources ==${NC}"

# Plan destruction to see what will be destroyed
echo "Planning destruction of remaining resources..."
terraform plan -destroy

read -p "Proceed with destroying these resources? (yes/no): " -r destroy_confirm
if [[ $destroy_confirm =~ ^[Yy][Ee][Ss]$ ]]; then
    terraform destroy -auto-approve
else
    echo "Skipping resource destruction."
fi

# Step 4: Clean up duplicate Route53 zones manually
echo -e "\n${BLUE}== Step 4: Cleaning up duplicate Route53 zones ==${NC}"

if [[ $choice == "change" ]]; then
    ZONE_TO_KEEP=$ZONE_TO_KEEP
else
    ZONE_TO_KEEP=$CURRENT_ZONE
fi

echo "Keeping zone: $ZONE_TO_KEEP"
echo "Listing all duplicate zones..."

ZONE_IDS=$(aws route53 list-hosted-zones --query "HostedZones[?Name==\`mrchughes.site.\`].Id" --output text)

for zone_id in $ZONE_IDS; do
    clean_zone_id=${zone_id#/hostedzone/}
    
    if [[ $clean_zone_id != $ZONE_TO_KEEP ]]; then
        echo "Found duplicate zone: $clean_zone_id"
        read -p "Delete duplicate zone $clean_zone_id? (y/n): " -r delete_zone
        
        if [[ $delete_zone =~ ^[Yy]$ ]]; then
            echo "Deleting zone $clean_zone_id..."
            aws route53 delete-hosted-zone --id $clean_zone_id || echo "Could not delete zone (may have dependencies)"
        fi
    fi
done

echo -e "\n${GREEN}== Cleanup Complete! ==${NC}"
echo -e "${GREEN}Preserved:${NC}"
echo -e "${GREEN}- Route53 zone: $ZONE_TO_KEEP${NC}"
echo -e "${GREEN}- S3 state bucket: cloud-apps-terraform-state-bucket${NC}"

echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "${YELLOW}1. Verify your domain's nameservers in Namecheap match the preserved zone${NC}"
echo -e "${YELLOW}2. Run 'terraform plan' to see what infrastructure will be created${NC}"
echo -e "${YELLOW}3. Run 'terraform apply' to recreate the infrastructure${NC}"

# Show final state
echo -e "\n${BLUE}Current Terraform state:${NC}"
terraform state list
