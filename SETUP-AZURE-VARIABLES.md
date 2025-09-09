# Azure DevOps Pipeline Variables Setup

## Pipeline Requirements

- **Azure Pipelines Agent**: Ubuntu 22.04 (ubuntu-20.04 deprecated April 2025)
- **Node.js**: Version 20 LTS
- **Postman CLI**: Installed via npm
- **jq**: Installed via apt-get (for JSON processing)

## Required Variables

To configure the Azure DevOps pipeline, add these variables to your pipeline or create a variable group:

### 1. Via Azure DevOps Web Interface

1. Navigate to: https://dev.azure.com/jaredboynton/ups-governance-demo
2. Go to Pipelines → Library → + Variable group
3. Name the group: `postman-secrets`
4. Add these variables:
   - **POSTMAN_API_KEY**: (Copy value from .env file - Mark as secret)
   - **UPS_WORKSPACE_ID**: (Copy value from .env file)
   - **TEAMS_WEBHOOK_URL**: (Optional - Mark as secret)

### 2. Via Azure CLI

```bash
# Create variable group
az pipelines variable-group create \
  --name postman-secrets \
  --variables UPS_WORKSPACE_ID=YOUR_WORKSPACE_ID_HERE \
  --organization https://dev.azure.com/jaredboynton \
  --project ups-governance-demo

# Add secret variable
az pipelines variable-group variable create \
  --group-id <group-id-from-above> \
  --name POSTMAN_API_KEY \
  --secret true \
  --value "YOUR_POSTMAN_API_KEY_HERE" \
  --organization https://dev.azure.com/jaredboynton \
  --project ups-governance-demo
```

### 3. Pipeline-specific Variables

Alternatively, add directly to pipeline:

1. Edit pipeline in Azure DevOps
2. Click Variables → New variable
3. Add each variable with appropriate secret settings

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