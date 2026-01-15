import { GeminiService } from '../gemini';
import { IssueAnalysis, GitHubIssue } from '../../types';
import { logger } from '../../utils/logger';
import { z } from 'zod';

export class IssueAnalyzer {
  constructor() { }

  async analyze(issue: GitHubIssue): Promise<IssueAnalysis> {
    logger.info('Analyzing issue with LangChain...');

    const model = GeminiService.getModel('gemini-2.0-flash-exp');

    const schema = z.object({
      problem: z.string().describe("A concise summary of what is broken"),
      expected: z.string().describe("Expected behavior description"),
      actual: z.string().describe("Actual behavior description"),
      keywords: z.array(z.string()).describe("Relevant search keywords"),
      mentionedFiles: z.array(z.string()).describe("Files explicitly mentioned in the issue"),
      severity: z.enum(['low', 'medium', 'high']),
      category: z.enum(['bug', 'feature', 'docs']),
    });

    const structuredModel = model.withStructuredOutput(schema as any);

    const prompt = `You are a senior engineer analyzing a bug report.

Issue:
Title: ${issue.title}
Body: ${issue.body}
Labels: ${issue.labels.join(', ')}

Analyze the issue and extract the structured data. Focus on identifying the core problem and any specific files mentioned.`;

    try {
      const result = await structuredModel.invoke(prompt);
      return result as IssueAnalysis;
    } catch (e) {
      logger.warn('API for issue analysis failed, using fallback...');
      return {
        problem: issue.title,
        expected: "Functionality working correctly",
        actual: "Bug reported in issue body",
        keywords: issue.title.split(' ').slice(0, 5),
        mentionedFiles: [],
        severity: "medium",
        category: "bug"
      };
    }
  }
}

