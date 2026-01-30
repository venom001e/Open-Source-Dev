import { GeminiService } from '../gemini';
import { IssueAnalysis, SearchQuery } from '../../types';
import { logger } from '../../utils/logger';
import { z } from 'zod';

export class ScoutAgent {
  private service: GeminiService;

  constructor(apiKey: string = process.env.GEMINI_API_KEY!) {
    this.service = new GeminiService(apiKey);
  }

  async generateSearchQueries(issue: IssueAnalysis, language: string, projectMap?: string): Promise<SearchQuery[]> {
    logger.info('Generating search queries with LangChain...');
    const model = this.service.getModel();

    const schema = z.object({
      queries: z.array(z.object({
        pattern: z.string().describe("Regex pattern to search for"),
        fileType: z.string().describe("File extension filter (e.g., ts, py)"),
        contextLines: z.number().describe("Number of lines of context"),
        reason: z.string().describe("Why this query is relevant"),
      }))
    });

    const structuredModel = model.withStructuredOutput(schema as any);

    const prompt = `You are a Codebase Scout. Your mission is to find the EXACT files causing the issue.
    
# Navigation Strategy
1. Use the "Project Structure" to see where related files might live.
2. Use the "Mentioned Files" from the issue context if they exist.
3. If the issue describes a UI bug, look for Frontend components.
4. If it describes an API failure, look for Routes/Controllers/Models.

Project Structure:
${projectMap || 'Unknown'}

Issue: ${issue.problem}
Keywords: ${issue.keywords.join(', ')}
Mentioned Files: ${issue.mentionedFiles.join(', ') || 'None'}
Language: ${language}

Based on this, generate 3-5 surgical regex patterns. Be precise. Avoid searching for generic terms if a file path is obvious.`;

    try {
      const result = await structuredModel.invoke(prompt) as any;
      return result.queries as SearchQuery[];
    } catch (e) {
      logger.warn('API for search query generation failed, using fallback...');
      return [{
        pattern: issue.keywords[0] || "main",
        fileType: language,
        contextLines: 20,
        reason: "Generic search based on keywords"
      }];
    }
  }
}
