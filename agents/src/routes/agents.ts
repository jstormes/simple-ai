import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { AgentRegistry } from '../core/registry.js';
import { asyncHandler } from '../middleware/error-handler.js';
import { ValidationError } from '../utils/errors.js';

const ChatRequestSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  conversationId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export function createAgentRoutes(registry: AgentRegistry): Router {
  const router = Router();

  router.get('/', (_req: Request, res: Response) => {
    const agents = registry.list();
    res.json({ agents });
  });

  router.get(
    '/:agentPath',
    asyncHandler(async (req: Request, res: Response) => {
      const { agentPath } = req.params;
      const config = registry.getConfig(agentPath);

      res.json({
        id: config.id,
        path: config.path,
        name: config.name,
        description: config.description,
        model: config.model,
        enableTools: config.enableTools,
        a2a: config.a2a,
      });
    })
  );

  router.post(
    '/:agentPath/chat',
    asyncHandler(async (req: Request, res: Response) => {
      const { agentPath } = req.params;

      const parseResult = ChatRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError('Invalid request body', parseResult.error.errors);
      }

      const { message, conversationId, metadata } = parseResult.data;
      const agent = registry.get(agentPath);

      const result = await agent.execute({
        message,
        conversationId,
        metadata,
      });

      res.json({
        success: true,
        data: result,
        traceId: req.traceId,
      });
    })
  );

  router.post(
    '/:agentPath/stream',
    asyncHandler(async (req: Request, res: Response) => {
      const { agentPath } = req.params;

      const parseResult = ChatRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError('Invalid request body', parseResult.error.errors);
      }

      const { message, conversationId, metadata } = parseResult.data;
      const agent = registry.get(agentPath);

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Trace-ID', req.traceId);

      res.write(`data: ${JSON.stringify({ type: 'start', traceId: req.traceId })}\n\n`);

      try {
        for await (const chunk of agent.stream({ message, conversationId, metadata })) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }

        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      } catch (error) {
        res.write(
          `data: ${JSON.stringify({
            type: 'error',
            content: error instanceof Error ? error.message : 'Unknown error',
          })}\n\n`
        );
      }

      res.end();
    })
  );

  return router;
}
