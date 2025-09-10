#!/usr/bin/env node

const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');
const execPromise = util.promisify(exec);

/**
 * UPS Postman Governance Scorer
 * Analyzes API specifications for governance compliance
 */


class GovernanceScorer {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    /**
     * Score a spec file using Postman CLI governance linting
     */
    async scoreSpecFile(specPath) {
        try {
            let stdout = '';
            let stderr = '';
            
            try {
                const result = await execPromise(
                    `POSTMAN_API_KEY="${this.apiKey}" postman api lint "${specPath}" 2>&1`
                );
                stdout = result.stdout;
                stderr = result.stderr;
            } catch (error) {
                // Command exited with non-zero code, but we still want the output
                stdout = error.stdout || error.message || '';
                stderr = error.stderr || '';
            }
            
            // Check if file not found or parsing error
            if (stdout.includes('Error:') && stdout.includes("Couldn't parse")) {
                return { score: 0, error: `Failed to parse API specification` };
            }

            let violations = [];
            
            // Parse text output format from postman api lint
            // First remove ANSI color codes
            const cleanOutput = stdout.replace(/\x1b\[[0-9;]*m/g, '');
            const lines = cleanOutput.split('\n');
            
            // Look for the summary line with the count of problems (may have a symbol at the start)
            const summaryRegex = /.*?(\d+)\s+problems?\s*\((\d+)\s+errors?,\s*(\d+)\s+warnings?,\s*(\d+)\s+infos?,\s*(\d+)\s+hints?\)/;
            const summaryMatch = cleanOutput.match(summaryRegex);
            
            if (summaryMatch) {
                const [, total, errors, warnings, infos, hints] = summaryMatch;
                
                // Create violations array based on counts
                for (let i = 0; i < parseInt(errors); i++) {
                    violations.push({ severity: 'error' });
                }
                for (let i = 0; i < parseInt(warnings); i++) {
                    violations.push({ severity: 'warning' });
                }
                for (let i = 0; i < parseInt(infos); i++) {
                    violations.push({ severity: 'info' });
                }
                for (let i = 0; i < parseInt(hints); i++) {
                    violations.push({ severity: 'hint' });
                }
            } else {
                // Fallback: Parse table rows for violations
                for (const line of lines) {
                    if (line.includes('│')) {
                        const lineClean = line.replace(/\x1b\[[0-9;]*m/g, ''); // Remove ANSI codes
                        
                        // Skip header rows
                        if (lineClean.includes('Range') || lineClean.includes('Severity') || lineClean.includes('─')) {
                            continue;
                        }
                        
                        // Look for severity indicators in the table
                        if (lineClean.includes('ERROR')) {
                            violations.push({ severity: 'error' });
                        } else if (lineClean.includes('WARN')) {
                            violations.push({ severity: 'warning' });
                        } else if (lineClean.includes('INFO')) {
                            violations.push({ severity: 'info' });
                        } else if (lineClean.includes('HINT')) {
                            violations.push({ severity: 'hint' });
                        }
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
     * Get governance report for all specs in a directory
     */
    async getDirectoryGovernanceReport(dirPath, threshold = 70) {
        try {
            const specsDir = path.resolve(dirPath);
            
            if (!fs.existsSync(specsDir)) {
                throw new Error(`Directory not found: ${specsDir}`);
            }
            
            // Get all YAML and JSON files in the directory
            const files = fs.readdirSync(specsDir);
            const specFiles = files.filter(file => {
                const ext = path.extname(file).toLowerCase();
                return ext === '.yaml' || ext === '.yml' || ext === '.json';
            });
            
            if (specFiles.length === 0) {
                throw new Error(`No spec files found in ${specsDir}`);
            }
            
            const governanceReport = [];
            
            for (const file of specFiles) {
                const specPath = path.join(specsDir, file);
                const specName = path.basename(file, path.extname(file));
                
                try {
                    const result = await this.scoreSpecFile(specPath);
                    governanceReport.push({
                        name: specName,
                        path: specPath,
                        score: result.score,
                        violationsCount: result.violationCount || 0,
                        status: result.score >= threshold ? 'PASS' : 'FAIL',
                        error: result.error
                    });
                } catch (error) {
                    console.warn(`Failed to score spec ${specName}: ${error.message}`);
                    governanceReport.push({
                        name: specName,
                        path: specPath,
                        score: 0,
                        violationsCount: 0,
                        status: 'FAIL',
                        error: `Failed to score: ${error.message}`
                    });
                }
            }
            
            return governanceReport;
        } catch (error) {
            throw new Error(`Failed to get directory governance report: ${error.message}`);
        }
    }


    /**
     * Generate HTML dashboard for governance report
     */
    generateDashboard(report) {
        const timestamp = new Date().toISOString();
        const passCount = report.filter(api => api.status === 'PASS').length;
        const failCount = report.filter(api => api.status === 'FAIL').length;
        const avgScore = report.length > 0 ? report.reduce((sum, api) => sum + api.score, 0) / report.length : 0;

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
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
            position: relative;
            text-align: center;
        }
        .header-logo {
            position: absolute;
            left: 30px;
            top: 50%;
            transform: translateY(-50%);
            width: 100px;
            height: auto;
            filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
        }
        .header-content {
            display: inline-block;
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
            <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/United_Parcel_Service_logo_2014.svg" 
                 alt="UPS Logo" 
                 class="header-logo">
            <div class="header-content">
                <h1>UPS API Governance Dashboard</h1>
                <div class="subtitle">Real-time API Quality Monitoring</div>
            </div>
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
                return `
                <div class="api">
                    <div class="api-name">${api.name}</div>
                    <div class="api-score">
                        <div class="violations">${isInvalid ? 'Invalid specification' : api.violationsCount + ' violations'}</div>
                        <div class="score ${scoreClass}">${isInvalid ? 'Invalid' : api.score + '/100'}</div>
                        <div class="status ${scoreClass}">${isInvalid ? 'INVALID SPEC' : api.status}</div>
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

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// CLI Interface
async function main() {
    const argv = yargs(hideBin(process.argv))
        .usage('UPS Postman Governance Scorer\n\nUsage: $0 [options]')
        .option('dir', {
            alias: 'd',
            describe: 'Directory containing spec files',
            type: 'string',
            default: './api-specs'
        })
        .option('api', {
            alias: 'a',
            describe: 'Single API file path to analyze',
            type: 'string'
        })
        .option('threshold', {
            alias: 't',
            describe: 'Minimum score threshold',
            type: 'number',
            default: 70
        })
        .option('output', {
            alias: 'o',
            describe: 'Output HTML dashboard to file',
            type: 'string'
        })
        .option('json', {
            alias: 'j',
            describe: 'Output raw JSON instead of dashboard',
            type: 'boolean',
            default: false
        })
        .help('help')
        .alias('help', 'h')
        .argv;

    const apiKey = process.env.POSTMAN_API_KEY;
    if (!apiKey) {
        console.error('Error: POSTMAN_API_KEY environment variable not set');
        process.exit(1);
    }

    const scorer = new GovernanceScorer(apiKey);
    
    const { dir: specDir, api: apiFile, threshold, output: outputFile, json: jsonOutput } = argv;

    try {
        let report;
        
        if (apiFile) {
            // Score single API file
            const result = await scorer.scoreSpecFile(apiFile);
            const specName = path.basename(apiFile, path.extname(apiFile));
            report = [{
                name: specName,
                path: apiFile,
                score: result.score,
                violationsCount: result.violationCount || 0,
                status: result.score >= threshold ? 'PASS' : 'FAIL'
            }];
        } else {
            // Score all specs in directory
            report = await scorer.getDirectoryGovernanceReport(specDir, threshold);
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