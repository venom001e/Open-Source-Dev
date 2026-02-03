import { execa } from 'execa';
import path from 'path';
import { existsSync } from 'fs';
import { CodeSnippet } from '../../types';
import { logger } from '../../utils/logger';

/**
 * Executes high-speed code searches using ripgrep with granular control over context and file types.
 */
export class RipgrepSearch {
  private getBinaryPath(): string {
    // Check for local binary in bin/ folder (Windows specific fallback)
    const localPath = path.join(process.cwd(), 'bin', 'rg.exe');
    if (existsSync(localPath)) {
      return localPath;
    }
    return 'rg'; // Fallback to global command
  }

  /**
   * Performs a search and returns structured snippets with source context.
   */
  async search(
    pattern: string,
    repoPath: string,
    options: { fileType?: string; contextLines?: number } = {}
  ): Promise<CodeSnippet[]> {
    const context = options.contextLines || 10;
    const binary = this.getBinaryPath();

    const args = [
      pattern,
      '--json',
      '--context',
      context.toString(),
      '--max-columns', '500',
      '--max-columns-preview',
    ];

    if (options.fileType) {
      args.push('-g', `*.${options.fileType}`);
    }

    try {
      logger.debug(`Searching for "${pattern}" in ${repoPath} using ${binary}`);
      const { stdout } = await execa(binary, args, { cwd: repoPath });
      const results = this.parseJsonOutput(stdout);
      logger.debug(`Search for "${pattern}" returned ${results.length} snippets`);
      return results;
    } catch (error: any) {
      // Exit code 1 means no matches found
      if (error.exit_code === 1 || error.exitCode === 1) {
        logger.debug(`No matches found for pattern: "${pattern}"`);
        return [];
      }
      logger.error(`Ripgrep execution failed: ${error.message}`);
      return [];
    }
  }


  /**
   * Parses the JSON stream output from ripgrep.
   */
  private parseJsonOutput(output: string): CodeSnippet[] {
    const lines = output.split('\n').filter(Boolean);
    const snippets: CodeSnippet[] = [];

    // Group matches by file and line range to avoid overlapping context
    const fileMatches: Record<string, any[]> = {};

    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        if (msg.type === 'match') {
          const path = msg.data.path;
          if (!fileMatches[path]) fileMatches[path] = [];

          fileMatches[path].push({
            line: msg.data.line_number,
            content: msg.data.lines,
            // Capture submatches if needed
          });
        }
        // Note: In professional implementations, we'd also parse 'context' messages 
        // to build a continuous block of code. For now, we'll return targeted matches.
      } catch (e) {
        continue;
      }
    }

    for (const [file, matches] of Object.entries(fileMatches)) {
      for (const match of matches) {
        snippets.push({
          file,
          startLine: Math.max(1, match.line - 2), // Rough estimate for display
          endLine: match.line + 2,
          content: match.content,
          relevanceScore: 1.0,
        });
      }
    }

    return snippets;
  }
}

