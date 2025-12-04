import { describe, it, expect } from 'vitest';
import {
  McpServerConfigSchema,
  A2aCapabilitySchema,
  A2aConfigSchema,
  AgentConfigSchema,
} from '../../src/types/agent.js';

describe('McpServerConfigSchema', () => {
  it('should validate stdio transport with command', () => {
    const config = {
      id: 'mcp-1',
      transport: 'stdio' as const,
      command: 'node',
      args: ['server.js'],
    };

    expect(McpServerConfigSchema.parse(config)).toEqual(config);
  });

  it('should validate sse transport with url', () => {
    const config = {
      id: 'mcp-2',
      transport: 'sse' as const,
      url: 'http://localhost:3000/mcp',
    };

    expect(McpServerConfigSchema.parse(config)).toEqual(config);
  });

  it('should validate http transport with url and headers', () => {
    const config = {
      id: 'mcp-3',
      transport: 'http' as const,
      url: 'http://localhost:3000/mcp',
      headers: { Authorization: 'Bearer token' },
    };

    expect(McpServerConfigSchema.parse(config)).toEqual(config);
  });

  it('should reject stdio transport without command', () => {
    const config = {
      id: 'mcp-1',
      transport: 'stdio',
    };

    expect(() => McpServerConfigSchema.parse(config)).toThrow(
      'stdio transport requires command, sse/http transport requires url'
    );
  });

  it('should reject sse transport without url', () => {
    const config = {
      id: 'mcp-1',
      transport: 'sse',
    };

    expect(() => McpServerConfigSchema.parse(config)).toThrow(
      'stdio transport requires command, sse/http transport requires url'
    );
  });

  it('should reject http transport without url', () => {
    const config = {
      id: 'mcp-1',
      transport: 'http',
    };

    expect(() => McpServerConfigSchema.parse(config)).toThrow(
      'stdio transport requires command, sse/http transport requires url'
    );
  });

  it('should reject empty id', () => {
    const config = {
      id: '',
      transport: 'stdio',
      command: 'node',
    };

    expect(() => McpServerConfigSchema.parse(config)).toThrow();
  });

  it('should reject invalid url format', () => {
    const config = {
      id: 'mcp-1',
      transport: 'sse',
      url: 'not-a-url',
    };

    expect(() => McpServerConfigSchema.parse(config)).toThrow();
  });
});

describe('A2aCapabilitySchema', () => {
  it('should validate capability with required fields', () => {
    const capability = {
      id: 'cap-1',
      name: 'Test Capability',
      description: 'A test capability',
    };

    expect(A2aCapabilitySchema.parse(capability)).toEqual(capability);
  });

  it('should validate capability with optional tags', () => {
    const capability = {
      id: 'cap-1',
      name: 'Test Capability',
      description: 'A test capability',
      tags: ['tag1', 'tag2'],
    };

    expect(A2aCapabilitySchema.parse(capability)).toEqual(capability);
  });

  it('should reject empty id', () => {
    const capability = {
      id: '',
      name: 'Test',
      description: 'Test',
    };

    expect(() => A2aCapabilitySchema.parse(capability)).toThrow();
  });

  it('should reject empty name', () => {
    const capability = {
      id: 'cap-1',
      name: '',
      description: 'Test',
    };

    expect(() => A2aCapabilitySchema.parse(capability)).toThrow();
  });
});

describe('A2aConfigSchema', () => {
  it('should validate with defaults', () => {
    const config = {};

    const result = A2aConfigSchema.parse(config);
    expect(result.discoverable).toBe(true);
    expect(result.capabilities).toEqual([]);
  });

  it('should validate full config', () => {
    const config = {
      discoverable: false,
      capabilities: [
        {
          id: 'cap-1',
          name: 'Test',
          description: 'Test capability',
          tags: ['test'],
        },
      ],
    };

    expect(A2aConfigSchema.parse(config)).toEqual(config);
  });
});

describe('AgentConfigSchema', () => {
  const validConfig = {
    id: 'test-agent',
    path: 'test',
    name: 'Test Agent',
    description: 'A test agent',
    systemPrompt: 'You are a test agent.',
  };

  it('should validate minimal config with defaults', () => {
    const result = AgentConfigSchema.parse(validConfig);

    expect(result.id).toBe('test-agent');
    expect(result.path).toBe('test');
    expect(result.model).toBe('gemini-2.0-flash');
    expect(result.temperature).toBe(0.7);
    expect(result.maxTokens).toBe(4096);
    expect(result.enableTools).toBe(true);
  });

  it('should validate full config', () => {
    const config = {
      ...validConfig,
      model: 'gemini-pro',
      temperature: 0.5,
      maxTokens: 8192,
      enableTools: false,
      mcp: {
        servers: [
          {
            id: 'mcp-1',
            transport: 'stdio' as const,
            command: 'node',
            args: ['server.js'],
          },
        ],
      },
      a2a: {
        discoverable: true,
        capabilities: [
          {
            id: 'cap-1',
            name: 'Test',
            description: 'Test capability',
          },
        ],
      },
    };

    const result = AgentConfigSchema.parse(config);
    expect(result).toEqual(config);
  });

  it('should reject invalid path format', () => {
    const config = {
      ...validConfig,
      path: 'Invalid Path',
    };

    expect(() => AgentConfigSchema.parse(config)).toThrow(
      'Path must be lowercase alphanumeric with hyphens'
    );
  });

  it('should reject path with special characters', () => {
    const config = {
      ...validConfig,
      path: 'test_agent',
    };

    expect(() => AgentConfigSchema.parse(config)).toThrow();
  });

  it('should accept path with hyphens', () => {
    const config = {
      ...validConfig,
      path: 'test-agent-v2',
    };

    const result = AgentConfigSchema.parse(config);
    expect(result.path).toBe('test-agent-v2');
  });

  it('should reject temperature below 0', () => {
    const config = {
      ...validConfig,
      temperature: -0.1,
    };

    expect(() => AgentConfigSchema.parse(config)).toThrow();
  });

  it('should reject temperature above 2', () => {
    const config = {
      ...validConfig,
      temperature: 2.1,
    };

    expect(() => AgentConfigSchema.parse(config)).toThrow();
  });

  it('should accept temperature at boundaries', () => {
    expect(AgentConfigSchema.parse({ ...validConfig, temperature: 0 }).temperature).toBe(0);
    expect(AgentConfigSchema.parse({ ...validConfig, temperature: 2 }).temperature).toBe(2);
  });

  it('should reject non-positive maxTokens', () => {
    const config = {
      ...validConfig,
      maxTokens: 0,
    };

    expect(() => AgentConfigSchema.parse(config)).toThrow();
  });

  it('should reject negative maxTokens', () => {
    const config = {
      ...validConfig,
      maxTokens: -100,
    };

    expect(() => AgentConfigSchema.parse(config)).toThrow();
  });

  it('should reject empty id', () => {
    const config = {
      ...validConfig,
      id: '',
    };

    expect(() => AgentConfigSchema.parse(config)).toThrow();
  });

  it('should reject empty path', () => {
    const config = {
      ...validConfig,
      path: '',
    };

    expect(() => AgentConfigSchema.parse(config)).toThrow();
  });

  it('should reject empty name', () => {
    const config = {
      ...validConfig,
      name: '',
    };

    expect(() => AgentConfigSchema.parse(config)).toThrow();
  });
});
