#!/usr/bin/env node

/**
 * Update spec-ids.json with current workspace specs
 * This replaces hardcoded IDs with dynamically fetched ones
 */

const fs = require('fs');
const path = require('path');

class SpecIdUpdater {
    constructor(apiKey, workspaceId) {
        this.apiKey = apiKey;
        this.workspaceId = workspaceId;
        this.baseUrl = 'https://api.getpostman.com';
    }

    async fetchSpecs() {
        try {
            const response = await fetch(
                `${this.baseUrl}/specs?workspaceId=${this.workspaceId}`,
                {
                    headers: {
                        'X-API-Key': this.apiKey
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to fetch specs: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return data.specs || [];
        } catch (error) {
            throw new Error(`Failed to fetch workspace specs: ${error.message}`);
        }
    }

    mapSpecsToFiles(specs, apiSpecsDir) {
        // Try to map specs to their corresponding files
        const files = fs.readdirSync(apiSpecsDir)
            .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'));

        return specs.map(spec => {
            // Try to find matching file by name similarity
            const specNameLower = spec.name.toLowerCase().replace(/\s+/g, '-');
            
            const matchingFile = files.find(file => {
                const fileNameLower = path.basename(file, path.extname(file)).toLowerCase();
                return fileNameLower.includes(specNameLower.replace(/[^a-z0-9-]/g, '')) ||
                       specNameLower.includes(fileNameLower.replace(/[^a-z0-9-]/g, ''));
            });

            return {
                name: spec.name,
                id: spec.id,
                file: matchingFile || 'unknown.yaml'
            };
        });
    }

    async updateSpecIds() {
        try {
            console.log('Fetching current specs from Postman workspace...');
            const specs = await this.fetchSpecs();
            console.log(`Found ${specs.length} specs in workspace`);

            const apiSpecsDir = path.join(process.cwd(), 'api-specs');
            const mappedSpecs = this.mapSpecsToFiles(specs, apiSpecsDir);

            const specIds = {
                specs: mappedSpecs,
                workspaceId: this.workspaceId,
                lastUpdated: new Date().toISOString()
            };

            const outputPath = path.join(process.cwd(), 'spec-ids.json');
            fs.writeFileSync(outputPath, JSON.stringify(specIds, null, 2));
            
            console.log(`Updated ${outputPath} with ${specs.length} specs`);
            console.log('Spec mappings:');
            mappedSpecs.forEach(spec => {
                console.log(`  ${spec.name} -> ${spec.file}`);
            });

            return specIds;
        } catch (error) {
            console.error('Error updating spec IDs:', error.message);
            throw error;
        }
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
Update spec-ids.json

Usage: node scripts/update_spec_ids.js

Environment Variables:
  POSTMAN_API_KEY   Postman API key
  UPS_WORKSPACE_ID  Postman workspace ID

This script fetches all specs from the Postman workspace and updates
spec-ids.json with current spec IDs and their mapped file names.
        `);
        process.exit(0);
    }

    const apiKey = process.env.POSTMAN_API_KEY;
    const workspaceId = process.env.UPS_WORKSPACE_ID;

    if (!apiKey || !workspaceId) {
        console.error('Error: POSTMAN_API_KEY and UPS_WORKSPACE_ID environment variables required');
        process.exit(1);
    }

    try {
        const updater = new SpecIdUpdater(apiKey, workspaceId);
        await updater.updateSpecIds();
        console.log('✓ spec-ids.json updated successfully');
    } catch (error) {
        console.error('Failed to update spec-ids.json:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = SpecIdUpdater;
