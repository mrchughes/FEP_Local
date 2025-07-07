#!/bin/bash

# Force VPC Deletion Script
# This script aggressively removes all dependencies and then deletes VPCs

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${RED}🔥 FORCE VPC DELETION SCRIPT${NC}"
echo "============================="

# VPCs to delete (region:vpc_ids)
US_EAST_1_VPCS="vpc-0388bb638273b59e2 vpc-0cfc9bf9d796a4aad"
US_WEST_2_VPCS="vpc-0964be682c2590ba7"

force_delete_vpc() {
    local region=$1
    local vpc_id=$2
    
    echo -e "\n${BLUE}🔥 Force deleting VPC: $vpc_id in $region${NC}"
    
    # 1. Delete all EC2 instances in the VPC
    echo "  Checking for EC2 instances..."
    INSTANCES=$(aws ec2 describe-instances --region $region --filters "Name=vpc-id,Values=$vpc_id" --query 'Reservations[].Instances[?State.Name!=`terminated`].InstanceId' --output text 2>/dev/null || echo "")
    if [ -n "$INSTANCES" ] && [ "$INSTANCES" != "None" ]; then
        echo "    Terminating instances: $INSTANCES"
        aws ec2 terminate-instances --instance-ids $INSTANCES --region $region >/dev/null 2>&1 || true
        echo "    Waiting for instances to terminate..."
        aws ec2 wait instance-terminated --instance-ids $INSTANCES --region $region >/dev/null 2>&1 || true
    fi
    
    # 2. Delete all ENIs (Elastic Network Interfaces)
    echo "  Deleting network interfaces..."
    ENI_IDS=$(aws ec2 describe-network-interfaces --region $region --filters "Name=vpc-id,Values=$vpc_id" --query 'NetworkInterfaces[].NetworkInterfaceId' --output text 2>/dev/null || echo "")
    if [ -n "$ENI_IDS" ] && [ "$ENI_IDS" != "None" ]; then
        for eni_id in $ENI_IDS; do
            echo "    Deleting ENI: $eni_id"
            aws ec2 delete-network-interface --network-interface-id $eni_id --region $region >/dev/null 2>&1 || true
        done
    fi
    
    # 3. Delete VPC Endpoints
    echo "  Deleting VPC endpoints..."
    VPC_ENDPOINTS=$(aws ec2 describe-vpc-endpoints --region $region --filters "Name=vpc-id,Values=$vpc_id" --query 'VpcEndpoints[].VpcEndpointId' --output text 2>/dev/null || echo "")
    if [ -n "$VPC_ENDPOINTS" ] && [ "$VPC_ENDPOINTS" != "None" ]; then
        for endpoint_id in $VPC_ENDPOINTS; do
            echo "    Deleting VPC endpoint: $endpoint_id"
            aws ec2 delete-vpc-endpoint --vpc-endpoint-id $endpoint_id --region $region >/dev/null 2>&1 || true
        done
    fi
    
    # 4. Delete VPN Gateways
    echo "  Checking VPN gateways..."
    VPN_GWS=$(aws ec2 describe-vpn-gateways --region $region --filters "Name=attachment.vpc-id,Values=$vpc_id" --query 'VpnGateways[].VpnGatewayId' --output text 2>/dev/null || echo "")
    if [ -n "$VPN_GWS" ] && [ "$VPN_GWS" != "None" ]; then
        for vpn_gw in $VPN_GWS; do
            echo "    Detaching VPN gateway: $vpn_gw"
            aws ec2 detach-vpn-gateway --vpn-gateway-id $vpn_gw --vpc-id $vpc_id --region $region >/dev/null 2>&1 || true
        done
    fi
    
    # 5. Delete Customer Gateways (if any)
    echo "  Checking customer gateways..."
    CGW_IDS=$(aws ec2 describe-customer-gateways --region $region --filters "Name=state,Values=available" --query 'CustomerGateways[].CustomerGatewayId' --output text 2>/dev/null || echo "")
    if [ -n "$CGW_IDS" ] && [ "$CGW_IDS" != "None" ]; then
        for cgw_id in $CGW_IDS; do
            echo "    Deleting customer gateway: $cgw_id"
            aws ec2 delete-customer-gateway --customer-gateway-id $cgw_id --region $region >/dev/null 2>&1 || true
        done
    fi
    
    # 6. Wait a bit for AWS to process
    echo "  Waiting 30 seconds for AWS to process deletions..."
    sleep 30
    
    # 7. Try to delete the VPC
    echo "  Attempting VPC deletion..."
    if aws ec2 delete-vpc --vpc-id $vpc_id --region $region >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓ VPC $vpc_id deleted successfully${NC}"
    else
        echo -e "  ${YELLOW}⚠ VPC $vpc_id still has dependencies${NC}"
        
        # List remaining dependencies
        echo "    Remaining dependencies:"
        aws ec2 describe-subnets --region $region --filters "Name=vpc-id,Values=$vpc_id" --query 'Subnets[].SubnetId' --output text 2>/dev/null | while read subnet; do
            if [ -n "$subnet" ] && [ "$subnet" != "None" ]; then
                echo "      Subnet: $subnet"
            fi
        done
        
        aws ec2 describe-security-groups --region $region --filters "Name=vpc-id,Values=$vpc_id" --query 'SecurityGroups[?GroupName!=`default`].GroupId' --output text 2>/dev/null | while read sg; do
            if [ -n "$sg" ] && [ "$sg" != "None" ]; then
                echo "      Security Group: $sg"
            fi
        done
    fi
}

# Process each region
echo -e "\n${BLUE}Processing us-east-1${NC}"
for vpc_id in $US_EAST_1_VPCS; do
    force_delete_vpc "us-east-1" $vpc_id
done

echo -e "\n${BLUE}Processing us-west-2${NC}"
for vpc_id in $US_WEST_2_VPCS; do
    force_delete_vpc "us-west-2" $vpc_id
done

echo -e "\n${GREEN}🎉 Force VPC deletion script complete${NC}"
echo -e "${YELLOW}💡 If VPCs still exist, they may be managed by active Terraform state${NC}"
