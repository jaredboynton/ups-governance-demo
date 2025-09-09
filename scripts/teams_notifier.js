#!/usr/bin/env node

/**
 * Teams Notification Script for UPS API Governance
 * Sends adaptive cards to Microsoft Teams channels
 */

class TeamsNotifier {
    constructor(webhookUrl) {
        this.webhookUrl = webhookUrl;
    }

    /**
     * Send governance notification to Teams
     */
    async sendGovernanceNotification(apiName, score, violationsCount, postmanLink, details = {}) {
        const status = score >= 70 ? 'Ready for Review' : 'Rejected - Below Threshold';
        const statusColor = score >= 70 ? 'Good' : 'Attention';
        const statusIcon = score >= 70 ? '[PASS]' : '[FAIL]';

        const payload = {
            type: 'message',
            attachments: [{
                contentType: 'application/vnd.microsoft.card.adaptive',
                contentUrl: null,
                content: {
                    type: 'AdaptiveCard',
                    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
                    version: '1.3',
                    body: [
                        {
                            type: 'TextBlock',
                            text: 'API Governance Review Required',
                            weight: 'Bolder',
                            size: 'Large',
                            color: statusColor
                        },
                        {
                            type: 'TextBlock',
                            text: `${statusIcon} ${status}`,
                            weight: 'Bolder',
                            size: 'Medium',
                            spacing: 'Small',
                            color: statusColor
                        },
                        {
                            type: 'FactSet',
                            facts: [
                                {
                                    title: 'API Name:',
                                    value: apiName
                                },
                                {
                                    title: 'Quality Score:',
                                    value: `${score}/100`
                                },
                                {
                                    title: 'Violations:',
                                    value: violationsCount.toString()
                                },
                                {
                                    title: 'Submitted By:',
                                    value: details.submittedBy || 'System'
                                },
                                {
                                    title: 'Timestamp:',
                                    value: new Date().toLocaleString()
                                }
                            ]
                        }
                    ],
                    actions: [
                        {
                            type: 'Action.OpenUrl',
                            title: 'Review in Postman',
                            url: postmanLink || 'https://app.getpostman.com'
                        },
                        {
                            type: 'Action.OpenUrl',
                            title: 'View Full Report',
                            url: details.reportUrl || 'https://dev.azure.com'
                        }
                    ]
                }
            }]
        };

        try {
            const response = await fetch(this.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Teams webhook failed: ${response.status} ${response.statusText}`);
            }

            return true;
        } catch (error) {
            console.error('Failed to send Teams notification:', error.message);
            return false;
        }
    }

    /**
     * Send batch summary notification
     */
    async sendBatchSummary(results) {
        const totalApis = results.length;
        const passedApis = results.filter(r => r.score >= 70).length;
        const failedApis = totalApis - passedApis;
        const avgScore = results.reduce((sum, r) => sum + r.score, 0) / totalApis;

        const payload = {
            type: 'message',
            attachments: [{
                contentType: 'application/vnd.microsoft.card.adaptive',
                contentUrl: null,
                content: {
                    type: 'AdaptiveCard',
                    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
                    version: '1.3',
                    body: [
                        {
                            type: 'TextBlock',
                            text: 'API Governance Batch Report',
                            weight: 'Bolder',
                            size: 'Large'
                        },
                        {
                            type: 'ColumnSet',
                            columns: [
                                {
                                    type: 'Column',
                                    width: 'stretch',
                                    items: [
                                        {
                                            type: 'TextBlock',
                                            text: totalApis.toString(),
                                            weight: 'Bolder',
                                            size: 'ExtraLarge',
                                            color: 'Accent'
                                        },
                                        {
                                            type: 'TextBlock',
                                            text: 'Total APIs',
                                            spacing: 'None'
                                        }
                                    ]
                                },
                                {
                                    type: 'Column',
                                    width: 'stretch',
                                    items: [
                                        {
                                            type: 'TextBlock',
                                            text: passedApis.toString(),
                                            weight: 'Bolder',
                                            size: 'ExtraLarge',
                                            color: 'Good'
                                        },
                                        {
                                            type: 'TextBlock',
                                            text: 'Passed',
                                            spacing: 'None'
                                        }
                                    ]
                                },
                                {
                                    type: 'Column',
                                    width: 'stretch',
                                    items: [
                                        {
                                            type: 'TextBlock',
                                            text: failedApis.toString(),
                                            weight: 'Bolder',
                                            size: 'ExtraLarge',
                                            color: failedApis > 0 ? 'Attention' : 'Default'
                                        },
                                        {
                                            type: 'TextBlock',
                                            text: 'Failed',
                                            spacing: 'None'
                                        }
                                    ]
                                },
                                {
                                    type: 'Column',
                                    width: 'stretch',
                                    items: [
                                        {
                                            type: 'TextBlock',
                                            text: avgScore.toFixed(1),
                                            weight: 'Bolder',
                                            size: 'ExtraLarge',
                                            color: 'Accent'
                                        },
                                        {
                                            type: 'TextBlock',
                                            text: 'Avg Score',
                                            spacing: 'None'
                                        }
                                    ]
                                }
                            ]
                        },
                        {
                            type: 'TextBlock',
                            text: 'API Details',
                            weight: 'Bolder',
                            size: 'Medium',
                            spacing: 'Large'
                        },
                        ...results.slice(0, 5).map(api => ({
                            type: 'TextBlock',
                            text: `• ${api.name}: ${api.score}/100 - ${api.score >= 70 ? '[PASS]' : '[FAIL]'}`,
                            spacing: 'Small',
                            color: api.score >= 70 ? 'Good' : 'Attention'
                        }))
                    ],
                    actions: [
                        {
                            type: 'Action.OpenUrl',
                            title: 'View Full Dashboard',
                            url: 'https://dev.azure.com'
                        }
                    ]
                }
            }]
        };

        try {
            const response = await fetch(this.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            return response.ok;
        } catch (error) {
            console.error('Failed to send batch summary:', error.message);
            return false;
        }
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
Teams Notifier for UPS API Governance

Usage: node teams_notifier.js [options]

Options:
  --webhook <url>     Teams webhook URL (or TEAMS_WEBHOOK_URL env var)
  --api <name>        API name
  --score <n>         Quality score (0-100)
  --violations <n>    Number of violations
  --link <url>        Postman link for the API
  --batch <file>      Send batch summary from JSON file
  --help              Show this help message

Examples:
  # Single API notification
  node teams_notifier.js --webhook https://... --api "Tracking API" --score 85 --violations 3

  # Batch summary
  node teams_notifier.js --webhook https://... --batch results.json
        `);
        process.exit(0);
    }

    const webhookUrl = args[args.indexOf('--webhook') + 1] || process.env.TEAMS_WEBHOOK_URL;
    
    if (!webhookUrl) {
        console.error('Error: Teams webhook URL not provided (use --webhook or TEAMS_WEBHOOK_URL env var)');
        process.exit(1);
    }

    const notifier = new TeamsNotifier(webhookUrl);

    if (args.includes('--batch')) {
        // Send batch summary
        const batchFile = args[args.indexOf('--batch') + 1];
        const fs = require('fs');
        
        try {
            const results = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
            const success = await notifier.sendBatchSummary(results);
            
            if (success) {
                console.log('Batch summary sent successfully');
            } else {
                console.error('Failed to send batch summary');
                process.exit(1);
            }
        } catch (error) {
            console.error('Error reading batch file:', error.message);
            process.exit(1);
        }
    } else {
        // Send single API notification
        const apiName = args[args.indexOf('--api') + 1] || 'Unknown API';
        const score = parseInt(args[args.indexOf('--score') + 1]) || 0;
        const violations = parseInt(args[args.indexOf('--violations') + 1]) || 0;
        const link = args[args.indexOf('--link') + 1];
        
        const success = await notifier.sendGovernanceNotification(
            apiName,
            score,
            violations,
            link,
            {
                submittedBy: process.env.USER || 'System',
                reportUrl: process.env.BUILD_URL
            }
        );
        
        if (success) {
            console.log(`Notification sent for ${apiName} (Score: ${score}/100)`);
        } else {
            console.error('Failed to send notification');
            process.exit(1);
        }
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = TeamsNotifier;