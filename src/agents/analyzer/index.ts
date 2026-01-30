import { GeminiService } from '../gemini';
import { IssueAnalysis, GitHubIssue } from '../../types';
import { logger } from '../../utils/logger';
import { z } from 'zod';

/**
 * Analyzes GitHub issues to extract semantic meaning and technical context.
 */
export class IssueAnalyzer {
  private service: GeminiService;

  constructor(apiKey: string = process.env.GEMINI_API_KEY!) {
    this.service = new GeminiService(apiKey);
  }

  /**
   * Performs a deep analysis of a GitHub issue using specialized AI models.
   */
  async analyze(issue: GitHubIssue): Promise<IssueAnalysis> {
    logger.info(`Analyzing issue: ${issue.title}`);

    const model = this.service.getModel();

    const schemaDescription = `
    {
      "problem": "technical summary",
      "expected": "expected behavior",
      "actual": "observed behavior",
      "keywords": ["key", "words"],
      "mentionedFiles": ["file.ts"],
      "severity": "low|medium|high",
      "category": "bug|feature|docs",
      "isFrontend": boolean
    }`;

    const prompt = `System Requirement: Perform a technical analysis of the following GitHub issue report.

REPORT METADATA:
Title: ${issue.title}
Labels: ${issue.labels.join(', ')}

REPORT CONTENT:
${issue.body}

ANALYSIS REQUIREMENTS:
1. Identify the core architectural failure or logic gap.
2. Filter for Frontend-specific requirements (CSS, UI Components, Client-side logic).
3. Extract specific file paths or unique identifiers mentioned in the text.
4. Generate high-signal search keywords for source code exploration.`;

    try {
      const result = await this.service.invokeJSON<any>(model, prompt, schemaDescription);
      return {
        ...result,
        labels: issue.labels
      };
    } catch (error: any) {
      logger.error(`AI analysis failed: ${error.message}. Returning heuristic baseline.`);
      return this.generateHeuristicBaseline(issue);
    }
  }

  /**
   * Generates a basic analysis when AI processing fails.
   */
  private generateHeuristicBaseline(issue: GitHubIssue): IssueAnalysis {
    const isFrontend = issue.labels.some(l =>
      /frontend|ui|css|react|view/i.test(l)
    );

    return {
      problem: issue.title,
      expected: "Standard operational compliance",
      actual: "Reported anomaly in issue body",
      keywords: issue.title.split(' ').filter(k => k.length > 3).slice(0, 5),
      mentionedFiles: [],
      severity: "medium",
      category: "bug",
      labels: issue.labels,
      isFrontend
    };
  }
}
