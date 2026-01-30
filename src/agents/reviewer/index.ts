import { GeminiService } from '../gemini';
import { IssueAnalysis, CodeSnippet, CodeFix } from '../../types';
import { logger } from '../../utils/logger';
import { z } from 'zod';

export interface ReviewResult {
    approved: boolean;
    feedback: string;
    category: 'logic' | 'syntax' | 'style' | 'security' | 'ok';
}

/**
 * Conducts a technical peer review of generated fixes to ensure quality and safety.
 */
export class ReviewerAgent {
    private service: GeminiService;

    constructor(apiKey: string = process.env.GEMINI_API_KEY!) {
        this.service = new GeminiService(apiKey);
    }

    /**
     * Reviews a proposed code fix against the original problem and context.
     */
    async review(
        issue: IssueAnalysis,
        fix: CodeFix,
        snippets: CodeSnippet[],
        language: string
    ): Promise<ReviewResult> {
        logger.info(`Reviewing fix for ${fix.file}...`);
        const model = this.service.getModel();

        const schema = z.object({
            approved: z.boolean().describe("True if the fix is technically sound, secure, and complete"),
            feedback: z.string().describe("Detailed architectural and logical feedback"),
            category: z.enum(['logic', 'syntax', 'style', 'security', 'ok']).describe("Primary classification of any identified issues")
        });

        const structuredModel = model.withStructuredOutput(schema as any);

        const originalCode = snippets.find(s => s.file === fix.file)?.content ||
            "Target file content not available in current context.";

        const prompt = `System Requirement: Conduct a rigorous Peer Review of the following code modification.

TECHNICAL CONTEXT:
Issue: ${issue.problem}
Stack: ${language}
File: ${fix.file}

ORIGINAL SOURCE:
\`\`\`
${originalCode}
\`\`\`

PROPOSED MODIFICATION:
\`\`\`
${fix.content}
\`\`\`

REVIEW CRITERIA:
1. LOGICAL INTEGRITY: Does the fix resolve the identified root cause?
2. REGRESSION RISK: Does the change introduce secondary failures or side effects?
3. SECURITY COMPLIANCE: Are there any vulnerability patterns (e.g. unsanitized input)?
4. ARCHITECTURAL ALIGNMENT: Does the fix adhere to established project patterns?
5. COMPLETENESS: Is the issue fully addressed or is this a superficial patch?

VERDICT GUIDELINES:
- Approve ONLY if all criteria are met.
- Provide high-density technical feedback for rejections.`;

        try {
            const result = await structuredModel.invoke(prompt) as any as ReviewResult;
            return result;
        } catch (error: any) {
            logger.error(`Reviewer API failure: ${error.message}. Defaulting to manual verification requirement.`);
            return {
                approved: false,
                feedback: "Automated review system unavailable. Manual audit required.",
                category: 'logic'
            };
        }
    }
}
