#!/usr/bin/env node

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * UPS Postman Governance Scorer
 * Uses Postman Enterprise API to get governance report and score
 */

class GovernanceScorer {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.getpostman.com';
    }

    /**
     * Score a spec using Postman CLI governance linting
     */
    async scoreSpecViaPostman(specId) {
        try {
            const { stdout, stderr } = await execPromise(
                `postman spec lint ${specId} -o json`
            );
            
            if (stderr && !stdout) {
                return { score: 0, error: `Failed to lint spec: ${stderr}` };
            }

            const lintResult = JSON.parse(stdout);
            const violations = lintResult.violations || [];
            
            // Calculate score using Postman's governance violation format
            let score = 100;
            
            violations.forEach(violation => {
                const severity = violation.severity?.toLowerCase() || 'hint';
                switch(severity) {
                    case 'error':
                        score -= 10;
                        break;
                    case 'warning':
                    case 'warn':
                        score -= 5;
                        break;
                    case 'info':
                        score -= 2;
                        break;
                    default: // hint
                        score -= 1;
                }
            });
            
            return {
                score: Math.max(0, score),
                violations: violations,
                violationCount: violations.length
            };
        } catch (error) {
            return { score: 0, error: error.message };
        }
    }

    /**
     * Score an API using legacy Postman CLI (backwards compatibility)
     */
    async scoreApiViaPostman(apiId) {
        try {
            const { stdout, stderr } = await execPromise(
                `postman api lint ${apiId} --format json`
            );
            
            if (stderr && !stdout) {
                return { score: 0, error: `Failed to lint API: ${stderr}` };
            }

            const violations = JSON.parse(stdout);
            
            // Calculate score using Postman's governance violation format
            let score = 100;
            
            violations.forEach(violation => {
                const severity = violation.severity || 'hint';
                switch(severity) {
                    case 'error':
                        score -= 10;
                        break;
                    case 'warn':
                        score -= 5;
                        break;
                    case 'info':
                        score -= 2;
                        break;
                    default: // hint
                        score -= 1;
                }
            });
            
            return {
                score: Math.max(0, score),
                violations: violations,
                violationCount: violations.length
            };
        } catch (error) {
            return { score: 0, error: error.message };
        }
    }

    /**
     * Get governance report for all specs in a workspace
     */
    async getWorkspaceGovernanceReport(workspaceId) {
        try {
            // Get all specs in workspace using Postman Specs API
            const response = await fetch(
                `${this.baseUrl}/specs?workspaceId=${workspaceId}`,
                {
                    headers: {
                        'X-API-Key': this.apiKey
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to fetch workspace specs: ${response.statusText}`);
            }

            const data = await response.json();
            const specs = data.specs || [];
            
            const governanceReport = [];
            
            for (const spec of specs) {
                const result = await this.scoreSpecViaPostman(spec.id);
                governanceReport.push({
                    name: spec.name,
                    id: spec.id,
                    score: result.score,
                    violationsCount: result.violationCount || 0,
                    status: result.score >= 70 ? 'PASS' : 'FAIL',
                    error: result.error
                });
            }
            
            return governanceReport;
        } catch (error) {
            throw new Error(`Failed to get workspace governance report: ${error.message}`);
        }
    }

    /**
     * Generate HTML dashboard for governance report
     */
    generateDashboard(report) {
        const timestamp = new Date().toISOString();
        const passCount = report.filter(api => api.status === 'PASS').length;
        const failCount = report.filter(api => api.status === 'FAIL').length;
        const avgScore = report.reduce((sum, api) => sum + api.score, 0) / report.length;

        return `
<!DOCTYPE html>
<html>
<head>
    <title>UPS API Governance Dashboard</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #351C15 0%, #4a2518 100%);
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            box-shadow: 0 25px 70px rgba(0, 0, 0, 0.4);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #FFB500, #e6a200);
            color: #351C15;
            padding: 30px;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 600;
        }
        .header .subtitle {
            margin-top: 10px;
            opacity: 0.9;
            font-size: 1.1em;
        }
        .stats {
            display: flex;
            justify-content: space-around;
            padding: 30px;
            background: #fef9f3;
            border-bottom: 1px solid #e9ecef;
        }
        .stat {
            text-align: center;
        }
        .stat-value {
            font-size: 2.5em;
            font-weight: bold;
            color: #351C15;
        }
        .stat-label {
            color: #7a5c4a;
            margin-top: 5px;
            text-transform: uppercase;
            font-size: 0.85em;
            letter-spacing: 1px;
        }
        .apis {
            padding: 30px;
        }
        .api {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            margin-bottom: 15px;
            background: white;
            border: 2px solid #f5e6d3;
            border-radius: 12px;
            transition: all 0.3s ease;
        }
        .api:hover {
            box-shadow: 0 5px 15px rgba(53, 28, 21, 0.2);
            transform: translateY(-2px);
            border-color: #FFB500;
        }
        .api-name {
            font-weight: 600;
            font-size: 1.1em;
            color: #351C15;
        }
        .api-score {
            display: flex;
            align-items: center;
            gap: 20px;
        }
        .score {
            font-size: 1.5em;
            font-weight: bold;
            padding: 8px 16px;
            border-radius: 8px;
        }
        .score.pass {
            background: #FFB500;
            color: #351C15;
        }
        .score.fail {
            background: #f5e6d3;
            color: #351C15;
        }
        .violations {
            color: #7a5c4a;
            font-size: 0.9em;
        }
        .status {
            padding: 6px 12px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 0.85em;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .status.pass {
            background: #FFB500;
            color: #351C15;
        }
        .status.fail {
            background: #351C15;
            color: white;
        }
        .timestamp {
            text-align: center;
            color: #7a5c4a;
            padding: 20px;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>UPS API Governance Dashboard</h1>
            <div class="subtitle">Real-time API Quality Monitoring</div>
        </div>
        
        <div class="stats">
            <div class="stat">
                <div class="stat-value">${report.length}</div>
                <div class="stat-label">Total APIs</div>
            </div>
            <div class="stat">
                <div class="stat-value" style="color: #FFB500">${passCount}</div>
                <div class="stat-label">Passing</div>
            </div>
            <div class="stat">
                <div class="stat-value" style="color: #351C15">${failCount}</div>
                <div class="stat-label">Failing</div>
            </div>
            <div class="stat">
                <div class="stat-value">${avgScore.toFixed(1)}</div>
                <div class="stat-label">Avg Score</div>
            </div>
        </div>
        
        <div class="apis">
            ${report.map(api => `
                <div class="api">
                    <div class="api-name">${api.name}</div>
                    <div class="api-score">
                        <div class="violations">${api.violationsCount} violations</div>
                        <div class="score ${api.status.toLowerCase()}">${api.score}/100</div>
                        <div class="status ${api.status.toLowerCase()}">${api.status}</div>
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div class="timestamp">
            Generated at ${timestamp}
        </div>
    </div>
</body>
</html>`;
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
UPS Postman Governance Scorer

Usage: node ups_postman_governance.js [options]

Options:
  --workspace <id>    Workspace ID to analyze
  --spec <id>         Single spec ID to analyze
  --api <id>          Single API ID to analyze (legacy)
  --threshold <n>     Minimum score threshold (default: 70)
  --output <file>     Output HTML dashboard to file
  --json              Output raw JSON instead of dashboard
  --help              Show this help message
        `);
        process.exit(0);
    }

    const apiKey = process.env.POSTMAN_API_KEY;
    if (!apiKey) {
        console.error('Error: POSTMAN_API_KEY environment variable not set');
        process.exit(1);
    }

    const scorer = new GovernanceScorer(apiKey);
    
    const workspaceId = args[args.indexOf('--workspace') + 1];
    const specId = args[args.indexOf('--spec') + 1];
    const apiId = args[args.indexOf('--api') + 1];  // Legacy support
    const threshold = parseInt(args[args.indexOf('--threshold') + 1]) || 70;
    const outputFile = args[args.indexOf('--output') + 1];
    const jsonOutput = args.includes('--json');

    try {
        let report;
        
        if (specId && args.includes('--spec')) {
            // Score single spec
            const result = await scorer.scoreSpecViaPostman(specId);
            report = [{
                name: 'Spec',
                id: specId,
                score: result.score,
                violationsCount: result.violationCount || 0,
                status: result.score >= threshold ? 'PASS' : 'FAIL'
            }];
        } else if (apiId && args.includes('--api')) {
            // Score single API (legacy)
            const result = await scorer.scoreApiViaPostman(apiId);
            report = [{
                name: 'API',
                id: apiId,
                score: result.score,
                violationsCount: result.violationCount || 0,
                status: result.score >= threshold ? 'PASS' : 'FAIL'
            }];
        } else if (workspaceId && args.includes('--workspace')) {
            // Score entire workspace
            report = await scorer.getWorkspaceGovernanceReport(workspaceId);
        } else {
            console.error('Error: Please specify --workspace, --spec, or --api');
            process.exit(1);
        }

        // Check threshold
        const failing = report.filter(api => api.score < threshold);
        if (failing.length > 0) {
            console.error(`\n[FAILED] ${failing.length} APIs below threshold of ${threshold}:`);
            failing.forEach(api => {
                console.error(`  - ${api.name}: ${api.score}/100`);
            });
        }

        // Output results
        if (jsonOutput) {
            console.log(JSON.stringify(report, null, 2));
        } else {
            const dashboard = scorer.generateDashboard(report);
            if (outputFile) {
                const fs = require('fs');
                fs.writeFileSync(outputFile, dashboard);
                console.log(`Dashboard saved to ${outputFile}`);
            } else {
                console.log(dashboard);
            }
        }

        // Exit with error if any APIs fail threshold
        if (failing.length > 0) {
            process.exit(1);
        }
        
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = GovernanceScorer;