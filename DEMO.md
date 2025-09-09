# 5-Minute Demo Flow

## Prerequisites
```bash
# Set environment variables
export POSTMAN_API_KEY="your-postman-api-key"
export UPS_WORKSPACE_ID="your-workspace-id"
export TEAMS_WEBHOOK_URL="your-teams-webhook" # Optional

# Install dependencies
npm install
```

## Quick Demo
```bash
# Run the automated demo script
./demo.sh
```

## Manual Demo Steps

### 1. Quick Test (2 minutes)
```bash
# Login to Postman
postman login --with-api-key $POSTMAN_API_KEY

# Generate dashboard for current state
npm run dashboard

# Open in browser
open governance-dashboard.html
```

### 2. Show Quality Gate (3 minutes)
```bash
# Upload a bad API spec
node scripts/upload_specs_to_postman.js upload api-specs/ups-tracking-api-bad.yaml

# Run governance check (will fail)
node scripts/ups_postman_governance.js --workspace $UPS_WORKSPACE_ID --threshold 70 --json

# Upload improved API spec
node scripts/upload_specs_to_postman.js upload api-specs/ups-tracking-api-improved.yaml

# Run governance check (will pass)
node scripts/ups_postman_governance.js --workspace $UPS_WORKSPACE_ID --threshold 70 --json
```

### 3. Teams Notification Test
```bash
# Send test notification
node scripts/teams_notifier.js \
  --api "Demo API" \
  --score 45 \
  --violations 15 \
  --link "https://www.postman.com/sudo00/ups-governance-demo/overview"
```

## Key Talking Points

1. **Automated Quality Gates**
   - Every API must score 70/100 or higher
   - Blocks merges automatically in CI/CD
   - No manual review needed for basic quality

2. **Real-time Dashboard**
   - Fetches live data from Postman API
   - Shows all APIs in workspace
   - Color-coded pass/fail status

3. **Teams Integration**
   - Instant notifications on failures
   - Direct links to review in Postman
   - Batch summaries for multiple APIs

4. **Time Savings**
   - From: 3 days manual review
   - To: 20 minutes automated check
   - 99% reduction in governance overhead

## Azure DevOps Pipeline

Show the pipeline file:
- Automated spec uploads (idempotent)
- Quality gate enforcement
- Dashboard generation as artifact
- Teams notifications on completion

## Live Links

- **Public Workspace**: https://www.postman.com/sudo00/ups-governance-demo/overview
- **Azure Pipeline**: https://dev.azure.com/jaredboynton/ups-governance-demo

## Troubleshooting

If scores show as 0/Invalid:
- Check Postman API key is valid
- Ensure specs are valid OpenAPI 3.0
- Try manual lint: `postman spec lint <spec-id>`

If Teams notifications fail:
- Verify webhook URL is correct
- Check Teams channel permissions
- Test with curl: `curl -X POST -H "Content-Type: application/json" -d '{"text":"Test"}' $TEAMS_WEBHOOK_URL`
