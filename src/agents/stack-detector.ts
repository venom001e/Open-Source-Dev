import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { z } from 'zod';
import fs from 'fs/promises';
import { existsSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { RepoFingerprint } from '../types';
import { logger } from '../utils/logger';
import { GeminiService } from './gemini';

export class StackDetectorAgent {
    private service: GeminiService;
    private model: ChatGoogleGenerativeAI;

    constructor(apiKey: string) {
        this.service = new GeminiService(apiKey);
        this.model = this.service.getModel(); // Uses default gemini-2.5-flash
    }

    /**
     * Detects the project's technology stack by analyzing the file structure and key configuration files.
     */
    async detectStack(repoPath: string): Promise<RepoFingerprint> {
        const fileTree = await this.generateFileTree(repoPath);

        // Read contents of key files for deep analysis
        const configFiles = ['package.json', 'go.mod', 'requirements.txt', 'pyproject.toml', 'manage.py', 'Cargo.toml', 'Gemfile'];
        const configContents: Record<string, string> = {};

        for (const file of configFiles) {
            const fullPath = path.join(repoPath, file);
            if (existsSync(fullPath)) {
                try {
                    const content = await fs.readFile(fullPath, 'utf8');
                    configContents[file] = content.substring(0, 1500); // Increased limit for better context
                } catch (error: any) {
                    logger.warn(`Could not read config file ${file}: ${error.message}`);
                }
            }
        }

        const schemaDescription = `
        {
          "language": "string",
          "runtime": "string",
          "packageManager": "string",
          "installCommand": "string",
          "testCommand": "string",
          "dependencies": ["string"]
        }`;

        const prompt = `You are a Senior Systems Architect auditing a repository to prepare an automated development environment.
        
Analyze the following file tree and configuration file previews to determine the exact project stack.

FILE TREE:
${fileTree.join('\n')}

CONFIGURATION PREVIEWS:
${Object.entries(configContents).map(([f, c]) => `--- ${f} ---\n${c}`).join('\n\n')}

INSTRUCTIONS:
1. Identify the primary programming language.
2. Determine the best runtime environment for an Ubuntu-based sandbox.
3. Provide the exact commands needed to install dependencies and run tests.
4. List critical dependencies that might require system-level tools.

Ensure the commands provided are robust and assume a fresh environment.`;

        try {
            const result = await this.service.invokeJSON<RepoFingerprint>(this.model, prompt, schemaDescription);
            return result;
        } catch (error: any) {
            logger.error(`AI stack detection failed: ${error.message}. Executing fallback heuristics...`);
            return this.heuristicFallback(fileTree);
        }
    }

    /**
     * Fallback logic using simple heuristics when AI analysis is unavailable.
     */
    private heuristicFallback(fileTree: string[]): RepoFingerprint {
        const treeStr = fileTree.join(' ');

        if (treeStr.includes('requirements.txt') || treeStr.includes('pyproject.toml')) {
            return {
                language: "Python",
                runtime: "python",
                packageManager: "pip",
                installCommand: "pip install -r requirements.txt",
                testCommand: "pytest"
            };
        }

        if (treeStr.includes('package.json')) {
            return {
                language: "TypeScript/JavaScript",
                runtime: "node",
                packageManager: "npm",
                installCommand: "npm install",
                testCommand: "npm test"
            };
        }

        if (treeStr.includes('go.mod')) {
            return {
                language: "Go",
                runtime: "go",
                packageManager: "go mod",
                installCommand: "go mod download",
                testCommand: "go test ./..."
            };
        }

        return {
            language: "Unknown",
            runtime: "ubuntu",
            packageManager: "none",
            installCommand: "true",
            testCommand: "true"
        };
    }

    /**
     * Generates a shallow file tree of the repository for context.
     */
    private async generateFileTree(dir: string, depth = 2): Promise<string[]> {
        const files: string[] = [];

        const scan = (currentPath: string, currentDepth: number) => {
            if (currentDepth > depth || files.length > 60) return;

            try {
                const items = readdirSync(currentPath);
                for (const item of items) {
                    if (files.length > 60) break;

                    // Filter out noise
                    if (item.startsWith('.') ||
                        ['node_modules', 'dist', 'target', 'build', 'venv', '.git'].includes(item)) {
                        continue;
                    }

                    const fullPath = path.join(currentPath, item);
                    const relativePath = path.relative(dir, fullPath);
                    const stats = statSync(fullPath);

                    if (stats.isDirectory()) {
                        files.push(relativePath + path.sep);
                        scan(fullPath, currentDepth + 1);
                    } else {
                        files.push(relativePath);
                    }
                }
            } catch (e) {
                // Silent ignore for permission issues
            }
        };

        scan(dir, 1);
        return files;
    }
}
