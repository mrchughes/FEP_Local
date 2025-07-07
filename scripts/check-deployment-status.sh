#!/bin/bash

# Deployment Status Checker
# Run this to check the status of your GitHub Actions deployment

echo "🚀 Checking Deployment Status"
echo "============================="
echo ""

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Not in a git repository"
    exit 1
fi

# Get current commit hash
COMMIT_HASH=$(git rev-parse HEAD)
COMMIT_SHORT=$(git rev-parse --short HEAD)
BRANCH=$(git branch --show-current)

echo "📋 Current Status:"
echo "Branch: $BRANCH"
echo "Commit: $COMMIT_SHORT ($COMMIT_HASH)"
echo ""

# Check if we have a remote
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "No remote configured")
echo "Remote: $REMOTE_URL"
echo ""

# Extract GitHub repo info if it's a GitHub URL
if [[ "$REMOTE_URL" =~ github\.com[:/]([^/]+)/([^/.]+) ]]; then
    GITHUB_USER="${BASH_REMATCH[1]}"
    GITHUB_REPO="${BASH_REMATCH[2]}"
    
    echo "🔗 GitHub Repository: $GITHUB_USER/$GITHUB_REPO"
    echo ""
    echo "📊 Check deployment status at:"
    echo "   https://github.com/$GITHUB_USER/$GITHUB_REPO/actions"
    echo ""
    echo "🔍 Look for workflow run with commit: $COMMIT_SHORT"
    echo ""
    
    # Check if gh CLI is available
    if command -v gh &> /dev/null; then
        echo "📱 GitHub CLI detected - checking workflow status..."
        echo ""
        
        # Get workflow runs
        gh run list --limit 5 --json status,conclusion,displayTitle,createdAt,headSha | \
        jq -r '.[] | "\(.status | ascii_upcase) - \(.displayTitle) (\(.headSha[0:7])) - \(.createdAt)"'
        echo ""
        
        # Get latest run for current commit
        LATEST_RUN=$(gh run list --json status,conclusion,displayTitle,headSha,url | \
        jq -r --arg commit "$COMMIT_HASH" '.[] | select(.headSha == $commit) | .url' | head -1)
        
        if [[ -n "$LATEST_RUN" ]]; then
            echo "🎯 Direct link to your deployment:"
            echo "   $LATEST_RUN"
        fi
    else
        echo "💡 Install GitHub CLI for more details:"
        echo "   brew install gh"
        echo "   gh auth login"
    fi
else
    echo "⚠️  Not a GitHub repository or remote URL not recognized"
fi

echo ""
echo "⏰ Expected deployment timeline:"
echo "   1. Infrastructure (shared-infra): ~5-10 minutes"
echo "   2. MERN app deployment: ~10-15 minutes"
echo "   3. Python app deployment: ~5-10 minutes"
echo "   4. Total time: ~20-35 minutes"
echo ""

echo "🔧 After deployment completes:"
echo "   1. Get name servers: ./scripts/get-nameservers.sh"
echo "   2. Update Namecheap DNS settings"
echo "   3. Wait 24-48 hours for DNS propagation"
echo "   4. Verify with: ./scripts/ssl-health-check.sh"
echo ""

echo "📖 For troubleshooting:"
echo "   - DEPLOYMENT_READINESS_REPORT.md"
echo "   - docs/DNS_SETUP_GUIDE.md"
echo "   - docs/SSL_CERTIFICATE_MANAGEMENT.md"
