#!/bin/bash

# UPS API Governance Demo Script
# For Thursday's presentation

echo "======================================"
echo "UPS API Governance Demo"
echo "======================================"
echo ""

# Check if environment variables are set
if [ -z "$POSTMAN_API_KEY" ] || [ -z "$UPS_WORKSPACE_ID" ]; then
    echo "Error: Please set environment variables first:"
    echo "  export POSTMAN_API_KEY=your-key-here"
    echo "  export UPS_WORKSPACE_ID=your-workspace-id"
    exit 1
fi

# Function to pause between steps
pause() {
    echo ""
    echo "Press Enter to continue..."
    read
}

echo "Step 1: Login to Postman CLI"
echo "----------------------------"
postman login --with-api-key $POSTMAN_API_KEY
echo "✓ Logged in successfully"
pause

echo "Step 2: Upload Demo API Specifications"
echo "-------------------------------------"
echo "Uploading 3 API specs for demonstration:"
echo "  1. UPS Tracking API (Bad) - Expected score: ~12/100"
echo "  2. UPS Tracking API (Good) - Expected score: ~60/100"
echo "  3. UPS Tracking API (Improved) - Expected score: ~75/100"
echo ""

# First, clean up any existing demo specs
echo "Cleaning up existing demo specs..."
node scripts/upload_specs_to_postman.js list > /tmp/spec-list.txt
for spec in "Ups Tracking Api Bad" "Ups Tracking Api Good" "Ups Tracking Api Improved"; do
    spec_id=$(grep "$spec" /tmp/spec-list.txt | grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' || true)
    if [ -n "$spec_id" ]; then
        echo "  Deleting existing '$spec'"
        node scripts/upload_specs_to_postman.js delete "$spec_id" > /dev/null 2>&1
    fi
done

# Upload demo specs
echo ""
echo "Uploading demo specifications..."
node scripts/upload_specs_to_postman.js upload api-specs/ups-tracking-api-bad.yaml
node scripts/upload_specs_to_postman.js upload api-specs/ups-tracking-api-good.yaml
node scripts/upload_specs_to_postman.js upload api-specs/ups-tracking-api-improved.yaml

# Also upload one real spec
echo ""
echo "Uploading one real UPS API spec..."
node scripts/upload_specs_to_postman.js reupload api-specs/ups-rating.yaml

echo ""
echo "✓ All demo specs uploaded"
pause

echo "Step 3: Run Governance Scoring"
echo "------------------------------"
echo "Analyzing all APIs in workspace..."
echo ""
node scripts/ups_postman_governance.js --workspace $UPS_WORKSPACE_ID --threshold 70 --json > governance-report.json

# Display summary
echo ""
echo "Governance Summary:"
echo "------------------"
cat governance-report.json | jq -r '.[] | "\(.name): \(.score)/100 - \(.status)"'

# Count pass/fail
total=$(cat governance-report.json | jq '. | length')
passed=$(cat governance-report.json | jq '[.[] | select(.status == "PASS")] | length')
failed=$(cat governance-report.json | jq '[.[] | select(.status == "FAIL")] | length')

echo ""
echo "Total APIs: $total"
echo "Passed: $passed"
echo "Failed: $failed"
echo "Threshold: 70/100"
pause

echo "Step 4: Generate Governance Dashboard"
echo "------------------------------------"
node scripts/ups_postman_governance.js --workspace $UPS_WORKSPACE_ID --threshold 70 --output governance-dashboard.html
echo "✓ Dashboard generated: governance-dashboard.html"
echo ""
echo "Opening dashboard in browser..."
if command -v open >/dev/null 2>&1; then
    open governance-dashboard.html
elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open governance-dashboard.html
else
    echo "Please open governance-dashboard.html manually"
fi
pause

echo "Step 5: Send Teams Notification (Optional)"
echo "-----------------------------------------"
if [ -n "$TEAMS_WEBHOOK_URL" ]; then
    echo "Sending governance summary to Teams..."
    node scripts/teams_notifier.js --batch governance-report.json
    echo "✓ Teams notification sent"
else
    echo "TEAMS_WEBHOOK_URL not set, skipping Teams notification"
    echo "To enable: export TEAMS_WEBHOOK_URL=your-webhook-url"
fi

echo ""
echo "======================================"
echo "Demo Complete!"
echo "======================================"
echo ""
echo "Key Points to Highlight:"
echo "1. Automated API quality scoring (0-100)"
echo "2. Real-time dashboard generation"
echo "3. Quality gates in CI/CD pipeline"
echo "4. Teams notifications for governance alerts"
echo "5. Transform from '3 days review' to '20 minutes automated'"
echo ""
echo "Public Workspace: https://www.postman.com/sudo00/ups-governance-demo/overview"
