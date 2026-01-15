
jest.mock('../../src/tools/github/client', () => ({
    GitHubClient: jest.fn().mockImplementation(() => ({
        getIssue: jest.fn(),
        cloneRepo: jest.fn(),
    })),
}));

jest.mock('../../src/tools/search/ripgrep', () => ({
    RipgrepSearch: jest.fn().mockImplementation(() => ({
        search: jest.fn(),
    })),
}));

jest.mock('../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        success: jest.fn(),
        debug: jest.fn(),
    },
}));

import { createFixGraph } from '../../src/orchestrator/graph';

describe('Fix Graph', () => {
    it('should compile the graph successfully', () => {
        const graph = createFixGraph();
        expect(graph).toBeDefined();
        // Check if it has invoke method (LangGraph compiled graph)
        expect(graph.invoke).toBeDefined();
    });
});
