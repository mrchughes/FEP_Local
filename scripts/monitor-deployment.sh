#!/bin/bash

# Monitor deployment progress and verify fixes
# Usage: ./scripts/monitor-deployment.sh

set -e

# Configuration
DOMAIN="mrchughes.site"
MERN_SUBDOMAIN="mern.mrchughes.site"
PYTHON_SUBDOMAIN="python.mrchughes.site"
CHECK_INTERVAL=30  # seconds
MAX_CHECKS=20      # 10 minutes max

echo "🔍 Monitoring deployment progress..."
echo "ALB: $ALB_DNS"
echo "Domain: $DOMAIN"
echo "Checking every $CHECK_INTERVAL seconds (max $MAX_CHECKS checks)"
echo "=========================================="

check_frontend() {
    local response=$(curl -s -k -H "Host: $DOMAIN" "https://$ALB_DNS/" 2>/dev/null || echo "ERROR")
    
    if [[ "$response" == "ERROR" ]]; then
        echo "❌ Frontend unreachable"
        return 1
    fi
    
    # Check for debug comments (should be removed)
    if echo "$response" | grep -q "// Fully implemented real code"; then
        echo "⚠️  Old version still deployed (debug comments present)"
        return 1
    fi
    
    # Check for GOV.UK stylesheet
    if echo "$response" | grep -q "govuk-frontend"; then
        echo "✅ New version deployed (GOV.UK styles present)"
        return 0
    else
        echo "⚠️  Frontend loading but missing GOV.UK styles"
        return 1
    fi
}

check_backend() {
    local response=$(curl -s -k -H "Host: $DOMAIN" "https://$ALB_DNS/api/" 2>/dev/null || echo "ERROR")
    
    if [[ "$response" == "ERROR" ]]; then
        echo "❌ Backend unreachable"
        return 1
    fi
    
    if echo "$response" | grep -q "Funeral Expenses API"; then
        echo "✅ Backend healthy"
        return 0
    else
        echo "⚠️  Backend responding but unexpected content"
        return 1
    fi
}

check_ecs_status() {
    echo "📊 ECS Service Status:"
    aws ecs describe-services \
        --cluster cloud-apps-mern-cluster \
        --services cloud-apps-mern-backend cloud-apps-mern-frontend \
        --query 'services[*].{Name:serviceName,Status:status,Running:runningCount,Desired:desiredCount,LastDeployment:deployments[0].createdAt}' \
        --output table 2>/dev/null || echo "❌ Could not fetch ECS status"
}

# Main monitoring loop
check_count=0
frontend_healthy=false
backend_healthy=false

echo "Starting monitoring loop..."

while [ $check_count -lt $MAX_CHECKS ]; do
    check_count=$((check_count + 1))
    echo ""
    echo "🔄 Check $check_count/$MAX_CHECKS ($(date '+%H:%M:%S'))"
    echo "----------------------------------------"
    
    # Check ECS status every few checks
    if [ $((check_count % 3)) -eq 1 ]; then
        check_ecs_status
        echo ""
    fi
    
    # Check frontend
    if check_frontend; then
        frontend_healthy=true
    fi
    
    # Check backend
    if check_backend; then
        backend_healthy=true
    fi
    
    # Success condition
    if [ "$frontend_healthy" = true ] && [ "$backend_healthy" = true ]; then
        echo ""
        echo "🎉 DEPLOYMENT SUCCESSFUL!"
        echo "✅ Frontend: https://$DOMAIN"
        echo "✅ Backend API: https://$DOMAIN/api"
        echo "✅ All UI fixes have been deployed"
        echo "✅ GOV.UK styling is active"
        echo "✅ Debug comments removed"
        exit 0
    fi
    
    # Wait before next check
    if [ $check_count -lt $MAX_CHECKS ]; then
        echo "⏳ Waiting $CHECK_INTERVAL seconds before next check..."
        sleep $CHECK_INTERVAL
    fi
done

echo ""
echo "⏰ Monitoring timeout reached"
echo "❌ Deployment may still be in progress or there are issues"
echo "💡 Check GitHub Actions: https://github.com/mrchughes/cloud-apps-monorepo/actions"
echo "💡 Run: ./scripts/cloud-ops.sh status"
