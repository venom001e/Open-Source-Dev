import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { RepoFingerprint } from '../types';

export class StackDetectorAgent {
    private model: ChatGoogleGenerativeAI;

    constructor(apiKey: string) {
        this.model = new ChatGoogleGenerativeAI({
            apiKey,
            model: 'gemini-2.0-flash-exp', // Fast model for detection
            temperature: 0,
        });
    }

    async detectStack(repoPath: string): Promise<RepoFingerprint> {
        console.log('Analyzing file tree for stack detection... (MOCKED)');
        return {
            language: "Go",
            runtime: "base",
            packageManager: "go mod",
            installCommand: "go mod download",
            testCommand: "go test ./..."
        } as RepoFingerprint;
    }

    private async generateFileTree(dir: string, depth = 1): Promise<string[]> {
        const files: string[] = [];

        const scan = (currentPath: string, currentDepth: number) => {
            if (currentDepth > depth) return;
            if (files.length > 50) return; // Hard limit to save tokens

            try {
                const items = fs.readdirSync(currentPath);
                for (const item of items) {
                    if (files.length > 50) break;
                    if (item.startsWith('.') || item === 'node_modules' || item === 'dist' || item === 'target' || item === 'build') continue;

                    const fullPath = path.join(currentPath, item);
                    const relativePath = path.relative(dir, fullPath);
                    const stats = fs.statSync(fullPath);

                    if (stats.isDirectory()) {
                        files.push(relativePath + '/');
                        scan(fullPath, currentDepth + 1);
                    } else {
                        files.push(relativePath);
                    }
                }
            } catch (e) {
                // Ignore access errors
            }
        };

        scan(dir, 1);
        return files;
    }
}
