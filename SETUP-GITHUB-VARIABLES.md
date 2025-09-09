# GitHub Actions Setup Guide

## Prerequisites

- GitHub account
- Repository with admin access
- Postman API key and workspace ID

## 1. Fork or Create Repository

### Option A: Fork This Repository
1. Navigate to this repository on GitHub
2. Click **Fork** in the top-right corner
3. Select your account/organization

### Option B: Create New Repository
```bash
# Clone locally
git clone <this-repo-url>
cd ups-governance-demo

# Create new GitHub repo and push
gh repo create ups-governance-demo --private
git remote add origin https://github.com/YOUR_USERNAME/ups-governance-demo.git
git push -u origin main
```

## 2. Configure Repository Secrets

### Via GitHub Web Interface
1. Navigate to your repository on GitHub
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** for each:
   - **POSTMAN_API_KEY**: Your Postman API key
   - **UPS_WORKSPACE_ID**: Your workspace ID
   - **TEAMS_WEBHOOK_URL**: Teams webhook URL (optional)

### Via GitHub CLI
```bash
# Set secrets using GitHub CLI
gh secret set POSTMAN_API_KEY --body "your-postman-api-key"
gh secret set UPS_WORKSPACE_ID --body "your-workspace-id"
gh secret set TEAMS_WEBHOOK_URL --body "your-teams-webhook-url"
```

## 3. Enable GitHub Actions

If Actions aren't enabled:
1. Go to **Settings** → **Actions** → **General**
2. Select **Allow all actions and reusable workflows**
3. Click **Save**

## 4. Workflow Configuration Options

### Manual Triggers with Parameters
The workflow supports manual execution with customizable parameters:

1. **Via GitHub Web Interface:**
   - Go to **Actions** tab
   - Select **API Governance Check** workflow  
   - Click **Run workflow**
   - Choose branch and governance threshold (50/60/70/80/90)
   - Click **Run workflow**

2. **Via GitHub CLI:**
```bash
# Trigger workflow with custom threshold
gh workflow run "API Governance Check" \
  --field governance_threshold=80
```

### Automatic Triggers
The workflow automatically runs on:
- **Push to branches**: `main`, `feature/**`
- **File changes**: Only when files in `api-specs/**` are modified  
- **Pull Requests**: To `main` branch affecting `api-specs/**`

### Workflow Features

**Infrastructure:**
- **OS**: Ubuntu 22.04 LTS
- **Node.js**: Version 20.x LTS with automatic NPM caching
- **Dependencies**: Postman CLI, jq for JSON processing

**Outputs:**
- **Artifacts**: `governance-report` (JSON), `governance-dashboard` (HTML)
- **Retention**: 30 days (configurable)
- **PR Comments**: Automatic results with governance summary
- **Job Summaries**: Markdown reports in workflow run

**Quality Gates:**
- **Threshold Enforcement**: Configurable minimum scores (default: 70/100)
- **Workflow Failure**: Fails if any API scores below threshold
- **Continue on Error**: Spec upload failures don't block governance checks

## 5. Run Your First Workflow

### Test Workflow Setup
Push changes to `api-specs/` directory or create a pull request to trigger automatically.

## 6. View Results

### Workflow Run
1. Click on the workflow run
2. View real-time logs for each step
3. Check job summary for markdown report

### Artifacts
1. Scroll to bottom of workflow run page
2. Download artifacts:
   - `governance-report` - JSON data
   - `governance-dashboard` - HTML dashboard

### Pull Request Comments
If triggered by a PR, the workflow automatically posts governance results as a comment.

## 7. Advanced Configuration

### Environment Variable Support  
The workflow respects environment variables for local testing:

```bash
# Set custom threshold locally
export GOVERNANCE_THRESHOLD=80

# Test governance script locally
node scripts/ups_postman_governance.js --workspace $UPS_WORKSPACE_ID --json
```

### Workflow Customization Options

**Modify Node.js Version:**
- Edit `.github/workflows/postman-governance.yml`
- Change `node-version: '20.x'` to desired version

**Customize Artifact Retention:**
- Edit `retention-days: 30` in upload-artifact steps
- Maximum retention: 90 days for private repos, 400 days for public

**Cache Configuration:**
- NPM cache automatically enabled with `cache: 'npm'`
- Based on `package-lock.json` changes

### GitHub Actions Features
- **Automatic NPM Caching**: Enabled with `actions/setup-node@v4`
- **Parallel Jobs**: Single job with sequential steps for proper dependency handling  
- **Conditional Steps**: `if: always()` ensures artifacts created even on failures
- **Error Handling**: `continue-on-error: true` for non-critical spec uploads

### PR Integration Features
- **github-script Action**: Used for sophisticated PR comment handling
- **Comment Updates**: Existing governance comments updated instead of creating new ones
- **Artifact Links**: PR comments include direct links to workflow artifacts
- **GITHUB_TOKEN**: Automatically provided, no configuration needed

## 8. Troubleshooting

**Workflow not appearing:**
- Ensure `.github/workflows/postman-governance.yml` exists
- Check Actions are enabled in repository settings

**"Bad credentials" error:**
- Verify GITHUB_TOKEN has correct permissions
- For PR comments, ensure workflow has write permissions

**Postman API errors:**
- Verify POSTMAN_API_KEY is valid
- Check UPS_WORKSPACE_ID matches your workspace

```bash
# Export variables  
export POSTMAN_API_KEY="your-key"
export UPS_WORKSPACE_ID="your-workspace-id"

# Test Postman connection
postman login --with-api-key $POSTMAN_API_KEY

# Generate dashboard
npm run dashboard
```

### Error Handling & Retry Logic
The workflow includes built-in resilience features:
- **Network Retries**: Scripts automatically retry failed API calls with exponential backoff
- **Rate Limiting**: Built-in delays respect Postman API limits
- **Partial Failures**: Individual spec failures don't stop batch processing
- **Graceful Degradation**: Workflow completes even if some steps fail

## 9. Permissions

For PR comments to work, ensure GitHub Actions has write permissions:
1. **Settings** → **Actions** → **General**
2. Under **Workflow permissions**, select:
   - **Read and write permissions**
   - **Allow GitHub Actions to create and approve pull requests**

## 10. Manual Testing

Test locally before pushing: