#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Upload OpenAPI specs to Postman Spec Hub
 */

class PostmanSpecUploader {
    constructor(apiKey, workspaceId) {
        this.apiKey = apiKey;
        this.workspaceId = workspaceId;
        this.baseUrl = 'https://api.getpostman.com';
    }

    /**
     * Create a spec in Postman Spec Hub
     */
    async createSpec(name, filePath) {
        try {
            // Read the OpenAPI file
            const content = fs.readFileSync(filePath, 'utf8');
            const fileName = path.basename(filePath);
            
            // Ensure YAML files have proper extension and clean content
            const isYaml = fileName.toLowerCase().endsWith('.yaml') || fileName.toLowerCase().endsWith('.yml');
            const finalFileName = isYaml ? fileName : fileName.replace(/\.[^.]+$/, '.yaml');
            
            const payload = {
                name: name,
                type: 'OPENAPI:3.0',
                files: [{
                    path: finalFileName,
                    content: content.trim()  // Remove leading/trailing whitespace
                }]
            };

            console.log(`Uploading ${fileName} as ${finalFileName} (${content.length} characters)`);

            const response = await fetch(
                `${this.baseUrl}/specs?workspaceId=${this.workspaceId}`,
                {
                    method: 'POST',
                    headers: {
                        'X-API-Key': this.apiKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                }
            );

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Failed to create spec: ${response.status} ${error}`);
            }

            const result = await response.json();
            console.log(`Created spec "${name}" with ID: ${result.id}`);
            return result;

        } catch (error) {
            console.error(`Error creating spec "${name}":`, error.message);
            return null;
        }
    }

    /**
     * List all specs in workspace
     */
    async listSpecs() {
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
                throw new Error(`Failed to list specs: ${response.status}`);
            }

            const result = await response.json();
            return result.specs || [];

        } catch (error) {
            console.error('Error listing specs:', error.message);
            return [];
        }
    }

    /**
     * Delete a spec from Postman
     */
    async deleteSpec(specId) {
        try {
            const response = await fetch(
                `${this.baseUrl}/specs/${specId}`,
                {
                    method: 'DELETE',
                    headers: {
                        'X-API-Key': this.apiKey
                    }
                }
            );

            if (!response.ok && response.status !== 404) {
                throw new Error(`Failed to delete spec: ${response.status}`);
            }

            console.log(`Deleted spec: ${specId}`);
            return true;

        } catch (error) {
            console.error(`Error deleting spec ${specId}:`, error.message);
            return false;
        }
    }

    /**
     * Get spec definition for linting
     */
    async getSpecDefinition(specId) {
        try {
            const response = await fetch(
                `${this.baseUrl}/specs/${specId}/definitions`,
                {
                    headers: {
                        'X-API-Key': this.apiKey
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to get spec definition: ${response.status}`);
            }

            return await response.json();

        } catch (error) {
            console.error(`Error getting spec definition for ${specId}:`, error.message);
            return null;
        }
    }

    /**
     * Generate a collection from a spec
     */
    async generateCollection(specId, name) {
        try {
            const payload = {
                name: name,
                options: {
                    requestNameSource: "Fallback",
                    indentCharacter: "Space",
                    parametersResolution: "Schema",
                    folderStrategy: "Paths",
                    includeAuthInfoInExample: true,
                    enableOptionalParameters: true,
                    keepImplicitHeaders: false,
                    includeDeprecated: true,
                    alwaysInheritAuthentication: false,
                    nestedFolderHierarchy: false
                }
            };

            console.log(`Generating collection for spec ${specId}...`);

            const response = await fetch(
                `${this.baseUrl}/specs/${specId}/generations/collection`,
                {
                    method: 'POST',
                    headers: {
                        'X-API-Key': this.apiKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                }
            );

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Failed to generate collection: ${response.status} ${error}`);
            }

            const result = await response.json();
            console.log(`Collection generation started. Task ID: ${result.taskId}`);
            
            // Poll for task completion
            const collection = await this.pollTaskStatus(specId, result.taskId);
            if (collection) {
                console.log(`Collection "${name}" generated successfully`);
            }
            return collection;

        } catch (error) {
            console.error(`Error generating collection for spec ${specId}:`, error.message);
            return null;
        }
    }

    /**
     * Poll task status until completion
     */
    async pollTaskStatus(specId, taskId, maxAttempts = 30) {
        try {
            for (let i = 0; i < maxAttempts; i++) {
                const response = await fetch(
                    `${this.baseUrl}/specs/${specId}/tasks/${taskId}`,
                    {
                        headers: {
                            'X-API-Key': this.apiKey
                        }
                    }
                );

                if (!response.ok) {
                    throw new Error(`Failed to check task status: ${response.status}`);
                }

                const result = await response.json();
                
                if (result.status === 'completed') {
                    return result;
                } else if (result.status === 'failed') {
                    throw new Error(`Task failed: ${result.error || 'Unknown error'}`);
                }
                
                // Wait 2 seconds before polling again
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            throw new Error('Task timeout - exceeded maximum attempts');

        } catch (error) {
            console.error(`Error polling task ${taskId}:`, error.message);
            return null;
        }
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
Postman Spec Uploader

Usage: node upload_specs_to_postman.js [command] [options]

Commands:
  upload <file>              Upload OpenAPI spec to Postman
  list                       List all specs in workspace
  upload-all                 Upload all specs in api-specs directory
  delete <spec-id>           Delete a spec from Postman
  reupload <file>            Delete and re-upload a spec
  generate-collection <id>   Generate collection from spec ID
  generate-all-collections   Generate collections for all specs

Options:
  --with-collections         Also generate collections when uploading specs

Environment Variables:
  POSTMAN_API_KEY   Postman API key
  UPS_WORKSPACE_ID  Postman workspace ID

Examples:
  node upload_specs_to_postman.js upload api-specs/Tracking.yaml
  node upload_specs_to_postman.js upload-all --with-collections
  node upload_specs_to_postman.js generate-collection 68898e26-1c7d-42bf-8627-a6e842680be3
  node upload_specs_to_postman.js list
        `);
        process.exit(0);
    }

    const apiKey = process.env.POSTMAN_API_KEY;
    const workspaceId = process.env.UPS_WORKSPACE_ID;

    if (!apiKey || !workspaceId) {
        console.error('Error: POSTMAN_API_KEY and UPS_WORKSPACE_ID environment variables required');
        process.exit(1);
    }

    const uploader = new PostmanSpecUploader(apiKey, workspaceId);
    const command = args[0];

    try {
        switch (command) {
            case 'upload':
                const filePath = args[1];
                if (!filePath) {
                    console.error('Error: Please provide file path');
                    process.exit(1);
                }
                
                const name = path.basename(filePath, path.extname(filePath))
                    .replace(/[-_]/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase());
                
                const specResult = await uploader.createSpec(name, filePath);
                
                // Generate collection if requested
                if (specResult && args.includes('--with-collections')) {
                    console.log('\nGenerating collection from spec...');
                    await uploader.generateCollection(specResult.id, name + ' Collection');
                }
                break;

            case 'upload-all':
                const apiSpecsDir = 'api-specs';
                if (!fs.existsSync(apiSpecsDir)) {
                    console.error(`Error: ${apiSpecsDir} directory not found`);
                    process.exit(1);
                }

                const files = fs.readdirSync(apiSpecsDir)
                    .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'))
                    .filter(file => !file.includes('bad') && !file.includes('improved')); // Skip demo files

                console.log(`Found ${files.length} OpenAPI specs to upload...`);
                const withCollections = args.includes('--with-collections');

                for (const file of files) {
                    const filePath = path.join(apiSpecsDir, file);
                    const specName = path.basename(file, path.extname(file))
                        .replace(/[-_]/g, ' ')
                        .replace(/\b\w/g, l => l.toUpperCase());
                    
                    console.log(`Uploading ${file}...`);
                    const specResult = await uploader.createSpec(specName, filePath);
                    
                    // Generate collection if requested
                    if (specResult && withCollections) {
                        console.log(`Generating collection for ${specName}...`);
                        await uploader.generateCollection(specResult.id, specName + ' Collection');
                    }
                    
                    // Rate limiting - wait between requests
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                break;

            case 'list':
                const specs = await uploader.listSpecs();
                console.log(`\nFound ${specs.length} specs in workspace:`);
                specs.forEach(spec => {
                    console.log(`- ${spec.name} (ID: ${spec.id})`);
                });
                break;

            case 'delete':
                const specId = args[1];
                if (!specId) {
                    console.error('Error: Please provide spec ID');
                    process.exit(1);
                }
                await uploader.deleteSpec(specId);
                break;

            case 'reupload':
                const reuploadFile = args[1];
                if (!reuploadFile) {
                    console.error('Error: Please provide file path');
                    process.exit(1);
                }
                
                // Find existing spec with same name
                const existingSpecs = await uploader.listSpecs();
                const reuploadName = path.basename(reuploadFile, path.extname(reuploadFile))
                    .replace(/[-_]/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase());
                
                const existingSpec = existingSpecs.find(s => s.name === reuploadName);
                if (existingSpec) {
                    console.log(`Found existing spec "${existingSpec.name}" (${existingSpec.id}). Deleting...`);
                    await uploader.deleteSpec(existingSpec.id);
                }
                
                console.log(`Re-uploading ${reuploadFile}...`);
                const reuploadResult = await uploader.createSpec(reuploadName, reuploadFile);
                
                // Generate collection if requested
                if (reuploadResult && args.includes('--with-collections')) {
                    console.log('\nGenerating collection from spec...');
                    await uploader.generateCollection(reuploadResult.id, reuploadName + ' Collection');
                }
                break;

            case 'generate-collection':
                const genSpecId = args[1];
                if (!genSpecId) {
                    console.error('Error: Please provide spec ID');
                    process.exit(1);
                }
                
                // Get spec details first
                const allSpecs = await uploader.listSpecs();
                const targetSpec = allSpecs.find(s => s.id === genSpecId);
                
                if (!targetSpec) {
                    console.error(`Error: Spec with ID ${genSpecId} not found`);
                    process.exit(1);
                }
                
                console.log(`Generating collection for "${targetSpec.name}"...`);
                await uploader.generateCollection(genSpecId, targetSpec.name + ' Collection');
                break;

            case 'generate-all-collections':
                const specsForCollections = await uploader.listSpecs();
                console.log(`Found ${specsForCollections.length} specs. Generating collections...`);
                
                for (const spec of specsForCollections) {
                    console.log(`\nGenerating collection for "${spec.name}"...`);
                    await uploader.generateCollection(spec.id, spec.name + ' Collection');
                    
                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
                console.log('\nAll collections generated successfully!');
                break;

            default:
                console.error('Error: Unknown command. Use --help for usage info.');
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

module.exports = PostmanSpecUploader;