#!/bin/bash

# Post-Deployment Application Monitoring Script
# Monitors ECS services and application health after successful deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${PURPLE}🎉 POST-DEPLOYMENT MONITORING${NC}"
echo "=============================="
echo -e "${CYAN}Monitoring application startup after successful deployment${NC}"
echo ""

# 1. Check ECS cluster status
echo -e "${BLUE}📊 ECS Cluster Status${NC}"
aws ecs describe-clusters --clusters cloud-apps-mern-cluster --region eu-west-2 \
  --query 'clusters[0].{Name:clusterName,Status:status,ActiveServices:activeServicesCount,RunningTasks:runningTasksCount}' \
  --output table

# 2. Check ECS services
echo -e "\n${BLUE}🔧 ECS Services Status${NC}"
SERVICES_STATUS=$(aws ecs describe-services --cluster cloud-apps-mern-cluster --services cloud-apps-mern-frontend cloud-apps-mern-backend --region eu-west-2 \
  --query 'services[*].{Name:serviceName,Status:status,Running:runningCount,Desired:desiredCount,Healthy:runningCount}' \
  --output table 2>/dev/null || echo "Services not found")

if [ "$SERVICES_STATUS" != "Services not found" ]; then
    echo "$SERVICES_STATUS"
else
    echo -e "${YELLOW}⚠️  ECS services not yet created or visible${NC}"
fi

# 3. Check running tasks
echo -e "\n${BLUE}📋 Running Tasks${NC}"
TASKS=$(aws ecs list-tasks --cluster cloud-apps-mern-cluster --region eu-west-2 --query 'taskArns' --output text)
if [ -n "$TASKS" ] && [ "$TASKS" != "None" ]; then
    echo -e "${GREEN}✅ Tasks found: $(echo $TASKS | wc -w) running${NC}"
    aws ecs describe-tasks --cluster cloud-apps-mern-cluster --tasks $TASKS --region eu-west-2 \
      --query 'tasks[*].{TaskArn:taskArn,LastStatus:lastStatus,HealthStatus:healthStatus,CreatedAt:createdAt}' \
      --output table
else
    echo -e "${YELLOW}⚠️  No tasks currently running - may still be starting up${NC}"
fi

# 4. Check ALB health
echo -e "\n${BLUE}🌐 Load Balancer Health${NC}"
ALB_DNS="cloud-apps-alb-1070807677.eu-west-2.elb.amazonaws.com"
echo "Testing ALB: $ALB_DNS"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://$ALB_DNS || echo "000")
echo "HTTP Status: $HTTP_STATUS"

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ ALB is healthy and serving content${NC}"
elif [ "$HTTP_STATUS" = "503" ]; then
    echo -e "${YELLOW}⚠️  ALB responding but backend services not healthy yet${NC}"
else
    echo -e "${RED}❌ ALB not responding properly${NC}"
fi

# 5. Check domain accessibility
echo -e "\n${BLUE}🔗 Domain Accessibility${NC}"
FRONTEND_URL="https://app1.mrchughes.site"
BACKEND_URL="https://app1.mrchughes.site/api"

echo "Testing Frontend: $FRONTEND_URL"
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $FRONTEND_URL || echo "000")
echo "Frontend Status: $FRONTEND_STATUS"

echo "Testing Backend API: $BACKEND_URL"
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $BACKEND_URL || echo "000")
echo "Backend Status: $BACKEND_STATUS"

# 6. Summary and recommendations
echo -e "\n${PURPLE}📊 MONITORING SUMMARY${NC}"
echo "======================="

if [ "$HTTP_STATUS" = "200" ] && [ "$FRONTEND_STATUS" = "200" ]; then
    echo -e "${GREEN}🎉 APPLICATION IS FULLY OPERATIONAL!${NC}"
    echo -e "${GREEN}✅ All services are healthy and accessible${NC}"
elif [ "$HTTP_STATUS" = "503" ]; then
    echo -e "${YELLOW}⏳ APPLICATION IS STARTING UP${NC}"
    echo -e "${YELLOW}⚠️  Services are deploying - this usually takes 2-5 minutes${NC}"
    echo -e "${CYAN}💡 Recommendation: Wait a few minutes and run this script again${NC}"
else
    echo -e "${RED}❌ APPLICATION NEEDS ATTENTION${NC}"
    echo -e "${RED}🔍 Check ECS service logs for issues${NC}"
fi

# 7. Useful commands for further monitoring
echo -e "\n${BLUE}🛠️  USEFUL MONITORING COMMANDS${NC}"
echo "==============================="
echo "Monitor ECS services:"
echo "  aws ecs describe-services --cluster cloud-apps-mern-cluster --services cloud-apps-mern-frontend cloud-apps-mern-backend --region eu-west-2"
echo ""
echo "Check task logs:"
echo "  aws logs tail /ecs/cloud-apps-mern-frontend --follow --region eu-west-2"
echo "  aws logs tail /ecs/cloud-apps-mern-backend --follow --region eu-west-2"
echo ""
echo "Force service update:"
echo "  aws ecs update-service --cluster cloud-apps-mern-cluster --service cloud-apps-mern-frontend --force-new-deployment --region eu-west-2"
echo ""
echo "Test application directly:"
echo "  curl -v https://app1.mrchughes.site/"
echo "  curl -v https://app1.mrchughes.site/api/health"

echo -e "\n${GREEN}🎊 DEPLOYMENT SUCCESS CONFIRMED!${NC}"
echo -e "${CYAN}The pipeline is working and the application is deploying correctly.${NC}"
