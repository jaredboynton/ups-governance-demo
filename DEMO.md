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
  --link "https://www.postman.com/r00tfs/ups-governance-demo/overview"
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

### Quick Azure Setup (5 minutes)
```bash
# 1. Install Azure CLI + DevOps extension
az extension add --name azure-devops
az login

# 2. Create project and upload code
az devops project create --name "ups-governance-demo" --organization "https://dev.azure.com/YOUR_ORG"
git remote add azure https://dev.azure.com/YOUR_ORG/ups-governance-demo/_git/ups-governance-demo
git push azure main

# 3. Create variable group
az pipelines variable-group create \
  --name "postman-secrets" \
  --variables UPS_WORKSPACE_ID="your-workspace-id" \
  --organization "https://dev.azure.com/YOUR_ORG" \
  --project "ups-governance-demo"

# 4. Add secret API key (get group ID from step 3 output)
az pipelines variable-group variable create \
  --group-id "<GROUP_ID>" \
  --name "POSTMAN_API_KEY" \
  --secret true \
  --value "your-postman-api-key" \
  --organization "https://dev.azure.com/YOUR_ORG" \
  --project "ups-governance-demo"

# 5. Create and run pipeline
az pipelines create --yml-path ".azure/pipelines/postman-governance.yml"
```

### Pipeline Features
- Automated spec uploads (idempotent)  
- Quality gate enforcement (fails build if score < 70)
- Dashboard generation as artifact
- Teams notifications on completion
- Dynamic spec-ids.json updating

## Live Links

- **Public Workspace**: https://www.postman.com/r00tfs/ups-governance-demo/overview
- **Azure Pipeline**: https://dev.azure.com/jaredboynton/ups-governance-demo

## Azure DevOps Demo Tips

### For Customer Presentations
1. **Pre-create Azure project** before the demo (saves 2-3 minutes)
2. **Have variable group ready** with placeholder values
3. **Show pipeline YAML** in VS Code for technical credibility
4. **Demo artifact download** - customers love seeing the HTML dashboard

### Pipeline Demo Flow
```bash
# 1. Show pipeline triggers automatically on code push
git add api-specs/new-spec.yaml
git commit -m "Add new API spec for governance review"
git push origin main

# 2. Navigate to Azure DevOps → Pipelines → Show running build
# 3. Highlight key stages: Upload → Lint → Score → Block/Pass
# 4. Download governance dashboard artifact
# 5. Open HTML file → show governance scores
```

## Troubleshooting

**Azure DevOps Issues:**
- **Variable group not found**: Check group name is exactly `postman-secrets`
- **Permission denied**: Ensure user has Project Administrator role
- **Pipeline won't trigger**: Verify `.azure/pipelines/postman-governance.yml` exists in repo

**Governance Scoring Issues:**
- **Scores show as 0/Invalid**: Check Postman API key is valid and has workspace access
- **Specs not uploading**: Ensure specs are valid OpenAPI 3.0 format
- **Custom rules not applied**: Verify rules are activated in Postman workspace

**Teams Integration:**
- **No notifications**: Verify webhook URL is correct and not expired  
- **Cards don't display**: Check Teams channel allows external webhooks
- **Test webhook**: `curl -X POST -H "Content-Type: application/json" -d '{"text":"Test"}' $TEAMS_WEBHOOK_URL`

## Advanced Configuration

### Environment Variables
```bash
# Set custom governance threshold
export GOVERNANCE_THRESHOLD=80

# Enable detailed error output
export DEBUG=true
```

### Pipeline Customization
Both pipelines support advanced customization:

**Manual Triggers:**
- Azure DevOps: Parameter selection UI with threshold options
- GitHub Actions: `workflow_dispatch` with threshold choice input

**Automatic Retries:**
- Network failures: Exponential backoff (1s, 2s, 4s delays)
- Rate limiting: Built-in delays between Postman API calls
- Partial failures: Individual spec failures don't stop batch processing

**Performance Optimization:**
- NPM caching: Based on `package-lock.json` checksum  
- Artifact compression: Automatic for JSON and HTML outputs
- Parallel processing: Scripts handle multiple specs concurrently

### Collection Generation
```bash
# Upload all specs with collection generation
node scripts/upload_specs_to_postman.js upload-all --with-collections

# Generate collections for existing specs only
node scripts/upload_specs_to_postman.js generate-all-collections
```
