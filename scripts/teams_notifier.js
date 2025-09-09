#!/usr/bin/env node

/**
 * Teams Notification Script for UPS API Governance
 * Sends adaptive cards to Microsoft Teams channels
 */

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

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
    const argv = yargs(hideBin(process.argv))
        .usage('Teams Notifier for UPS API Governance\n\nUsage: $0 [options]')
        .option('webhook', {
            alias: 'w',
            describe: 'Teams webhook URL (or TEAMS_WEBHOOK_URL env var)',
            type: 'string'
        })
        .option('api', {
            alias: 'a',
            describe: 'API name',
            type: 'string'
        })
        .option('score', {
            alias: 's',
            describe: 'Quality score (0-100)',
            type: 'number'
        })
        .option('violations', {
            alias: 'v',
            describe: 'Number of violations',
            type: 'number'
        })
        .option('link', {
            alias: 'l',
            describe: 'Postman link for the API',
            type: 'string'
        })
        .option('batch', {
            alias: 'b',
            describe: 'Send batch summary from JSON file',
            type: 'string'
        })
        .example('$0 --webhook https://... --api "Tracking API" --score 85 --violations 3', 'Single API notification')
        .example('$0 --webhook https://... --batch results.json', 'Batch summary')
        .help()
        .alias('help', 'h')
        .check((argv) => {
            if (!argv.webhook && !process.env.TEAMS_WEBHOOK_URL) {
                throw new Error('Teams webhook URL required (use --webhook or TEAMS_WEBHOOK_URL env var)');
            }
            if (!argv.batch && !argv.api) {
                throw new Error('Must specify either --batch or --api for single notification');
            }
            return true;
        })
        .argv;

    const webhookUrl = argv.webhook || process.env.TEAMS_WEBHOOK_URL;
    const notifier = new TeamsNotifier(webhookUrl);

    if (argv.batch) {
        // Send batch summary
        const fs = require('fs');
        
        try {
            const results = JSON.parse(fs.readFileSync(argv.batch, 'utf8'));
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
        const apiName = argv.api || 'Unknown API';
        const score = argv.score || 0;
        const violations = argv.violations || 0;
        const link = argv.link;
        
        const success = await notifier.sendGovernanceNotification(
            apiName,
            score,
            violations,
            link,
            {
                submittedBy: process.env.USER || process.env.BUILD_REQUESTEDFOR || 'System',
                reportUrl: process.env.BUILD_URL || process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI
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