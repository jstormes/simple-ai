import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { A2aExecutor } from '../a2a/executor.js';
import { asyncHandler } from '../middleware/error-handler.js';
import { ValidationError, A2aTaskError } from '../utils/errors.js';

const CreateTaskSchema = z.object({
  agentPath: z.string().min(1, 'Agent path is required'),
  message: z.string().min(1, 'Message is required'),
  contextId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export function createA2aRoutes(executor: A2aExecutor): Router {
  const router = Router();

  router.post(
    '/tasks',
    asyncHandler(async (req: Request, res: Response) => {
      const parseResult = CreateTaskSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError('Invalid request body', parseResult.error.errors);
      }

      const task = await executor.createTask(parseResult.data);

      res.status(201).json({
        success: true,
        data: {
          taskId: task.taskId,
          status: task.status,
          createdAt: task.createdAt,
        },
        traceId: req.traceId,
      });
    })
  );

  router.get(
    '/tasks/:taskId',
    asyncHandler(async (req: Request, res: Response) => {
      const { taskId } = req.params;
      const task = executor.getTask(taskId);

      if (!task) {
        throw new A2aTaskError('Task not found', taskId);
      }

      res.json({
        success: true,
        data: task,
        traceId: req.traceId,
      });
    })
  );

  router.post(
    '/tasks/:taskId/cancel',
    asyncHandler(async (req: Request, res: Response) => {
      const { taskId } = req.params;
      const cancelled = executor.cancelTask(taskId);

      if (!cancelled) {
        throw new A2aTaskError('Task cannot be cancelled', taskId);
      }

      res.json({
        success: true,
        data: { taskId, status: 'cancelled' },
        traceId: req.traceId,
      });
    })
  );

  router.get(
    '/tasks/:taskId/stream',
    asyncHandler(async (req: Request, res: Response) => {
      const { taskId } = req.params;
      const task = executor.getTask(taskId);

      if (!task) {
        throw new A2aTaskError('Task not found', taskId);
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Trace-ID', req.traceId);

      for await (const event of executor.executeTaskStream(taskId)) {
        res.write(`event: ${event.type}\n`);
        res.write(`data: ${JSON.stringify(event.data)}\n\n`);
      }

      res.end();
    })
  );

  router.get('/tasks', (req: Request, res: Response) => {
    const agentPath = req.query.agentPath as string | undefined;
    const tasks = executor.listTasks(agentPath);

    res.json({
      success: true,
      data: tasks.map((t) => ({
        taskId: t.taskId,
        agentPath: t.agentPath,
        status: t.status,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      traceId: req.traceId,
    });
  });

  return router;
}
