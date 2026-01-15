# Contributing to OSS_dev

Thank you for your interest in contributing to OSS_dev! This document provides guidelines for contributing to the project.

## Getting Started

1. **Fork the repository** and clone your fork
2. **Install dependencies**: `npm install`
3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Add your API keys:
   # - GEMINI_API_KEY
   # - GITHUB_TOKEN
   # - E2B_API_KEY
   ```
4. **Run tests**: `npm test`
5. **Build the project**: `npm run build`

## Development Workflow

1. Create a new branch for your feature/fix: `git checkout -b feature/your-feature-name`
2. Make your changes
3. Run tests to ensure nothing breaks: `npm test`
4. Commit your changes with clear, concise messages
5. Push to your fork and submit a pull request

## Code Style

- Use TypeScript for all new code
- Follow existing code formatting (we use Prettier)
- Write meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused

## Commit Messages

- Use present tense: "add feature" not "added feature"
- Keep the first line under 50 characters
- Be descriptive but concise
- No emojis in commit messages

Examples:
```
add langchain integration to analyzer
fix sandbox provisioning for go projects
update documentation for stack detector
```

## Testing

- Write unit tests for new features
- Ensure all tests pass before submitting PR
- Test with real GitHub issues when possible
- Document any manual testing steps in PR description

## Pull Request Process

1. Update README.md or documentation if needed
2. Ensure your PR description clearly describes the problem and solution
3. Link any related issues
4. Wait for review from maintainers
5. Address any requested changes

## Areas for Contribution

- **Agent Improvements**: Enhance prompts, add new agent capabilities
- **Stack Detection**: Add support for more languages/frameworks
- **Testing**: Improve test coverage
- **Documentation**: Improve guides, add examples
- **Bug Fixes**: Fix reported issues
- **Performance**: Optimize token usage, reduce API calls

## Questions?

- Check the [CONTRIBUTOR-GUIDE.md](./CONTRIBUTOR-GUIDE.md) for architecture details
- Open an issue for questions or discussions
- Review existing issues and PRs for context

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help others learn and grow

Thank you for contributing to OSS_dev!
