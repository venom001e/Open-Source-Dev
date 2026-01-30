import { GeminiService } from '../gemini';
import { IssueAnalysis, CodeSnippet, CodeFix, FixFailure } from '../../types';
import { logger } from '../../utils/logger';
import { z } from 'zod';

/**
 * Responsible for generating high-quality code fixes based on issue analysis and context.
 */
export class EngineerAgent {
  private service: GeminiService;

  constructor(apiKey: string = process.env.GEMINI_API_KEY!) {
    this.service = new GeminiService(apiKey);
  }

  /**
   * Generates a targeted code fix for the identified issue.
   */
  async generateFix(
    issue: IssueAnalysis,
    snippets: CodeSnippet[],
    language: string,
    previousFailures: FixFailure[] = []
  ): Promise<CodeFix> {
    logger.info(`Engineering fix for issue: ${issue.problem.substring(0, 50)}...`);
    const model = this.service.getModel();

    const schema = z.object({
      file: z.string().describe("The absolute or relative path of the file to be modified"),
      content: z.string().describe("The full content of the file after applying the fix"),
      explanation: z.string().describe("A technical explanation of the fix and its impact"),
    });

    const structuredModel = model.withStructuredOutput(schema as any);

    const prompt = `System Role: Expert Software Engineer
Task: Debug and patch the following issue within the provided code context.

ISSUE SPECIFICATION:
Summary: ${issue.problem}
Stack Environment: ${language}

CODE CONTEXT:
${snippets.map(s => `--- File: ${s.file} ---\n\`\`\`\n${s.content}\n\`\`\``).join('\n\n')}

${previousFailures.length > 0 ? `PREVIOUS ATTEMPTS (USE FOR LEARNING):
${previousFailures.map(f => `[Attempt ${f.attempt}]
Error: ${f.error}
Diagnosis: ${f.diagnosis}`).join('\n\n')}` : ''}

ENGINEERING REQUIREMENTS:
1. Identify the exact line(s) causing the failure.
2. Implement a robust fix that follows the project's existing coding patterns.
3. Ensure no regressions or logic errors are introduced.
4. Return the COMPLETE content of the modified file. DO NOT provide diffs or snippets.
5. Provide a clear technical justification for the change.`;

    try {
      const result = await structuredModel.invoke(prompt) as any;
      return {
        file: result.file,
        content: result.content,
      };
    } catch (error: any) {
      logger.warn(`Primary model (gemini-2.0-flash) failed: ${error.message}. Falling back to gemini-2.0-pro...`);
      try {
        const fallbackModel = this.service.getModel('gemini-2.0-pro').withStructuredOutput(schema as any);
        const result = await fallbackModel.invoke(prompt) as any;
        return {
          file: result.file,
          content: result.content,
        };
      } catch (fallbackError: any) {
        logger.error(`Fallback model (gemini-2.0-pro) also failed: ${fallbackError.message}.`);
        throw new Error(`Failed to generate code fix autonomously: ${fallbackError.message}`);
      }
    }
  }

  /**
   * Analyzes test failures to diagnose the root cause of a fix attempt's failure.
   */
  async diagnoseFail(fix: CodeFix, testError: string): Promise<string> {
    const model = this.service.getModel();

    const prompt = `Technical Audit: Analyze the following test failure against the implemented fix.

TEST ERROR:
\`\`\`
${testError}
\`\`\`

IMPLEMENTED CODE:
\`\`\`
${fix.content.substring(0, 2000)} // Truncated for context
\`\`\`

REQUIREMENT:
Provide a concise, technical diagnosis of why the fix failed and what architectural or logical adjustments are required. 
Limit your response to 2 sentences of high-density technical information.`;

    try {
      const response = await model.invoke(prompt);
      return typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    } catch (error: any) {
      return `Diagnosis failed: ${error.message}`;
    }
  }
}
