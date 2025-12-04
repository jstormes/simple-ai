import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentCardGenerator } from '../../src/a2a/card-generator.js';
import type { AgentRegistry } from '../../src/core/registry.js';
import type { AgentConfig } from '../../src/types/agent.js';

describe('AgentCardGenerator', () => {
  let mockRegistry: AgentRegistry;

  const createMockConfig = (overrides: Partial<AgentConfig> = {}): AgentConfig => ({
    id: 'test-agent',
    path: 'test',
    name: 'Test Agent',
    description: 'A test agent',
    model: 'gemini-2.0-flash',
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: 'You are a test agent.',
    enableTools: true,
    ...overrides,
  });

  beforeEach(() => {
    mockRegistry = {
      getAllConfigs: vi.fn(),
      getConfig: vi.fn(),
    } as unknown as AgentRegistry;
  });

  describe('constructor', () => {
    it('should remove trailing slash from baseUrl', () => {
      const configs = new Map<string, AgentConfig>();
      vi.mocked(mockRegistry.getAllConfigs).mockReturnValue(configs);

      const generator = new AgentCardGenerator(mockRegistry, 'http://localhost:8001/');
      const card = generator.generateServiceCard();

      expect(card.url).toBe('http://localhost:8001');
    });

    it('should keep baseUrl without trailing slash', () => {
      const configs = new Map<string, AgentConfig>();
      vi.mocked(mockRegistry.getAllConfigs).mockReturnValue(configs);

      const generator = new AgentCardGenerator(mockRegistry, 'http://localhost:8001');
      const card = generator.generateServiceCard();

      expect(card.url).toBe('http://localhost:8001');
    });
  });

  describe('generateServiceCard', () => {
    it('should generate service card with correct metadata', () => {
      const configs = new Map<string, AgentConfig>();
      vi.mocked(mockRegistry.getAllConfigs).mockReturnValue(configs);

      const generator = new AgentCardGenerator(mockRegistry, 'http://localhost:8001');
      const card = generator.generateServiceCard();

      expect(card.name).toBe('AI Agents Service');
      expect(card.description).toBe('Multi-agent service with MCP and A2A protocol support');
      expect(card.protocolVersion).toBe('1.0');
      expect(card.version).toBe('1.0.0');
      expect(card.url).toBe('http://localhost:8001');
    });

    it('should include discoverable agents as skills', () => {
      const config = createMockConfig({
        a2a: { discoverable: true, capabilities: [] },
      });
      const configs = new Map([['test', config]]);
      vi.mocked(mockRegistry.getAllConfigs).mockReturnValue(configs);

      const generator = new AgentCardGenerator(mockRegistry, 'http://localhost:8001');
      const card = generator.generateServiceCard();

      expect(card.skills).toHaveLength(1);
      expect(card.skills[0]).toEqual({
        id: 'test-agent',
        name: 'Test Agent',
        description: 'A test agent',
        tags: ['agent', 'test'],
      });
    });

    it('should exclude non-discoverable agents', () => {
      const config = createMockConfig({
        a2a: { discoverable: false, capabilities: [] },
      });
      const configs = new Map([['test', config]]);
      vi.mocked(mockRegistry.getAllConfigs).mockReturnValue(configs);

      const generator = new AgentCardGenerator(mockRegistry, 'http://localhost:8001');
      const card = generator.generateServiceCard();

      expect(card.skills).toHaveLength(0);
    });

    it('should include agent capabilities as skills', () => {
      const config = createMockConfig({
        a2a: {
          discoverable: true,
          capabilities: [
            {
              id: 'cap-1',
              name: 'Capability One',
              description: 'First capability',
              tags: ['tag1'],
            },
            {
              id: 'cap-2',
              name: 'Capability Two',
              description: 'Second capability',
            },
          ],
        },
      });
      const configs = new Map([['test', config]]);
      vi.mocked(mockRegistry.getAllConfigs).mockReturnValue(configs);

      const generator = new AgentCardGenerator(mockRegistry, 'http://localhost:8001');
      const card = generator.generateServiceCard();

      expect(card.skills).toHaveLength(3); // 1 agent + 2 capabilities
      expect(card.skills[1]).toEqual({
        id: 'test-agent:cap-1',
        name: 'Capability One',
        description: 'First capability',
        tags: ['tag1'],
      });
      expect(card.skills[2]).toEqual({
        id: 'test-agent:cap-2',
        name: 'Capability Two',
        description: 'Second capability',
        tags: undefined,
      });
    });

    it('should include agents without a2a config (default discoverable)', () => {
      const config = createMockConfig(); // No a2a config
      const configs = new Map([['test', config]]);
      vi.mocked(mockRegistry.getAllConfigs).mockReturnValue(configs);

      const generator = new AgentCardGenerator(mockRegistry, 'http://localhost:8001');
      const card = generator.generateServiceCard();

      expect(card.skills).toHaveLength(1);
    });

    it('should handle multiple agents', () => {
      const config1 = createMockConfig({
        id: 'agent-1',
        path: 'agent1',
        name: 'Agent One',
        a2a: { discoverable: true, capabilities: [] },
      });
      const config2 = createMockConfig({
        id: 'agent-2',
        path: 'agent2',
        name: 'Agent Two',
        a2a: { discoverable: true, capabilities: [] },
      });
      const configs = new Map([
        ['agent1', config1],
        ['agent2', config2],
      ]);
      vi.mocked(mockRegistry.getAllConfigs).mockReturnValue(configs);

      const generator = new AgentCardGenerator(mockRegistry, 'http://localhost:8001');
      const card = generator.generateServiceCard();

      expect(card.skills).toHaveLength(2);
    });
  });

  describe('generateAgentCard', () => {
    it('should generate card for discoverable agent', () => {
      const config = createMockConfig({
        a2a: { discoverable: true, capabilities: [] },
      });
      vi.mocked(mockRegistry.getConfig).mockReturnValue(config);

      const generator = new AgentCardGenerator(mockRegistry, 'http://localhost:8001');
      const card = generator.generateAgentCard('test');

      expect(card).not.toBeNull();
      expect(card!.name).toBe('Test Agent');
      expect(card!.description).toBe('A test agent');
      expect(card!.url).toBe('http://localhost:8001/agents/test');
      expect(card!.skills).toHaveLength(1);
    });

    it('should return null for non-discoverable agent', () => {
      const config = createMockConfig({
        a2a: { discoverable: false, capabilities: [] },
      });
      vi.mocked(mockRegistry.getConfig).mockReturnValue(config);

      const generator = new AgentCardGenerator(mockRegistry, 'http://localhost:8001');
      const card = generator.generateAgentCard('test');

      expect(card).toBeNull();
    });

    it('should return null for non-existent agent', () => {
      vi.mocked(mockRegistry.getConfig).mockImplementation(() => {
        throw new Error('Agent not found');
      });

      const generator = new AgentCardGenerator(mockRegistry, 'http://localhost:8001');
      const card = generator.generateAgentCard('nonexistent');

      expect(card).toBeNull();
    });

    it('should include capabilities in agent card', () => {
      const config = createMockConfig({
        a2a: {
          discoverable: true,
          capabilities: [
            {
              id: 'cap-1',
              name: 'Capability',
              description: 'A capability',
              tags: ['tag'],
            },
          ],
        },
      });
      vi.mocked(mockRegistry.getConfig).mockReturnValue(config);

      const generator = new AgentCardGenerator(mockRegistry, 'http://localhost:8001');
      const card = generator.generateAgentCard('test');

      expect(card!.skills).toHaveLength(2); // agent + 1 capability
      expect(card!.skills[1].id).toBe('cap-1'); // Not prefixed with agent id
    });

    it('should generate card for agent without a2a config', () => {
      const config = createMockConfig(); // No a2a config
      vi.mocked(mockRegistry.getConfig).mockReturnValue(config);

      const generator = new AgentCardGenerator(mockRegistry, 'http://localhost:8001');
      const card = generator.generateAgentCard('test');

      expect(card).not.toBeNull();
      expect(card!.skills).toHaveLength(1);
    });
  });
});
