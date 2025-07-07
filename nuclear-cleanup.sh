#!/bin/bash

# Complete AWS Infrastructure Cleanup - Clean Slate Approach
# This will delete EVERYTHING and start fresh

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

REGION="eu-west-2"
DOMAIN="mrchughes.site"
STATE_BUCKET="cloud-apps-terraform-state-bucket"

echo -e "${RED}========================================================================${NC}"
echo -e "${RED}             COMPLETE INFRASTRUCTURE CLEANUP - CLEAN SLATE             ${NC}"
echo -e "${RED}                     ⚠️  NUCLEAR OPTION ⚠️                           ${NC}"
echo -e "${RED}========================================================================${NC}"

echo -e "${YELLOW}This script will DELETE EVERYTHING:${NC}"
echo -e "${YELLOW}✗ All Route53 hosted zones for $DOMAIN${NC}"
echo -e "${YELLOW}✗ All VPCs and networking${NC}"
echo -e "${YELLOW}✗ All Load Balancers${NC}"
echo -e "${YELLOW}✗ All ECR repositories${NC}"
echo -e "${YELLOW}✗ All S3 buckets (except state bucket)${NC}"
echo -e "${YELLOW}✗ All DynamoDB tables${NC}"
echo -e "${YELLOW}✗ All ACM certificates${NC}"
echo -e "${YELLOW}✗ All ECS clusters and services${NC}"
echo -e "${YELLOW}✗ Complete Terraform state reset${NC}"

echo -e "\n${GREEN}What will be preserved:${NC}"
echo -e "${GREEN}✓ S3 state bucket: $STATE_BUCKET${NC}"
echo -e "${GREEN}✓ IAM roles needed for GitHub Actions${NC}"

read -p "Are you absolutely sure you want to delete EVERYTHING? (type 'DELETE-EVERYTHING'): " -r
if [[ $REPLY != "DELETE-EVERYTHING" ]]; then
    echo "Cleanup cancelled."
    exit 1
fi

echo -e "\n${BLUE}== Step 1: Backup Terraform state ==${NC}"
cp terraform.tfstate terraform.tfstate.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || echo "No local state file"
aws s3 cp s3://${STATE_BUCKET}/shared-infra/terraform.tfstate ./terraform.tfstate.s3.backup.$(date +%Y%m%d_%H%M%S) || echo "Could not backup S3 state"

echo -e "\n${BLUE}== Step 2: Clear Terraform state completely ==${NC}"
terraform state list | while read resource; do
    echo "Removing $resource from state..."
    terraform state rm "$resource" || echo "Failed to remove $resource"
done

echo -e "\n${BLUE}== Step 3: Delete all Route53 hosted zones for $DOMAIN ==${NC}"
ZONE_IDS=$(aws route53 list-hosted-zones --query "HostedZones[?Name==\`${DOMAIN}.\`].Id" --output text)

for zone_id in $ZONE_IDS; do
    clean_zone_id=${zone_id#/hostedzone/}
    echo "Processing zone: $clean_zone_id"
    
    # Get all records except NS and SOA
    RECORDS=$(aws route53 list-resource-record-sets --hosted-zone-id $clean_zone_id --query 'ResourceRecordSets[?Type!=`NS` && Type!=`SOA`]')
    
    if [[ $RECORDS != "[]" ]]; then
        echo "Deleting DNS records in zone $clean_zone_id..."
        
        # Create change batch to delete all records
        echo "$RECORDS" | jq -r '.[] | @base64' | while read record; do
            decoded_record=$(echo "$record" | base64 -d)
            record_name=$(echo "$decoded_record" | jq -r '.Name')
            record_type=$(echo "$decoded_record" | jq -r '.Type')
            
            if [[ $record_type != "NS" && $record_type != "SOA" ]]; then
                echo "Deleting $record_type record: $record_name"
                
                # Create change batch
                change_batch=$(cat <<EOF
{
    "Changes": [{
        "Action": "DELETE",
        "ResourceRecordSet": $decoded_record
    }]
}
EOF
)
                
                aws route53 change-resource-record-sets --hosted-zone-id $clean_zone_id --change-batch "$change_batch" || echo "Failed to delete record $record_name"
            fi
        done
        
        # Wait for changes to propagate
        sleep 10
    fi
    
    echo "Deleting hosted zone: $clean_zone_id"
    aws route53 delete-hosted-zone --id $clean_zone_id || echo "Could not delete zone $clean_zone_id"
done

echo -e "\n${BLUE}== Step 4: Delete all Load Balancers ==${NC}"
ALB_ARNS=$(aws elbv2 describe-load-balancers --region $REGION --query 'LoadBalancers[].LoadBalancerArn' --output text)
for alb_arn in $ALB_ARNS; do
    echo "Deleting ALB: $alb_arn"
    aws elbv2 delete-load-balancer --load-balancer-arn $alb_arn --region $REGION || true
done

# Delete Target Groups
TG_ARNS=$(aws elbv2 describe-target-groups --region $REGION --query 'TargetGroups[].TargetGroupArn' --output text)
for tg_arn in $TG_ARNS; do
    echo "Deleting Target Group: $tg_arn"
    aws elbv2 delete-target-group --target-group-arn $tg_arn --region $REGION || true
done

echo -e "\n${BLUE}== Step 5: Delete all ACM certificates ==${NC}"
CERT_ARNS=$(aws acm list-certificates --region $REGION --query 'CertificateSummaryList[].CertificateArn' --output text)
for cert_arn in $CERT_ARNS; do
    echo "Deleting ACM certificate: $cert_arn"
    aws acm delete-certificate --certificate-arn $cert_arn --region $REGION || true
done

echo -e "\n${BLUE}== Step 6: Delete all ECS clusters and services ==${NC}"
ECS_CLUSTERS=$(aws ecs list-clusters --region $REGION --query 'clusterArns[]' --output text)
for cluster_arn in $ECS_CLUSTERS; do
    cluster_name=$(basename $cluster_arn)
    echo "Processing ECS cluster: $cluster_name"
    
    # Get all services in the cluster
    ECS_SERVICES=$(aws ecs list-services --cluster $cluster_name --region $REGION --query 'serviceArns[]' --output text)
    for service_arn in $ECS_SERVICES; do
        service_name=$(basename $service_arn)
        echo "Deleting ECS service: $service_name"
        aws ecs update-service --cluster $cluster_name --service $service_name --desired-count 0 --region $REGION || true
        aws ecs delete-service --cluster $cluster_name --service $service_name --region $REGION || true
    done
    
    echo "Deleting ECS cluster: $cluster_name"
    aws ecs delete-cluster --cluster $cluster_name --region $REGION || true
done

echo -e "\n${BLUE}== Step 7: Delete all ECR repositories ==${NC}"
ECR_REPOS=$(aws ecr describe-repositories --region $REGION --query 'repositories[].repositoryName' --output text)
for repo in $ECR_REPOS; do
    echo "Deleting ECR repository: $repo"
    aws ecr delete-repository --repository-name $repo --force --region $REGION || true
done

echo -e "\n${BLUE}== Step 8: Delete all S3 buckets (except state bucket) ==${NC}"
S3_BUCKETS=$(aws s3api list-buckets --query "Buckets[?Name!=\`${STATE_BUCKET}\`].Name" --output text)
for bucket in $S3_BUCKETS; do
    if [[ $bucket == *"cloud-apps"* ]] || [[ $bucket == *"mrchughes"* ]]; then
        echo "Deleting S3 bucket: $bucket"
        aws s3 rm s3://$bucket --recursive || true
        aws s3api delete-bucket --bucket $bucket || true
    fi
done

echo -e "\n${BLUE}== Step 9: Delete all DynamoDB tables ==${NC}"
DDB_TABLES=$(aws dynamodb list-tables --region $REGION --query 'TableNames[]' --output text)
for table in $DDB_TABLES; do
    if [[ $table == *"cloud-apps"* ]] || [[ $table == *"app"* ]]; then
        echo "Deleting DynamoDB table: $table"
        aws dynamodb delete-table --table-name $table --region $REGION || true
    fi
done

echo -e "\n${BLUE}== Step 10: Delete all VPCs and networking ==${NC}"
# Wait for ALBs to be deleted first
sleep 60

VPC_IDS=$(aws ec2 describe-vpcs --region $REGION --query 'Vpcs[?IsDefault==`false`].VpcId' --output text)

for vpc_id in $VPC_IDS; do
    echo "Cleaning up VPC: $vpc_id"
    
    # Delete NAT Gateways
    NAT_IDS=$(aws ec2 describe-nat-gateways --region $REGION --filter "Name=vpc-id,Values=$vpc_id" --query 'NatGateways[?State==`available`].NatGatewayId' --output text)
    for nat_id in $NAT_IDS; do
        echo "Deleting NAT Gateway: $nat_id"
        aws ec2 delete-nat-gateway --nat-gateway-id $nat_id --region $REGION || true
    done
    
    # Wait for NAT gateways to be deleted
    sleep 30
    
    # Delete Internet Gateways
    IGW_IDS=$(aws ec2 describe-internet-gateways --region $REGION --filters "Name=attachment.vpc-id,Values=$vpc_id" --query 'InternetGateways[].InternetGatewayId' --output text)
    for igw_id in $IGW_IDS; do
        echo "Detaching and deleting Internet Gateway: $igw_id"
        aws ec2 detach-internet-gateway --internet-gateway-id $igw_id --vpc-id $vpc_id --region $REGION || true
        aws ec2 delete-internet-gateway --internet-gateway-id $igw_id --region $REGION || true
    done
    
    # Delete Subnets
    SUBNET_IDS=$(aws ec2 describe-subnets --region $REGION --filters "Name=vpc-id,Values=$vpc_id" --query 'Subnets[].SubnetId' --output text)
    for subnet_id in $SUBNET_IDS; do
        echo "Deleting subnet: $subnet_id"
        aws ec2 delete-subnet --subnet-id $subnet_id --region $REGION || true
    done
    
    # Delete Route Tables (except main)
    RT_IDS=$(aws ec2 describe-route-tables --region $REGION --filters "Name=vpc-id,Values=$vpc_id" --query 'RouteTables[?Associations[0].Main!=`true`].RouteTableId' --output text)
    for rt_id in $RT_IDS; do
        echo "Deleting route table: $rt_id"
        aws ec2 delete-route-table --route-table-id $rt_id --region $REGION || true
    done
    
    # Delete Security Groups (except default)
    SG_IDS=$(aws ec2 describe-security-groups --region $REGION --filters "Name=vpc-id,Values=$vpc_id" --query 'SecurityGroups[?GroupName!=`default`].GroupId' --output text)
    for sg_id in $SG_IDS; do
        echo "Deleting security group: $sg_id"
        aws ec2 delete-security-group --group-id $sg_id --region $REGION || true
    done
    
    # Delete Network ACLs (except default)
    NACL_IDS=$(aws ec2 describe-network-acls --region $REGION --filters "Name=vpc-id,Values=$vpc_id" --query 'NetworkAcls[?IsDefault!=`true`].NetworkAclId' --output text)
    for nacl_id in $NACL_IDS; do
        echo "Deleting Network ACL: $nacl_id"
        aws ec2 delete-network-acl --network-acl-id $nacl_id --region $REGION || true
    done
    
    # Finally delete the VPC
    echo "Deleting VPC: $vpc_id"
    aws ec2 delete-vpc --vpc-id $vpc_id --region $REGION || true
done

# Upload empty state to S3
echo -e "\n${BLUE}== Step 11: Reset Terraform state in S3 ==${NC}"
echo '{"version": 4, "terraform_version": "1.0.0", "serial": 1, "lineage": "", "outputs": {}, "resources": []}' > empty_state.json
aws s3 cp empty_state.json s3://${STATE_BUCKET}/shared-infra/terraform.tfstate
rm empty_state.json

echo -e "\n${GREEN}========================================================================${NC}"
echo -e "${GREEN}                         CLEANUP COMPLETE!                             ${NC}"
echo -e "${GREEN}========================================================================${NC}"

echo -e "\n${GREEN}✓ All AWS resources deleted${NC}"
echo -e "${GREEN}✓ Terraform state reset${NC}"
echo -e "${GREEN}✓ Ready for fresh deployment${NC}"

echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "${YELLOW}1. Run 'terraform init' to reinitialize${NC}"
echo -e "${YELLOW}2. Run 'terraform plan' to see fresh infrastructure${NC}"
echo -e "${YELLOW}3. Run 'terraform apply' to create everything new${NC}"
echo -e "${YELLOW}4. Update Namecheap with new Route53 nameservers${NC}"

echo -e "\n${BLUE}Backup files created:${NC}"
ls -la terraform.tfstate.backup.* terraform.tfstate.s3.backup.* 2>/dev/null || echo "No backup files"
