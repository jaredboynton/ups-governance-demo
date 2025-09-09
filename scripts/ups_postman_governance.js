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
                `POSTMAN_API_KEY="${this.apiKey}" postman spec lint ${specId} 2>&1`
            );
            
            // Check if spec not found or other error
            if (stderr || stdout.includes('Error:')) {
                return { score: 0, error: `Failed to lint spec: ${stderr || stdout}` };
            }

            // Parse the text output to extract violations
            const lines = stdout.split('\n');
            let violations = [];
            
            for (const line of lines) {
                // Look for lines that contain severity indicators
                if (line.includes('│')) {
                    // Check for severity keywords (with or without ANSI codes)
                    const lineClean = line.replace(/\x1b\[[0-9;]*m/g, ''); // Remove ANSI codes
                    
                    if (lineClean.includes('ERROR')) {
                        violations.push({ severity: 'error' });
                    } else if (lineClean.includes('WARNING')) {
                        violations.push({ severity: 'warning' });
                    } else if (lineClean.includes('INFO')) {
                        violations.push({ severity: 'info' });
                    } else if (lineClean.includes('HINT')) {
                        violations.push({ severity: 'hint' });
                    }
                }
            }
            
            // Calculate score using Postman's governance violation format
            let score = 100;
            
            violations.forEach(violation => {
                const severity = violation.severity || 'hint';
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
     * Note: This is deprecated, use scoreSpecViaPostman instead
     */
    async scoreApiViaPostman(apiId) {
        // Forward to spec linting
        return this.scoreSpecViaPostman(apiId);
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
    generateDashboard(report, workspaceId) {
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
        .score.invalid {
            background: #d9534f;
            color: white;
            font-size: 1.2em;
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
        .status.invalid {
            background: #d9534f;
            color: white;
            font-weight: 700;
        }
        .postman-btn {
            background: #FF6C37;
            color: white;
            padding: 6px 12px;
            border-radius: 6px;
            text-decoration: none;
            font-size: 0.85em;
            font-weight: 600;
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 5px;
            margin-left: 10px;
        }
        .postman-btn:hover {
            background: #E85A2A;
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(255, 108, 55, 0.3);
        }
        .postman-btn svg {
            width: 16px;
            height: 16px;
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
            ${report.map(api => {
                const isInvalid = api.score === 0;
                const scoreClass = isInvalid ? 'invalid' : api.status.toLowerCase();
                const postmanUrl = api.id ? 
                    `https://www.postman.com/sudo00/ups-governance-demo/specification/${api.id}` : 
                    '#';
                return `
                <div class="api">
                    <div class="api-name">${api.name}</div>
                    <div class="api-score">
                        <div class="violations">${isInvalid ? 'Invalid specification' : api.violationsCount + ' violations'}</div>
                        <div class="score ${scoreClass}">${isInvalid ? 'Invalid' : api.score + '/100'}</div>
                        <div class="status ${scoreClass}">${isInvalid ? 'INVALID SPEC' : api.status}</div>
                        ${api.id ? `
                        <a href="${postmanUrl}" target="_blank" class="postman-btn">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.527.099C6.955-.744.942 3.9.099 10.473c-.843 6.572 3.8 12.584 10.373 13.428 6.573.843 12.587-3.801 13.428-10.374C24.744 6.955 20.101.943 13.527.099zm2.471 7.485a.855.855 0 0 0-.593.25l-4.453 4.453-.307-.307-.643-.643c4.389-4.376 5.18-4.418 5.996-3.753zm-4.863 4.861l4.44-4.44a.62.62 0 1 1 .847.903l-4.699 4.125-.588-.588zm.33.694l-1.1.238a.06.06 0 0 1-.067-.032.06.06 0 0 1 .01-.073l.645-.645.512.512zm-2.803-.459l1.172-1.172.879.878-1.979.426a.074.074 0 0 1-.085-.039.072.072 0 0 1 .013-.093zm-3.646 6.058a.076.076 0 0 1-.069-.083.077.077 0 0 1 .022-.046h.002l.946-.946 1.222 1.222-2.123-.147zm2.425-1.256a.228.228 0 0 0-.117.256l.203.865a.125.125 0 0 1-.211.117l-.003-.003-.934-.934 2.267-2.267.833.834-.041.596a.227.227 0 0 0 .201.258l.862.053a.125.125 0 0 1 .002.247l-.992.049a.222.222 0 0 0-.21.185l-.075.523a.125.125 0 0 1-.248.002l-.377-.927a.227.227 0 0 0-.252-.155l-.755.186a.125.125 0 0 1-.125-.211l.836-.77a.228.228 0 0 0 .043-.322l-.526-.874a.125.125 0 0 1 .182-.181l.868.527a.225.225 0 0 0 .318-.047l.694-.771a.125.125 0 0 1 .215.093l-.193.755a.224.224 0 0 0 .155.252l.924.375a.125.125 0 0 1-.002.25l-.848.075z"/></svg>
                            View in Postman
                        </a>
                        ` : ''}
                    </div>
                </div>
            `}).join('')}
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
            const dashboard = scorer.generateDashboard(report, workspaceId);
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