import { v4 as uuidv4 } from 'uuid';
import type { AgentRegistry } from '../core/registry.js';
import type {
  A2aTask,
  A2aTaskCreateRequest,
  A2aTaskStatus,
  A2aStreamEvent,
} from '../types/a2a.js';
import { AgentNotFoundError, A2aTaskError } from '../utils/errors.js';
import { Logger } from '../utils/logger.js';

export class A2aExecutor {
  private registry: AgentRegistry;
  private tasks = new Map<string, A2aTask>();
  private logger: Logger;

  constructor(registry: AgentRegistry) {
    this.registry = registry;
    this.logger = new Logger('A2AExecutor');
  }

  async createTask(request: A2aTaskCreateRequest): Promise<A2aTask> {
    const taskId = uuidv4();
    const now = new Date().toISOString();

    if (!this.registry.has(request.agentPath)) {
      throw new AgentNotFoundError(request.agentPath);
    }

    const task: A2aTask = {
      taskId,
      contextId: request.contextId,
      status: 'pending',
      agentPath: request.agentPath,
      message: request.message,
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.set(taskId, task);
    this.logger.info('Created A2A task', { taskId, agentPath: request.agentPath });

    this.executeTaskAsync(taskId);

    return task;
  }

  private async executeTaskAsync(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return;
    }

    try {
      this.updateTaskStatus(taskId, 'in_progress');

      const agent = this.registry.get(task.agentPath);
      const result = await agent.execute({ message: task.message });

      task.result = result;
      this.updateTaskStatus(taskId, 'completed');

      this.logger.info('A2A task completed', { taskId });
    } catch (error) {
      this.logger.error('A2A task failed', { taskId, error });

      task.error = error instanceof Error ? error.message : 'Unknown error';
      this.updateTaskStatus(taskId, 'failed');
    }
  }

  async *executeTaskStream(taskId: string): AsyncIterable<A2aStreamEvent> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new A2aTaskError('Task not found', taskId);
    }

    try {
      this.updateTaskStatus(taskId, 'in_progress');
      yield { type: 'status', taskId, data: { status: 'in_progress' } };

      const agent = this.registry.get(task.agentPath);
      let fullText = '';

      for await (const chunk of agent.stream({ message: task.message })) {
        switch (chunk.type) {
          case 'text':
            fullText += chunk.content as string;
            yield { type: 'text', taskId, data: chunk.content };
            break;
          case 'tool-call':
          case 'tool-result':
            yield { type: 'artifact', taskId, data: chunk };
            break;
          case 'error':
            yield { type: 'error', taskId, data: chunk.content };
            break;
          case 'finish':
            break;
        }
      }

      task.result = { text: fullText };
      this.updateTaskStatus(taskId, 'completed');
      yield { type: 'complete', taskId, data: { status: 'completed', result: task.result } };

      this.logger.info('A2A streaming task completed', { taskId });
    } catch (error) {
      this.logger.error('A2A streaming task failed', { taskId, error });

      task.error = error instanceof Error ? error.message : 'Unknown error';
      this.updateTaskStatus(taskId, 'failed');
      yield { type: 'error', taskId, data: task.error };
    }
  }

  private updateTaskStatus(taskId: string, status: A2aTaskStatus): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
      task.updatedAt = new Date().toISOString();
    }
  }

  getTask(taskId: string): A2aTask | undefined {
    return this.tasks.get(taskId);
  }

  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
      return false;
    }

    this.updateTaskStatus(taskId, 'cancelled');
    this.logger.info('A2A task cancelled', { taskId });
    return true;
  }

  listTasks(agentPath?: string): A2aTask[] {
    const tasks = Array.from(this.tasks.values());
    if (agentPath) {
      return tasks.filter((t) => t.agentPath === agentPath);
    }
    return tasks;
  }

  cleanupOldTasks(maxAgeMs: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [taskId, task] of this.tasks) {
      const taskAge = now - new Date(task.updatedAt).getTime();
      if (taskAge > maxAgeMs && (task.status === 'completed' || task.status === 'failed')) {
        this.tasks.delete(taskId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.info('Cleaned up old tasks', { count: cleaned });
    }

    return cleaned;
  }
}
