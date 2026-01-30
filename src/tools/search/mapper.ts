import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { logger } from '../../utils/logger';

/**
 * Generates a semantic map of the project's file structure to provide context to AI agents.
 */
export class ProjectMapper {
    /**
     * Generates a string representation of the project structure.
     */
    async getMap(repoPath: string): Promise<string> {
        logger.info(`Mapping project structure: ${repoPath}`);
        if (!existsSync(repoPath)) {
            throw new Error(`Repository path does not exist: ${repoPath}`);
        }

        const files = await this.walk(repoPath);
        return files.join('\n');
    }

    /**
     * Recursively walks the directory tree to build a flat list of file paths.
     */
    private async walk(dir: string, currentDepth: number = 0, maxDepth: number = 3): Promise<string[]> {
        if (currentDepth > maxDepth) return [];

        let results: string[] = [];
        try {
            const list = await fs.readdir(dir);
            for (const file of list) {
                // Exclude common noise and binary directories
                if (['node_modules', '.git', 'dist', 'build', 'target', 'venv', '.next', '.cache'].includes(file)) {
                    continue;
                }

                const fullPath = path.join(dir, file);
                const stat = await fs.stat(fullPath);
                const relativePath = path.relative(dir, fullPath);

                const indent = '  '.repeat(currentDepth);
                if (stat.isDirectory()) {
                    results.push(`${indent}📂 ${file}/`);
                    const children = await this.walk(fullPath, currentDepth + 1, maxDepth);
                    results = results.concat(children);
                } else {
                    results.push(`${indent}📄 ${file}`);
                }
            }
        } catch (error: any) {
            logger.warn(`Error mapping directory ${dir}: ${error.message}`);
        }
        return results;
    }
}
