import { Router, type Request, type Response } from 'express';
import type { AgentCardGenerator } from '../a2a/card-generator.js';

export function createWellKnownRoutes(cardGenerator: AgentCardGenerator): Router {
  const router = Router();

  router.get('/agent.json', (_req: Request, res: Response) => {
    const card = cardGenerator.generateServiceCard();
    res.json(card);
  });

  router.get('/agents/:agentPath/agent.json', (req: Request, res: Response) => {
    const { agentPath } = req.params;
    const card = cardGenerator.generateAgentCard(agentPath);

    if (!card) {
      res.status(404).json({
        error: {
          code: 'AGENT_NOT_FOUND',
          message: `Agent not found or not discoverable: ${agentPath}`,
        },
      });
      return;
    }

    res.json(card);
  });

  return router;
}
