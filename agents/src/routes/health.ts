import { Router, type Request, type Response } from 'express';
import type { AgentRegistry } from '../core/registry.js';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  agents: AgentHealth[];
}

interface AgentHealth {
  id: string;
  path: string;
  status: 'healthy' | 'unhealthy';
  mcpConnections: number;
}

const startTime = Date.now();

export function createHealthRoutes(registry: AgentRegistry): Router {
  const router = Router();

  router.get('/', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  router.get('/ready', (_req: Request, res: Response) => {
    const agents: AgentHealth[] = [];
    let overallHealthy = true;

    for (const [path, agent] of registry.getAll()) {
      const mcpCount = agent.mcpClients.size;
      const isHealthy = true;

      if (!isHealthy) overallHealthy = false;

      agents.push({
        id: agent.config.id,
        path,
        status: isHealthy ? 'healthy' : 'unhealthy',
        mcpConnections: mcpCount,
      });
    }

    const status: HealthStatus = {
      status: agents.length === 0 ? 'degraded' : overallHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - startTime,
      agents,
    };

    const httpStatus = status.status === 'healthy' ? 200 : 503;
    res.status(httpStatus).json(status);
  });

  router.get('/live', (_req: Request, res: Response) => {
    res.json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - startTime,
    });
  });

  return router;
}
