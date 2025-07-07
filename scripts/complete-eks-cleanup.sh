#!/bin/bash

# Complete EKS and VPC cleanup script
# This script waits for EKS node group deletion and then cleans up the cluster and VPC

echo "🧹 COMPLETE EKS CLEANUP"
echo "======================="
echo "Waiting for EKS node group deletion to complete..."

REGION="us-west-2"
CLUSTER_NAME="my-clean-arch-cluster"
NODEGROUP_NAME="standard-workers"

# Wait for node group deletion
while true; do
    STATUS=$(aws eks describe-nodegroup --cluster-name "$CLUSTER_NAME" --nodegroup-name "$NODEGROUP_NAME" --region "$REGION" --query 'nodegroup.status' --output text 2>/dev/null)
    
    if [ $? -ne 0 ]; then
        echo "✅ Node group deleted successfully"
        break
    fi
    
    echo "⏳ Node group status: $STATUS - waiting..."
    sleep 30
done

# Delete the EKS cluster
echo "🗑️ Deleting EKS cluster: $CLUSTER_NAME"
aws eks delete-cluster --name "$CLUSTER_NAME" --region "$REGION"

# Wait for cluster deletion
echo "⏳ Waiting for cluster deletion..."
while true; do
    STATUS=$(aws eks describe-cluster --name "$CLUSTER_NAME" --region "$REGION" --query 'cluster.status' --output text 2>/dev/null)
    
    if [ $? -ne 0 ]; then
        echo "✅ EKS cluster deleted successfully"
        break
    fi
    
    echo "⏳ Cluster status: $STATUS - waiting..."
    sleep 30
done

# Get the VPC ID
VPC_ID=$(aws ec2 describe-vpcs --region "$REGION" --filters "Name=tag:Name,Values=eksctl-$CLUSTER_NAME-cluster/VPC" --query 'Vpcs[0].VpcId' --output text 2>/dev/null)

if [ "$VPC_ID" != "None" ] && [ "$VPC_ID" != "" ]; then
    echo "🗑️ Cleaning up VPC: $VPC_ID"
    
    # Delete NAT gateways
    echo "🔌 Deleting NAT gateways..."
    NAT_GATEWAYS=$(aws ec2 describe-nat-gateways --region "$REGION" --filter "Name=vpc-id,Values=$VPC_ID" --query 'NatGateways[?State==`available`].NatGatewayId' --output text)
    for nat_gw in $NAT_GATEWAYS; do
        echo "  Deleting NAT gateway: $nat_gw"
        aws ec2 delete-nat-gateway --nat-gateway-id "$nat_gw" --region "$REGION"
    done
    
    # Delete internet gateways
    echo "🌐 Detaching and deleting internet gateways..."
    IGW_IDS=$(aws ec2 describe-internet-gateways --region "$REGION" --filters "Name=attachment.vpc-id,Values=$VPC_ID" --query 'InternetGateways[].InternetGatewayId' --output text)
    for igw in $IGW_IDS; do
        echo "  Detaching IGW: $igw"
        aws ec2 detach-internet-gateway --internet-gateway-id "$igw" --vpc-id "$VPC_ID" --region "$REGION"
        echo "  Deleting IGW: $igw"
        aws ec2 delete-internet-gateway --internet-gateway-id "$igw" --region "$REGION"
    done
    
    # Delete subnets
    echo "🕸️ Deleting subnets..."
    SUBNET_IDS=$(aws ec2 describe-subnets --region "$REGION" --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[].SubnetId' --output text)
    for subnet in $SUBNET_IDS; do
        echo "  Deleting subnet: $subnet"
        aws ec2 delete-subnet --subnet-id "$subnet" --region "$REGION" 2>/dev/null || echo "    (already deleted or dependency exists)"
    done
    
    # Delete security groups (except default)
    echo "🔒 Deleting security groups..."
    SG_IDS=$(aws ec2 describe-security-groups --region "$REGION" --filters "Name=vpc-id,Values=$VPC_ID" --query 'SecurityGroups[?GroupName!=`default`].GroupId' --output text)
    for sg in $SG_IDS; do
        echo "  Deleting security group: $sg"
        aws ec2 delete-security-group --group-id "$sg" --region "$REGION" 2>/dev/null || echo "    (already deleted or dependency exists)"
    done
    
    # Delete route tables (except main)
    echo "🛣️ Deleting route tables..."
    RT_IDS=$(aws ec2 describe-route-tables --region "$REGION" --filters "Name=vpc-id,Values=$VPC_ID" --query 'RouteTables[?Associations[0].Main!=`true`].RouteTableId' --output text)
    for rt in $RT_IDS; do
        echo "  Deleting route table: $rt"
        aws ec2 delete-route-table --route-table-id "$rt" --region "$REGION" 2>/dev/null || echo "    (already deleted or dependency exists)"
    done
    
    # Wait for NAT gateways to delete
    echo "⏳ Waiting for NAT gateways to delete..."
    for nat_gw in $NAT_GATEWAYS; do
        while true; do
            STATE=$(aws ec2 describe-nat-gateways --region "$REGION" --nat-gateway-ids "$nat_gw" --query 'NatGateways[0].State' --output text 2>/dev/null)
            if [ "$STATE" = "deleted" ] || [ $? -ne 0 ]; then
                echo "  ✅ NAT gateway $nat_gw deleted"
                break
            fi
            echo "  ⏳ NAT gateway $nat_gw: $STATE"
            sleep 15
        done
    done
    
    # Delete the VPC
    echo "🗑️ Deleting VPC: $VPC_ID"
    aws ec2 delete-vpc --vpc-id "$VPC_ID" --region "$REGION"
    
    if [ $? -eq 0 ]; then
        echo "✅ VPC deleted successfully"
    else
        echo "❌ Failed to delete VPC - may have dependencies"
    fi
else
    echo "ℹ️ No EKS VPC found to delete"
fi

echo ""
echo "🎉 EKS cleanup completed!"
echo "Running final validation..."

# Run final validation
if [ -f "./scripts/validate-deployment-constraints.sh" ]; then
    ./scripts/validate-deployment-constraints.sh
else
    echo "⚠️ Validation script not found"
fi
