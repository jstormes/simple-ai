import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AgentConfigSchema, type AgentConfig, type RuntimeAgent } from '../types/agent.js';
import { AgentFactory } from './agent-factory.js';
import { AgentConfigError, AgentNotFoundError } from '../utils/errors.js';
import { Logger } from '../utils/logger.js';

export class AgentRegistry {
  private agents = new Map<string, RuntimeAgent>();
  private configs = new Map<string, AgentConfig>();
  private configPath: string;
  private logger: Logger;

  constructor(configPath: string = './agents') {
    this.configPath = configPath;
    this.logger = new Logger('AgentRegistry');
  }

  async loadAll(): Promise<void> {
    this.logger.info('Loading agent configurations', { path: this.configPath });

    let files: string[];
    try {
      files = await readdir(this.configPath);
    } catch (error) {
      this.logger.warn('Agent config directory not found, creating empty registry', {
        path: this.configPath,
      });
      return;
    }

    const jsonFiles = files.filter((f) => f.endsWith('.json'));
    this.logger.info('Found agent config files', { count: jsonFiles.length });

    for (const file of jsonFiles) {
      await this.loadConfig(file);
    }

    this.logger.info('Agent registry loaded', {
      agentCount: this.agents.size,
      agents: Array.from(this.agents.keys()),
    });
  }

  private async loadConfig(file: string): Promise<void> {
    const filePath = join(this.configPath, file);

    try {
      const content = await readFile(filePath, 'utf-8');
      const raw = JSON.parse(content);
      const config = AgentConfigSchema.parse(raw);

      if (this.agents.has(config.path)) {
        throw new AgentConfigError(
          `Duplicate agent path: ${config.path}`,
          file
        );
      }

      const agent = AgentFactory.createLazy(config);
      this.agents.set(config.path, agent);
      this.configs.set(config.path, config);

      this.logger.info('Loaded agent config', {
        id: config.id,
        path: config.path,
        file,
      });
    } catch (error) {
      if (error instanceof AgentConfigError) {
        throw error;
      }

      this.logger.error('Failed to load agent config', { file, error });
      throw new AgentConfigError(
        `Invalid config in ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        file,
        { cause: error }
      );
    }
  }

  get(path: string): RuntimeAgent {
    const agent = this.agents.get(path);
    if (!agent) {
      throw new AgentNotFoundError(path);
    }
    return agent;
  }

  getConfig(path: string): AgentConfig {
    const config = this.configs.get(path);
    if (!config) {
      throw new AgentNotFoundError(path);
    }
    return config;
  }

  has(path: string): boolean {
    return this.agents.has(path);
  }

  getAll(): Map<string, RuntimeAgent> {
    return new Map(this.agents);
  }

  getAllConfigs(): Map<string, AgentConfig> {
    return new Map(this.configs);
  }

  list(): Array<{ path: string; id: string; name: string; description: string }> {
    return Array.from(this.configs.entries()).map(([path, config]) => ({
      path,
      id: config.id,
      name: config.name,
      description: config.description,
    }));
  }

  async reload(path: string): Promise<void> {
    const config = this.configs.get(path);
    if (!config) {
      throw new AgentNotFoundError(path);
    }

    const existingAgent = this.agents.get(path);
    if (existingAgent) {
      await existingAgent.shutdown();
    }

    const file = `${config.id}.json`;
    await this.loadConfig(file);

    this.logger.info('Reloaded agent', { path });
  }

  async shutdownAll(): Promise<void> {
    this.logger.info('Shutting down all agents');

    const shutdownPromises = Array.from(this.agents.values()).map((agent) =>
      agent.shutdown().catch((error) => {
        this.logger.error('Error shutting down agent', {
          id: agent.config.id,
          error,
        });
      })
    );

    await Promise.all(shutdownPromises);
    this.agents.clear();
    this.configs.clear();

    this.logger.info('All agents shut down');
  }
}
