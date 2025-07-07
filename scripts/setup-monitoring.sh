#!/bin/bash

echo "=== INFRASTRUCTURE MONITORING CRON SETUP ==="
echo ""

# Determine the workspace root and scripts path
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(dirname "$SCRIPT_DIR")"
SCRIPTS_PATH="$SCRIPT_DIR"

echo "Setting up automated monitoring for infrastructure..."
echo "Workspace: $WORKSPACE_ROOT"
echo ""

# Create a monitoring log directory
mkdir -p "$WORKSPACE_ROOT/logs"

echo "Available monitoring schedules:"
echo "1. DNS health check every hour"
echo "2. Infrastructure validation every 6 hours"  
echo "3. Comprehensive daily audit"
echo "4. Weekly cleanup check"
echo "5. All of the above"
echo ""

read -p "Select monitoring level (1-5): " choice

case $choice in
    1)
        CRON_ENTRIES="# DNS Health Check - Every hour
0 * * * * cd $SCRIPTS_PATH && ./monitor-dns-health.sh >> logs/dns-monitoring.log 2>&1"
        ;;
    2)
        CRON_ENTRIES="# Infrastructure Validation - Every 6 hours
0 */6 * * * cd $SCRIPTS_PATH && ./prevent-config-drift.sh all >> logs/infrastructure-validation.log 2>&1"
        ;;
    3)
        CRON_ENTRIES="# Daily Comprehensive Audit - Every day at 2 AM
0 2 * * * cd $SCRIPTS_PATH && ./comprehensive-test.sh >> logs/daily-audit.log 2>&1"
        ;;
    4)
        CRON_ENTRIES="# Weekly Cleanup Check - Every Sunday at 3 AM
0 3 * * 0 cd $SCRIPTS_PATH && echo '=== WEEKLY CLEANUP CHECK ===' >> logs/weekly-cleanup.log && aws route53 list-hosted-zones --query 'HostedZones[?Name==\`mrchughes.site.\`]' >> logs/weekly-cleanup.log 2>&1"
        ;;
    5)
        CRON_ENTRIES="# Infrastructure Monitoring - Comprehensive Setup
# DNS Health Check - Every hour
0 * * * * cd $SCRIPTS_PATH && ./monitor-dns-health.sh >> logs/dns-monitoring.log 2>&1

# Infrastructure Validation - Every 6 hours
0 */6 * * * cd $SCRIPTS_PATH && ./prevent-config-drift.sh all >> logs/infrastructure-validation.log 2>&1

# Daily Comprehensive Audit - Every day at 2 AM
0 2 * * * cd $SCRIPTS_PATH && ./comprehensive-test.sh >> logs/daily-audit.log 2>&1

# Weekly Cleanup Check - Every Sunday at 3 AM
0 3 * * 0 cd $SCRIPTS_PATH && echo '=== WEEKLY CLEANUP CHECK ===' >> logs/weekly-cleanup.log && aws route53 list-hosted-zones --query 'HostedZones[?Name==\`mrchughes.site.\`]' >> logs/weekly-cleanup.log 2>&1

# Log rotation - Every month
0 0 1 * * cd $SCRIPTS_PATH/logs && for log in *.log; do [ -f \"\$log\" ] && mv \"\$log\" \"\$log.$(date +%Y%m)\" && touch \"\$log\"; done"
        ;;
    *)
        echo "Invalid selection. Exiting."
        exit 1
        ;;
esac

echo ""
echo "Cron entries to be added:"
echo "========================="
echo "$CRON_ENTRIES"
echo ""

read -p "Add these cron entries? (y/n): " confirm

if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
    # Backup existing crontab
    crontab -l > crontab_backup_$(date +%Y%m%d_%H%M%S).txt 2>/dev/null || touch crontab_backup_$(date +%Y%m%d_%H%M%S).txt
    
    # Add new entries to crontab
    (crontab -l 2>/dev/null; echo ""; echo "$CRON_ENTRIES") | crontab -
    
    echo "✅ Cron jobs added successfully!"
    echo ""
    echo "Current crontab:"
    crontab -l
    echo ""
    echo "Log files will be created in: $WORKSPACE_ROOT/logs/"
    echo ""
    echo "To remove these cron jobs later:"
    echo "  crontab -e"
    echo "  or restore from backup: crontab crontab_backup_*.txt"
    echo ""
    echo "To view logs:"
    echo "  tail -f logs/dns-monitoring.log"
    echo "  tail -f logs/infrastructure-validation.log"
    echo "  tail -f logs/daily-audit.log"
    echo "  tail -f logs/weekly-cleanup.log"
else
    echo "Cron setup cancelled."
    echo ""
    echo "To manually add later, copy these entries:"
    echo "$CRON_ENTRIES"
    echo ""
    echo "And run: crontab -e"
fi

echo ""
echo "Additional monitoring options:"
echo "=============================="
echo "1. Manual monitoring:"
echo "   ./monitor-dns-health.sh"
echo "   ./prevent-config-drift.sh all"
echo ""
echo "2. One-time comprehensive test:"
echo "   ./comprehensive-test.sh"
echo ""
echo "3. View current infrastructure status:"
echo "   cd shared-infra/terraform && terraform output"
echo ""
echo "4. Test DNS propagation:"
echo "   ./test-dns-propagation.sh"
