export interface IssueAnalysis {
  problem: string;
  expected: string;
  actual: string;
  keywords: string[];
  mentionedFiles: string[];
  severity: 'low' | 'medium' | 'high';
  category: 'bug' | 'feature' | 'docs';
}

export interface RepoFingerprint {
  language: string;
  runtime: string;
  packageManager: string;
  installCommand: string;
  testCommand: string;
}

export interface CodeSnippet {
  file: string;
  startLine: number;
  endLine: number;
  content: string;
  relevanceScore: number;
}

export interface SearchQuery {
  pattern: string;
  fileType: string;
  contextLines: number;
  reason: string;
}

export interface CodeFix {
  file: string;
  content: string;
}

export interface FixFailure {
  fix: CodeFix;
  error: string;
  diagnosis: string;
  attempt: number;
}

export interface TestResult {
  passed: boolean;
  output: string;
  error: string;
  exitCode: number;
  duration?: number;
}

export interface AgentState {
  issueUrl: string;
  issueAnalysis?: IssueAnalysis;
  repoPath?: string;
  fingerprint?: RepoFingerprint;
  contextSnippets: CodeSnippet[];
  currentFix?: CodeFix;
  testResults: TestResult[];
  attempts: number;
  maxAttempts: number;
  status: string;
  prUrl?: string;
  sandbox?: any; // E2BSandbox type causes circular dependency if imported here, using any for now or move type.
  error?: string;
  reviewFeedback?: string;
  dryRun?: boolean;
  projectMap?: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  labels: string[];
  author: string;
}

export interface PullRequest {
  url: string;
  number: number;
}

export interface ParsedIssueUrl {
  owner: string;
  repo: string;
  issueNumber: number;
}

export interface WorkflowOptions {
  dryRun: boolean;
  maxAttempts: number;
  verbose: boolean;
  useLocal: boolean;
}

export interface WorkflowResult {
  status: 'success' | 'failed';
  prUrl?: string;
  error?: string;
  attempts: number;
  duration: number;
  cost: number;
}
