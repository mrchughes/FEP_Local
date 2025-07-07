#!/bin/bash

# DNS Name Server Helper Script
# Run this after terraform apply to get name servers for Namecheap

echo "🌐 Route53 Name Server Configuration Helper"
echo "==========================================="
echo ""

# Check if we're in the right directory
if [[ ! -f "shared-infra/terraform/main.tf" ]]; then
    echo "❌ Please run this script from the project root directory"
    echo "   Current directory: $(pwd)"
    echo "   Expected: cloud-apps-bundle/"
    exit 1
fi

# Check if terraform is available
if ! command -v terraform &> /dev/null; then
    echo "❌ Terraform not found. Please install terraform first."
    exit 1
fi

# Navigate to shared infrastructure
cd shared-infra/terraform

# Check if terraform is initialized
if [[ ! -d ".terraform" ]]; then
    echo "⚠️  Terraform not initialized. Running 'terraform init'..."
    terraform init
fi

# Try to get name servers
echo "📋 Getting Route53 name servers..."
if terraform output name_servers &>/dev/null; then
    NAME_SERVERS=$(terraform output -raw name_servers)
    
    echo "✅ SUCCESS! Here are your Route53 name servers:"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📋 COPY THESE TO NAMECHEAP:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Parse and display name servers nicely
    echo "$NAME_SERVERS" | sed 's/\[//g' | sed 's/\]//g' | sed 's/"//g' | tr ',' '\n' | nl -w2 -s'. ' | sed 's/^/Name Server /'
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📝 NEXT STEPS:"
    echo "1. Login to Namecheap.com"
    echo "2. Go to Domain List → Manage → Advanced DNS"
    echo "3. Select 'Custom DNS'"
    echo "4. Enter the 4 name servers above"
    echo "5. Save changes"
    echo "6. Wait 24-48 hours for DNS propagation"
    echo ""
    echo "🔍 To verify DNS propagation:"
    echo "   dig yourdomain.com NS"
    echo ""
    echo "📖 For detailed guide: docs/DNS_SETUP_GUIDE.md"
    
else
    echo "❌ Name servers not available yet."
    echo ""
    echo "This usually means:"
    echo "1. Terraform hasn't been applied yet"
    echo "2. The Route53 hosted zone wasn't created"
    echo ""
    echo "🔧 To fix this:"
    echo "   cd shared-infra/terraform"
    echo "   terraform plan"
    echo "   terraform apply"
    echo ""
    echo "Then run this script again."
fi

echo ""
echo "💡 TIP: You can also get name servers manually with:"
echo "   cd shared-infra/terraform && terraform output name_servers"
