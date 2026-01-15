# OSS_dev Contributor Guide

A comprehensive guide to understanding the architecture, technology choices, and design decisions behind OSS_dev.

## What is OSS_dev?

OSS_dev is an autonomous AI agent that fixes bugs in open-source repositories. It:
- Analyzes GitHub issues
- Detects the technology stack automatically
- Searches for relevant code
- Generates fixes
- Tests the fixes in isolated sandboxes
- Creates pull requests

## Why We Built This

**Problem**: Contributing to open-source projects is time-consuming. Developers spend hours understanding codebases, finding relevant code, and testing fixes.

**Solution**: An AI agent that automates the entire bug-fixing workflow, making it easy to contribute to any project in any language.

**Vision**: Enable anyone to contribute to open-source, regardless of their familiarity with the codebase or technology stack.

## Architecture Overview

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI Entry                            │
│                    (src/cli/index.ts)                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Workflow Orchestrator                     │
│                 (src/orchestrator/workflow.ts)               │
│                                                              │
│  1. Clone repository                                         │
│  2. Detect stack (StackDetectorAgent)                        │
│  3. Provision sandbox (E2B)                                  │
│  4. Execute LangGraph                                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    LangGraph State Machine                   │
│                  (src/orchestrator/graph.ts)                 │
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ Analyze  │───▶│  Detect  │───▶│  Search  │              │
│  │  Issue   │    │  Stack   │    │   Code   │              │
│  └──────────┘    └──────────┘    └──────────┘              │
│                                        │                     │
│                                        ▼                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │  Verify  │◀───│ Generate │◀───│  (cont)  │              │
│  │   Fix    │    │   Fix    │    │          │              │
│  └────┬─────┘    └──────────┘    └──────────┘              │
│       │                                                      │
│       ├─Success──▶ [END]                                    │
│       │                                                      │
│       └─Failure──▶ [Retry Loop]                             │
└─────────────────────────────────────────────────────────────┘
```

### Agent System

We use specialized AI agents for different tasks:

1. **StackDetectorAgent** (`src/agents/stack-detector.ts`)
   - Analyzes file tree to detect language/framework
   - Returns install and test commands
   - Makes the system language-agnostic

2. **IssueAnalyzer** (`src/agents/analyzer/index.ts`)
   - Parses GitHub issue details
   - Extracts problem, expected behavior, keywords
   - Identifies mentioned files

3. **ScoutAgent** (`src/agents/scout/index.ts`)
   - Generates ripgrep search queries
   - Finds relevant code based on issue keywords

4. **EngineerAgent** (`src/agents/engineer/index.ts`)
   - Generates code fixes
   - Diagnoses test failures
   - Learns from previous attempts

## Technology Choices

### Why LangGraph?

**Before**: Linear workflow with manual retry logic
**After**: State machine with conditional edges and automatic retries

**Benefits**:
- **Cyclic behavior**: Can retry failed fixes automatically
- **State persistence**: Maintains context across retries
- **Observability**: Easy to track agent progress
- **Flexibility**: Easy to add new nodes or modify flow

### Why LangChain?

**Before**: Custom Gemini API wrapper with manual JSON parsing
**After**: LangChain's structured output with Zod schemas

**Benefits**:
- **Type safety**: Zod schemas ensure correct output format
- **Error handling**: Built-in retry and error recovery
- **Consistency**: Standardized prompting across agents
- **Future-proof**: Easy to swap LLM providers

### Why Gemini?

- **Cost-effective**: Competitive pricing for API calls
- **Fast**: Gemini Flash for quick operations
- **Powerful**: Gemini Pro for complex reasoning
- **Structured output**: Native support for JSON mode

### Why E2B Sandboxes?

- **Isolation**: Safe execution of untrusted code
- **Language support**: Works with any language
- **Cloud-based**: No local setup required
- **Fast**: Quick provisioning and teardown

### Why TypeScript?

- **Type safety**: Catch errors at compile time
- **Better IDE support**: Autocomplete and refactoring
- **Maintainability**: Easier to understand and modify
- **Ecosystem**: Rich npm ecosystem

## Directory Structure

```
OSS_dev/
├── src/
│   ├── agents/              # AI agents
│   │   ├── analyzer/        # Issue analysis
│   │   ├── engineer/        # Code generation
│   │   ├── scout/           # Code search
│   │   ├── stack-detector.ts # Stack detection
│   │   └── gemini.ts        # LLM service
│   ├── orchestrator/        # Workflow orchestration
│   │   ├── graph.ts         # LangGraph state machine
│   │   ├── workflow.ts      # Main workflow
│   │   └── fix-loop.ts      # Legacy retry logic
│   ├── sandbox/             # Sandbox management
│   │   ├── e2b.ts           # E2B integration
│   │   └── fingerprint.ts   # Legacy stack detection
│   ├── tools/               # Utility tools
│   │   ├── github/          # GitHub API
│   │   └── search/          # Ripgrep search
│   ├── cli/                 # CLI interface
│   ├── types/               # TypeScript types
│   └── utils/               # Utilities
├── tests/                   # Test files
│   └── unit/                # Unit tests
├── CONTRIBUTING.md          # Contribution guidelines
├── CONTRIBUTOR-GUIDE.md     # This file
└── README.md                # Project overview
```

## Key Concepts

### State Management

The `AgentState` interface tracks everything:
```typescript
interface AgentState {
  issueUrl: string;           // GitHub issue URL
  repoPath: string;           // Local repo path
  fingerprint?: RepoFingerprint; // Detected stack
  analysis?: IssueAnalysis;   // Parsed issue
  contextSnippets: CodeSnippet[]; // Found code
  currentFix?: CodeFix;       // Generated fix
  testResults: TestResult[];  // Test outcomes
  attempts: number;           // Retry count
  maxAttempts: number;        // Max retries
  sandbox?: E2BSandbox;       // Sandbox instance
  status: 'running' | 'success' | 'failed';
}
```

### Retry Loop

When a fix fails tests:
1. **Verify node** detects failure
2. **Conditional edge** routes to retry
3. **State** preserves failure history
4. **Engineer agent** uses failure context
5. **Generate new fix** with learned insights
6. **Verify again** (up to max attempts)

### Universal Stack Detection

Instead of hardcoded file checks:
```typescript
// Old way (limited)
if (fs.existsSync('package.json')) return 'node';
if (fs.existsSync('go.mod')) return 'go';

// New way (universal)
const fileTree = await generateFileTree(repoPath);
const stack = await gemini.detectStack(fileTree);
// Works for ANY language Gemini knows!
```

## Common Workflows

### Adding a New Agent

1. Create file in `src/agents/your-agent.ts`
2. Define Zod schema for output
3. Use `GeminiService.getModel()` for LLM
4. Use `.withStructuredOutput(schema)` for type safety
5. Add node to `src/orchestrator/graph.ts`
6. Connect edges in graph
7. Update `AgentState` if needed
8. Write unit tests

### Improving Prompts

1. Find the agent file (analyzer, scout, engineer)
2. Locate the prompt string
3. Test changes with `--dry-run` flag
4. Measure token usage and quality
5. Iterate and commit

### Adding Language Support

Stack detection is automatic! But you can:
1. Add language-specific test commands to prompts
2. Improve file tree generation in `stack-detector.ts`
3. Add E2B template mappings if needed

## Debugging Tips

### Enable Debug Logging
```bash
export OSS_DEV_LOG_LEVEL=debug
npm run dev fix <issue-url> --dry-run
```

### Test Individual Agents
```typescript
// In tests/unit/
const analyzer = new IssueAnalyzer();
const result = await analyzer.analyze(mockIssue);
console.log(result);
```

### Inspect LangGraph State
Add logging in graph nodes:
```typescript
async function analyzeIssueNode(state: AgentState) {
  console.log('Current state:', state);
  // ... rest of node
}
```

## Performance Considerations

### Token Usage
- Use Gemini Flash for simple tasks (stack detection, search)
- Use Gemini Pro for complex reasoning (code generation)
- Limit context snippets to relevant code only
- Cache file trees when possible

### API Rate Limits
- Free tier: Limited requests per minute
- Implement exponential backoff
- Consider paid tier for production use

### Sandbox Costs
- E2B charges per sandbox-hour
- Clean up sandboxes promptly
- Reuse sandboxes when possible

## Future Enhancements

### Planned Features
- [ ] Multi-file fixes
- [ ] Dependency updates
- [ ] Security vulnerability fixes
- [ ] Code refactoring suggestions
- [ ] Documentation generation

### Research Areas
- Better failure diagnosis
- Learning from successful PRs
- Collaborative multi-agent systems
- Cost optimization strategies

## Resources

- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [LangChain Documentation](https://js.langchain.com/)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [E2B Documentation](https://e2b.dev/docs)

## Getting Help

- **Architecture questions**: Open a discussion
- **Bug reports**: Create an issue with reproduction steps
- **Feature requests**: Describe use case and benefits
- **Code review**: Submit PR and request review

## Contributing Philosophy

We value:
- **Simplicity**: Keep it simple, avoid over-engineering
- **Reliability**: Prefer working code over perfect code
- **Observability**: Make it easy to understand what's happening
- **Adaptability**: Design for change and extension

Thank you for contributing to OSS_dev! Together we're making open-source more accessible.
