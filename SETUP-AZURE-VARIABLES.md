# Azure DevOps Complete Setup Guide

## Prerequisites

- Azure DevOps account (free tier available)
- Azure CLI installed (`az --version`)
- Postman API key and workspace ID

## 1. Create Azure DevOps Project

### Via Web Interface
1. Go to https://dev.azure.com
2. Click **New Project**
3. Name: `ups-governance-demo` (or your preferred name)
4. Visibility: Private
5. Click **Create**

### Via Azure CLI
```bash
# Login to Azure DevOps
az login
az extension add --name azure-devops

# Create new project
az devops project create \
  --name "ups-governance-demo" \
  --organization "https://dev.azure.com/YOUR_ORGANIZATION" \
  --visibility private \
  --source-control git
```

## 2. Setup Repository and Pipeline

### Upload Code to Azure Repos
```bash
# Clone the UPS demo
git clone <this-repo-url>
cd ups-governance-demo

# Add Azure DevOps remote (replace with your URLs)
git remote add azure https://dev.azure.com/YOUR_ORGANIZATION/ups-governance-demo/_git/ups-governance-demo
git push azure main
```

### Create Pipeline
```bash
# Create pipeline from existing YAML
az pipelines create \
  --name "UPS API Governance" \
  --description "Automated API governance with Postman" \
  --repository https://dev.azure.com/YOUR_ORGANIZATION/ups-governance-demo/_git/ups-governance-demo \
  --branch main \
  --yml-path ".azure/pipelines/postman-governance.yml" \
  --organization "https://dev.azure.com/YOUR_ORGANIZATION" \
  --project "ups-governance-demo"
```

## 3. Configure Required Variables

1. Navigate to your Azure DevOps project
2. Go to **Pipelines** → **Library** → **+ Variable group**
3. Name the group: `postman-secrets`
4. Add these variables:
   - **POSTMAN_API_KEY**: `your-postman-api-key` (✅ **Mark as secret**)
   - **UPS_WORKSPACE_ID**: `your-workspace-id`
   - **TEAMS_WEBHOOK_URL**: `your-teams-webhook-url` (✅ **Mark as secret**, optional)
5. Click **Save**

### Method 2: Via Azure CLI
```bash
# Set your organization and project
export AZURE_DEVOPS_ORG="https://dev.azure.com/YOUR_ORGANIZATION"
export AZURE_PROJECT="ups-governance-demo"

# Create variable group
az pipelines variable-group create \
  --name "postman-secrets" \
  --variables UPS_WORKSPACE_ID="your-workspace-id-here" \
  --organization "$AZURE_DEVOPS_ORG" \
  --project "$AZURE_PROJECT"

# Get the group ID from the output above, then add secret variables
export GROUP_ID="<group-id-from-above>"

az pipelines variable-group variable create \
  --group-id "$GROUP_ID" \
  --name "POSTMAN_API_KEY" \
  --secret true \
  --value "your-postman-api-key-here" \
  --organization "$AZURE_DEVOPS_ORG" \
  --project "$AZURE_PROJECT"

# Optional: Add Teams webhook
az pipelines variable-group variable create \
  --group-id "$GROUP_ID" \
  --name "TEAMS_WEBHOOK_URL" \
  --secret true \
  --value "your-teams-webhook-url" \
  --organization "$AZURE_DEVOPS_ORG" \
  --project "$AZURE_PROJECT"
```

## 4. Run Your First Pipeline

### Trigger Pipeline
```bash
# Queue a new build
az pipelines run \
  --name "UPS API Governance" \
  --organization "$AZURE_DEVOPS_ORG" \
  --project "$AZURE_PROJECT"
```

Or push a change to the `main` branch or `api-specs/` directory to auto-trigger.

## 5. Verify Pipeline Results

1. Go to **Pipelines** → **Recent runs**
2. Click on your pipeline run
3. Check these artifacts are generated:
   - `governance-reports` (JSON data)
   - `governance-dashboard` (HTML dashboard)
4. Download and open `governance-dashboard.html`

## 6. Permissions & Troubleshooting

### Required Permissions
- **Project Administrator** (to create variable groups)
- **Build Administrator** (to create/edit pipelines)
- **Contributor** (to push code to repos)

### Common Issues

**Pipeline fails with "Variable group not found":**
```bash
# Check variable groups exist
az pipelines variable-group list --organization "$AZURE_DEVOPS_ORG" --project "$AZURE_PROJECT"

# Verify variable group name matches pipeline YAML (must be "postman-secrets")
```

**"POSTMAN_API_KEY environment variable not set":**
- Ensure variable is marked as **secret** in the variable group
- Check variable name is exactly `POSTMAN_API_KEY` (case-sensitive)

**Pipeline triggers but doesn't run:**
- Verify repository permissions
- Check that `.azure/pipelines/postman-governance.yml` exists in your repository
- Ensure your branch matches the trigger configuration (main/master)

## Teams Webhook Setup

Once you have a Teams webhook URL:

1. Add to variable group:
   - **TEAMS_WEBHOOK_URL**: `<your-webhook-url>` (Mark as secret)

2. Or set as environment variable locally for testing:
   ```bash
   export TEAMS_WEBHOOK_URL="<your-webhook-url>"
   ```

## Verify Setup

Test the configuration:

```bash
# Export variables locally
export POSTMAN_API_KEY="YOUR_POSTMAN_API_KEY_HERE"
export UPS_WORKSPACE_ID="YOUR_WORKSPACE_ID_HERE"

# Test Postman connection
postman login --with-api-key $POSTMAN_API_KEY

# Test scorer
node scripts/ups_postman_governance.js --workspace $UPS_WORKSPACE_ID --json

# Run quick demo
./demo.sh
```