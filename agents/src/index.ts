import 'dotenv/config';
import { startServer } from './server.js';
import { envConfig } from './config/env.js';
import { Logger } from './utils/logger.js';

const logger = new Logger('Main');

async function main(): Promise<void> {
  logger.info('Starting AI Agents Framework', {
    nodeEnv: envConfig.nodeEnv,
    port: envConfig.port,
  });

  try {
    await startServer({
      port: envConfig.port,
      baseUrl: envConfig.baseUrl,
      agentConfigPath: envConfig.agentConfigPath,
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

main();
