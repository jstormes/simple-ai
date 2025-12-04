import type { AgentCard, AgentSkill } from '../types/a2a.js';
import type { AgentRegistry } from '../core/registry.js';

export class AgentCardGenerator {
  private registry: AgentRegistry;
  private baseUrl: string;

  constructor(registry: AgentRegistry, baseUrl: string) {
    this.registry = registry;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  generateServiceCard(): AgentCard {
    const skills: AgentSkill[] = [];

    for (const [path, config] of this.registry.getAllConfigs()) {
      if (config.a2a?.discoverable !== false) {
        skills.push({
          id: config.id,
          name: config.name,
          description: config.description,
          tags: ['agent', path],
        });

        if (config.a2a?.capabilities) {
          for (const cap of config.a2a.capabilities) {
            skills.push({
              id: `${config.id}:${cap.id}`,
              name: cap.name,
              description: cap.description,
              tags: cap.tags,
            });
          }
        }
      }
    }

    return {
      name: 'AI Agents Service',
      description: 'Multi-agent service with MCP and A2A protocol support',
      protocolVersion: '1.0',
      version: '1.0.0',
      url: this.baseUrl,
      skills,
    };
  }

  generateAgentCard(path: string): AgentCard | null {
    try {
      const config = this.registry.getConfig(path);

      if (config.a2a?.discoverable === false) {
        return null;
      }

      const skills: AgentSkill[] = [
        {
          id: config.id,
          name: config.name,
          description: config.description,
          tags: ['agent'],
        },
      ];

      if (config.a2a?.capabilities) {
        for (const cap of config.a2a.capabilities) {
          skills.push({
            id: cap.id,
            name: cap.name,
            description: cap.description,
            tags: cap.tags,
          });
        }
      }

      return {
        name: config.name,
        description: config.description,
        protocolVersion: '1.0',
        version: '1.0.0',
        url: `${this.baseUrl}/agents/${path}`,
        skills,
      };
    } catch {
      return null;
    }
  }
}
