import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

export const PRICES = {
  'gemini-2.5-flash': { input: 0.05 / 1_000_000, output: 0.2 / 1_000_000 },
  'gemini-2.5-pro': { input: 0.1 / 1_000_000, output: 0.4 / 1_000_000 },
  'gemini-2.0-flash': { input: 0.075 / 1_000_000, output: 0.3 / 1_000_000 },
  'gemini-1.5-flash': { input: 0.075 / 1_000_000, output: 0.3 / 1_000_000 },
  'gemini-1.5-pro': { input: 0.12 / 1_000_000, output: 0.48 / 1_000_000 },
};

export class GeminiService {
  private static usage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    cost: 0
  };

  constructor(private apiKey: string) { }

  /**
   * Returns a LangChain model instance.
   * Default model is gemini-2.5-flash (cheapest, best for free tier).
   * Includes retry logic for rate limit errors.
   */
  getModel(modelName?: string, temperature = 0) {
    const normalizedModelName = modelName || 'gemini-2.5-flash';

    const config = {
      apiKey: this.apiKey,
      model: normalizedModelName,
      apiVersion: 'v1beta',
      temperature,
      maxRetries: 3,
      topP: 0.95,
      topK: 40,
    };

    return new ChatGoogleGenerativeAI(config);
  }

  /**
   * Helper to invoke the model and enforce JSON output via prompt reinforcement.
   * Includes exponential backoff for rate limit errors.
   */
  async invokeJSON<T>(model: ChatGoogleGenerativeAI, prompt: string, schemaDescription: string): Promise<T> {
    const jsonPrompt = `${prompt}\n\nIMPORTANT: You must return ONLY a valid JSON object. No markdown, no triple backticks, no explanations. 
    The JSON must follow this structure:\n${schemaDescription}`;

    let lastError: Error | null = null;
    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await model.invoke(jsonPrompt);
        const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

        try {
          const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
          return JSON.parse(cleaned) as T;
        } catch (e) {
          console.error("Failed to parse AI JSON response. Content:", content);
          throw new Error("AI returned invalid JSON format.");
        }
      } catch (error: any) {
        lastError = error;

        // Check for rate limit error
        if (error?.message?.includes('429') || error?.message?.includes('Too Many Requests')) {
          const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
          console.warn(`Rate limited. Retrying in ${waitTime}ms... (attempt ${attempt + 1}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        // For other errors, throw immediately
        throw error;
      }
    }

    throw lastError || new Error("Failed to invoke model after retries");
  }

  static trackUsage(modelName: string, promptTokens: number, completionTokens: number) {
    this.usage.promptTokens += promptTokens;
    this.usage.completionTokens += completionTokens;
    this.usage.totalTokens += promptTokens + completionTokens;
    this.usage.cost += this.calculateStaticCost(modelName, promptTokens, completionTokens);
  }

  static getSessionUsage() {
    return this.usage;
  }

  calculateCost(modelName: string, promptTokens: number, completionTokens: number): number {
    return GeminiService.calculateStaticCost(modelName, promptTokens, completionTokens);
  }

  private static calculateStaticCost(modelName: string, promptTokens: number, completionTokens: number): number {
    const normalizedModelName = modelName.replace('models/', '').replace('-latest', '');
    const prices = (PRICES as any)[normalizedModelName] || PRICES['gemini-2.0-flash'];
    return (promptTokens * prices.input) + (completionTokens * prices.output);
  }
}
