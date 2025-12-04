import type { AgentConfig, RuntimeAgent } from '../types/agent.js';
import { BaseAgent } from './base-agent.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('AgentFactory');

export class AgentFactory {
  static async create(config: AgentConfig): Promise<RuntimeAgent> {
    logger.info('Creating agent', { id: config.id, path: config.path });

    const agent = new BaseAgent(config);
    await agent.initialize();

    logger.info('Agent created successfully', { id: config.id });
    return agent;
  }

  static createLazy(config: AgentConfig): RuntimeAgent {
    logger.info('Creating lazy agent', { id: config.id, path: config.path });
    return new BaseAgent(config);
  }
}
