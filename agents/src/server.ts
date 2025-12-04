import express, { type Express } from 'express';
import cors from 'cors';
import { AgentRegistry } from './core/registry.js';
import { A2aExecutor } from './a2a/executor.js';
import { AgentCardGenerator } from './a2a/card-generator.js';
import { createAgentRoutes } from './routes/agents.js';
import { createA2aRoutes } from './routes/a2a.js';
import { createHealthRoutes } from './routes/health.js';
import { createWellKnownRoutes } from './routes/well-known.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { Logger } from './utils/logger.js';

export interface ServerConfig {
  port: number;
  baseUrl: string;
  agentConfigPath: string;
}

export interface ServerInstance {
  app: Express;
  registry: AgentRegistry;
  executor: A2aExecutor;
  shutdown: () => Promise<void>;
}

export async function createServer(config: ServerConfig): Promise<ServerInstance> {
  const logger = new Logger('Server');
  const app = express();

  // Enable CORS for cross-origin requests (e.g., chat widget)
  app.use(cors({
    origin: true, // Allow all origins (configure for production)
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
  }));

  app.use(express.json());
  app.use(requestLogger);

  const registry = new AgentRegistry(config.agentConfigPath);
  await registry.loadAll();

  const executor = new A2aExecutor(registry);
  const cardGenerator = new AgentCardGenerator(registry, config.baseUrl);

  app.use('/agents', createAgentRoutes(registry));
  app.use('/a2a', createA2aRoutes(executor));
  app.use('/health', createHealthRoutes(registry));
  app.use('/.well-known', createWellKnownRoutes(cardGenerator));

  app.get('/', (_req, res) => {
    res.json({
      name: 'AI Agents Framework',
      version: '1.0.0',
      endpoints: {
        agents: '/agents',
        health: '/health',
        a2a: '/a2a',
        discovery: '/.well-known/agent.json',
      },
    });
  });

  app.use(errorHandler);

  logger.info('Server configured', {
    agentCount: registry.getAll().size,
    agents: registry.list().map((a) => a.path),
  });

  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down server');
    await registry.shutdownAll();
    logger.info('Server shutdown complete');
  };

  return { app, registry, executor, shutdown };
}

export async function startServer(config: ServerConfig): Promise<void> {
  const logger = new Logger('Server');

  const { app, shutdown } = await createServer(config);

  const server = app.listen(config.port, () => {
    logger.info('Server started', {
      port: config.port,
      url: config.baseUrl,
    });
  });

  const gracefulShutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, initiating graceful shutdown`);

    server.close(async () => {
      await shutdown();
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}
