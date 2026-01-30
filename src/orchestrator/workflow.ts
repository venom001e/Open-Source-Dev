import { createFixGraph } from './graph';
import { E2BSandbox } from '../sandbox/e2b';
import { GitHubClient } from '../tools/github/client';
import { parseIssueUrl } from '../tools/github/parser';
import { WorkflowOptions, WorkflowResult, AgentState } from '../types';
import { logger } from '../utils/logger';
import os from 'os';
import path from 'path';

/**
 * Executes the full autonomous fix workflow for a given GitHub issue.
 */
export async function runFixWorkflow(
  issueUrl: string,
  options: WorkflowOptions
): Promise<WorkflowResult> {
  const startTime = Date.now();
  let sandbox: E2BSandbox | undefined;

  try {
    const { owner, repo } = parseIssueUrl(issueUrl);
    const github = new GitHubClient(process.env.GITHUB_TOKEN!);

    let repoPath: string;
    if (options.useLocal) {
      repoPath = process.cwd();
      logger.info(`Operating on local repository: ${repoPath}`);
    } else {
      repoPath = path.join(os.tmpdir(), `oss-dev-${Date.now()}`);
      logger.info(`Cloning repository to temporary path: ${repoPath}`);
      await github.cloneRepo(owner, repo, repoPath);
    }

    // Step 1: Detect the technology stack
    const { StackDetectorAgent } = await import('../agents/stack-detector');
    const detector = new StackDetectorAgent(process.env.GEMINI_API_KEY!);

    logger.info('Analyzing project structure...');
    const fingerprint = await detector.detectStack(repoPath);
    logger.info(`Stack detected: ${fingerprint.language} (${fingerprint.runtime})`);

    // Step 2: Initialize Sandbox
    sandbox = new E2BSandbox();
    await sandbox.provision(
      `https://github.com/${owner}/${repo}.git`,
      fingerprint,
      options.useLocal ? repoPath : undefined
    );

    // Step 3: Execute the Agentic Graph
    // The graph handles: Analyze -> Search -> Fix -> Verify
    const graph = createFixGraph();
    const initialState: AgentState = {
      issueUrl,
      repoPath,
      fingerprint,
      contextSnippets: [],
      testResults: [],
      attempts: 0,
      maxAttempts: options.maxAttempts,
      sandbox,
      dryRun: options.dryRun,
      status: 'running'
    };

    logger.info('Starting autonomous fix loop...');
    const finalState = await graph.invoke(initialState);

    await sandbox.cleanup();

    if (finalState.status === 'success') {
      return {
        status: 'success',
        prUrl: finalState.prUrl,
        attempts: finalState.attempts,
        duration: Math.floor((Date.now() - startTime) / 1000),
        cost: 0, // Cost tracking to be implemented
      };
    } else {
      return {
        status: 'failed',
        error: finalState.error || 'Workflow completed without reaching success state.',
        attempts: finalState.attempts,
        duration: Math.floor((Date.now() - startTime) / 1000),
        cost: 0,
      };
    }

  } catch (error: any) {
    logger.error(`Critical workflow failure: ${error.message}`);
    if (sandbox) {
      try {
        await sandbox.cleanup();
      } catch (cleanupError: any) {
        logger.warn(`Cleanup failed after error: ${cleanupError.message}`);
      }
    }

    return {
      status: 'failed',
      error: error.message,
      attempts: 0,
      duration: Math.floor((Date.now() - startTime) / 1000),
      cost: 0,
    };
  }
}
