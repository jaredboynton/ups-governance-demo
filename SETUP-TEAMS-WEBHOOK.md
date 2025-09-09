# Setting Up Microsoft Teams Webhook

## Creating an Incoming Webhook in Teams

### Method 1: Via Teams App (Recommended)

1. **Open Microsoft Teams**
2. **Navigate to the channel** where you want notifications (e.g., "API Governance Alerts")
3. **Click the three dots (...)** next to the channel name
4. **Select "Connectors"** from the menu
5. **Search for "Incoming Webhook"**
6. **Click "Configure"** next to Incoming Webhook
7. **Provide a name** for your webhook (e.g., "UPS API Governance Bot")
8. **Optional: Upload an image** for the webhook (will appear with notifications)
9. **Click "Create"**
10. **Copy the webhook URL** - it will look like:
    ```
    https://outlook.office.com/webhook/xxxxx-xxxx-xxxx-xxxx-xxxxxxxxx@xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/IncomingWebhook/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    ```
11. **Click "Done"**

### Method 2: Via Teams Admin Center (If Connectors Option Not Available)

1. **Go to Teams Admin Center**: https://admin.teams.microsoft.com
2. **Navigate to**: Teams apps → Manage apps
3. **Search for**: "Incoming Webhook"
4. **Ensure it's allowed** for your organization
5. **Then follow Method 1** above

### Method 3: Using Power Automate (Alternative)

1. **Go to Power Automate**: https://flow.microsoft.com
2. **Create new flow** → Instant cloud flow
3. **Add trigger**: "When a HTTP request is received"
4. **Add action**: "Post message in a chat or channel" (Microsoft Teams)
5. **Configure the Teams channel**
6. **Save and get the HTTP POST URL**

**Note**: The UPS Governance Demo sends Adaptive Cards, which are fully supported by both native webhooks and Power Automate.

## Testing Your Webhook

Once you have the webhook URL, test it:

```bash
curl -H "Content-Type: application/json" -d '{
  "text": "Test message from UPS Governance Demo"
}' "YOUR_WEBHOOK_URL"
```

Or use the Teams notifier script:

```bash
export TEAMS_WEBHOOK_URL="YOUR_WEBHOOK_URL"
node scripts/teams_notifier.js \
  --webhook "$TEAMS_WEBHOOK_URL" \
  --api "Test API" \
  --score 85 \
  --violations 3

# Or test with a batch summary (like the pipeline sends)
echo '[{"name":"Test API","score":85,"violationsCount":3,"status":"PASS"}]' > test-results.json
node scripts/teams_notifier.js --webhook "$TEAMS_WEBHOOK_URL" --batch test-results.json
```

## Common Issues

### "Connectors" Option Not Visible
- **Cause**: Connectors might be disabled by your Teams admin
- **Solution**: Contact your Teams administrator to enable connectors
- **Alternative**: Use Power Automate method instead

### Webhook Returns 400 Error
- **Cause**: Incorrect JSON format
- **Solution**: Ensure Content-Type is `application/json` and payload is valid JSON

### Webhook Returns 403 Error
- **Cause**: Webhook URL is incorrect or expired
- **Solution**: Regenerate the webhook in Teams

### No Notifications Appearing
- **Cause**: Channel notifications might be muted
- **Solution**: Check channel notification settings in Teams

## Security Considerations

1. **Keep webhook URLs secret** - Anyone with the URL can post to your channel
2. **Store in environment variables** - Never commit webhook URLs to git
3. **Rotate periodically** - Delete and recreate webhooks periodically
4. **Monitor usage** - Watch for unexpected messages in your channel

## Adding to Azure DevOps

Once you have your webhook URL:

1. **Add to local .env** for testing:
   ```bash
   echo 'TEAMS_WEBHOOK_URL="your-webhook-url"' >> .env
   ```

2. **Add to Azure DevOps pipeline**:
   - Go to Pipelines → Library → Variable groups
   - Edit `postman-secrets` group
   - Add variable: `TEAMS_WEBHOOK_URL` (mark as secret)
   - Save

## Webhook Payload Format

The Teams notifier script sends Adaptive Cards with this structure:

```json
{
  "type": "message",
  "attachments": [{
    "contentType": "application/vnd.microsoft.card.adaptive",
    "content": {
      "type": "AdaptiveCard",
      "version": "1.3",
      "body": [
        // Card content
      ],
      "actions": [
        // Card actions (buttons)
      ]
    }
  }]
}
```

## Integration with Demo

Once your webhook is set up:

```bash
# Add to .env for local testing
echo 'TEAMS_WEBHOOK_URL="your-webhook-url"' >> .env

# The demo script will automatically use it
./demo.sh

# Or manually trigger a notification after scoring
npm run dashboard
node scripts/teams_notifier.js --batch governance-report.json
```

## Next Steps

1. Create webhook in your Teams channel
2. Test with curl command above
3. Add URL to .env file
4. Test with teams_notifier.js script
5. Add to Azure DevOps pipeline variables (optional)