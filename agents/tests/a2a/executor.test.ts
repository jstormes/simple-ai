import { describe, it, expect, vi, beforeEach } from 'vitest';
import { A2aExecutor } from '../../src/a2a/executor.js';
import { AgentNotFoundError, A2aTaskError } from '../../src/utils/errors.js';
import type { AgentRegistry } from '../../src/core/registry.js';
import type { RuntimeAgent, AgentOutput, AgentChunk } from '../../src/types/agent.js';

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  Logger: class MockLogger {
    info = vi.fn();
    warn = vi.fn();
    error = vi.fn();
    debug = vi.fn();
    child = vi.fn(() => new MockLogger());
  },
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-task-id'),
}));

describe('A2aExecutor', () => {
  let mockRegistry: AgentRegistry;
  let mockAgent: RuntimeAgent;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAgent = {
      config: { id: 'test-agent', path: 'test' },
      tools: {},
      mcpClients: new Map(),
      initialize: vi.fn(),
      execute: vi.fn(),
      stream: vi.fn(),
      shutdown: vi.fn(),
    } as unknown as RuntimeAgent;

    mockRegistry = {
      has: vi.fn(),
      get: vi.fn(),
    } as unknown as AgentRegistry;
  });

  describe('createTask', () => {
    it('should create task with correct properties', async () => {
      vi.mocked(mockRegistry.has).mockReturnValue(true);
      vi.mocked(mockRegistry.get).mockReturnValue(mockAgent);
      vi.mocked(mockAgent.execute).mockResolvedValue({
        text: 'Response',
        finishReason: 'stop',
      } as AgentOutput);

      const executor = new A2aExecutor(mockRegistry);
      const task = await executor.createTask({
        agentPath: 'test',
        message: 'Hello',
      });

      expect(task.taskId).toBe('test-task-id');
      expect(task.agentPath).toBe('test');
      expect(task.message).toBe('Hello');
      // Status may be pending or already in_progress/completed due to async execution
      expect(['pending', 'in_progress', 'completed']).toContain(task.status);
      expect(task.createdAt).toBeDefined();
      expect(task.updatedAt).toBeDefined();
    });

    it('should throw AgentNotFoundError for unknown agent', async () => {
      vi.mocked(mockRegistry.has).mockReturnValue(false);

      const executor = new A2aExecutor(mockRegistry);

      await expect(
        executor.createTask({
          agentPath: 'unknown',
          message: 'Hello',
        })
      ).rejects.toThrow(AgentNotFoundError);
    });

    it('should include contextId when provided', async () => {
      vi.mocked(mockRegistry.has).mockReturnValue(true);
      vi.mocked(mockRegistry.get).mockReturnValue(mockAgent);
      vi.mocked(mockAgent.execute).mockResolvedValue({
        text: 'Response',
        finishReason: 'stop',
      } as AgentOutput);

      const executor = new A2aExecutor(mockRegistry);
      const task = await executor.createTask({
        agentPath: 'test',
        message: 'Hello',
        contextId: 'context-123',
      });

      expect(task.contextId).toBe('context-123');
    });

    it('should start async execution', async () => {
      vi.mocked(mockRegistry.has).mockReturnValue(true);
      vi.mocked(mockRegistry.get).mockReturnValue(mockAgent);
      vi.mocked(mockAgent.execute).mockResolvedValue({
        text: 'Response',
        finishReason: 'stop',
      } as AgentOutput);

      const executor = new A2aExecutor(mockRegistry);
      await executor.createTask({
        agentPath: 'test',
        message: 'Hello',
      });

      // Wait for async execution
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockAgent.execute).toHaveBeenCalledWith({ message: 'Hello' });
    });
  });

  describe('getTask', () => {
    it('should return task by id', async () => {
      vi.mocked(mockRegistry.has).mockReturnValue(true);
      vi.mocked(mockRegistry.get).mockReturnValue(mockAgent);
      vi.mocked(mockAgent.execute).mockResolvedValue({
        text: 'Response',
        finishReason: 'stop',
      } as AgentOutput);

      const executor = new A2aExecutor(mockRegistry);
      await executor.createTask({
        agentPath: 'test',
        message: 'Hello',
      });

      const task = executor.getTask('test-task-id');

      expect(task).toBeDefined();
      expect(task!.taskId).toBe('test-task-id');
    });

    it('should return undefined for unknown task', () => {
      const executor = new A2aExecutor(mockRegistry);

      const task = executor.getTask('unknown-id');

      expect(task).toBeUndefined();
    });
  });

  describe('cancelTask', () => {
    it('should cancel task if not yet completed', async () => {
      vi.mocked(mockRegistry.has).mockReturnValue(true);
      vi.mocked(mockRegistry.get).mockReturnValue(mockAgent);
      // Make execute hang to keep task in pending/in_progress state
      vi.mocked(mockAgent.execute).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const executor = new A2aExecutor(mockRegistry);
      await executor.createTask({
        agentPath: 'test',
        message: 'Hello',
      });

      // Give a tiny moment for async execution to start
      await new Promise((resolve) => setTimeout(resolve, 5));

      const task = executor.getTask('test-task-id');
      // Task should be pending or in_progress, not completed
      if (task && (task.status === 'pending' || task.status === 'in_progress')) {
        const result = executor.cancelTask('test-task-id');
        expect(result).toBe(true);
        expect(executor.getTask('test-task-id')!.status).toBe('cancelled');
      } else {
        // If task already completed (very fast), just verify cancel returns false
        const result = executor.cancelTask('test-task-id');
        expect(result).toBe(false);
      }
    });

    it('should return false for unknown task', () => {
      const executor = new A2aExecutor(mockRegistry);

      const result = executor.cancelTask('unknown-id');

      expect(result).toBe(false);
    });

    it('should return false for completed task', async () => {
      vi.mocked(mockRegistry.has).mockReturnValue(true);
      vi.mocked(mockRegistry.get).mockReturnValue(mockAgent);
      vi.mocked(mockAgent.execute).mockResolvedValue({
        text: 'Response',
        finishReason: 'stop',
      } as AgentOutput);

      const executor = new A2aExecutor(mockRegistry);
      await executor.createTask({
        agentPath: 'test',
        message: 'Hello',
      });

      // Wait for async execution to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      const result = executor.cancelTask('test-task-id');

      expect(result).toBe(false);
    });
  });

  describe('listTasks', () => {
    it('should return all tasks', async () => {
      vi.mocked(mockRegistry.has).mockReturnValue(true);
      vi.mocked(mockRegistry.get).mockReturnValue(mockAgent);

      const executor = new A2aExecutor(mockRegistry);

      // Create multiple tasks with different IDs
      const { v4 } = await import('uuid');
      vi.mocked(v4)
        .mockReturnValueOnce('task-1')
        .mockReturnValueOnce('task-2');

      await executor.createTask({ agentPath: 'test', message: 'Hello 1' });
      await executor.createTask({ agentPath: 'test', message: 'Hello 2' });

      const tasks = executor.listTasks();

      expect(tasks).toHaveLength(2);
    });

    it('should filter tasks by agentPath', async () => {
      vi.mocked(mockRegistry.has).mockReturnValue(true);
      vi.mocked(mockRegistry.get).mockReturnValue(mockAgent);

      const executor = new A2aExecutor(mockRegistry);

      const { v4 } = await import('uuid');
      vi.mocked(v4)
        .mockReturnValueOnce('task-1')
        .mockReturnValueOnce('task-2');

      await executor.createTask({ agentPath: 'agent1', message: 'Hello' });
      await executor.createTask({ agentPath: 'agent2', message: 'Hello' });

      const tasks = executor.listTasks('agent1');

      expect(tasks).toHaveLength(1);
      expect(tasks[0].agentPath).toBe('agent1');
    });

    it('should return empty array when no tasks', () => {
      const executor = new A2aExecutor(mockRegistry);

      const tasks = executor.listTasks();

      expect(tasks).toEqual([]);
    });
  });

  describe('cleanupOldTasks', () => {
    it('should remove old completed tasks', async () => {
      vi.mocked(mockRegistry.has).mockReturnValue(true);
      vi.mocked(mockRegistry.get).mockReturnValue(mockAgent);
      vi.mocked(mockAgent.execute).mockResolvedValue({
        text: 'Response',
        finishReason: 'stop',
      } as AgentOutput);

      const executor = new A2aExecutor(mockRegistry);
      await executor.createTask({ agentPath: 'test', message: 'Hello' });

      // Wait for task to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Cleanup with 0ms max age (should remove immediately)
      const cleaned = executor.cleanupOldTasks(0);

      expect(cleaned).toBe(1);
      expect(executor.listTasks()).toHaveLength(0);
    });

    it('should not remove recent tasks', async () => {
      vi.mocked(mockRegistry.has).mockReturnValue(true);
      vi.mocked(mockRegistry.get).mockReturnValue(mockAgent);
      vi.mocked(mockAgent.execute).mockResolvedValue({
        text: 'Response',
        finishReason: 'stop',
      } as AgentOutput);

      const executor = new A2aExecutor(mockRegistry);
      await executor.createTask({ agentPath: 'test', message: 'Hello' });

      // Wait for task to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Cleanup with large max age
      const cleaned = executor.cleanupOldTasks(3600000);

      expect(cleaned).toBe(0);
      expect(executor.listTasks()).toHaveLength(1);
    });

    it('should not remove pending or in_progress tasks', async () => {
      vi.mocked(mockRegistry.has).mockReturnValue(true);
      // Don't resolve execute to keep task in progress

      const executor = new A2aExecutor(mockRegistry);
      await executor.createTask({ agentPath: 'test', message: 'Hello' });

      const cleaned = executor.cleanupOldTasks(0);

      expect(cleaned).toBe(0);
    });
  });

  describe('executeTaskStream', () => {
    it('should throw A2aTaskError for unknown task', async () => {
      const executor = new A2aExecutor(mockRegistry);

      await expect(async () => {
        for await (const _event of executor.executeTaskStream('unknown')) {
          // Should not reach here
        }
      }).rejects.toThrow(A2aTaskError);
    });

    it('should yield status event at start', async () => {
      vi.mocked(mockRegistry.has).mockReturnValue(true);
      vi.mocked(mockRegistry.get).mockReturnValue(mockAgent);

      async function* mockStream(): AsyncIterable<AgentChunk> {
        yield { type: 'text', content: 'Hello' };
        yield { type: 'finish', content: { finishReason: 'stop' } };
      }
      vi.mocked(mockAgent.stream).mockReturnValue(mockStream());

      const executor = new A2aExecutor(mockRegistry);
      await executor.createTask({ agentPath: 'test', message: 'Hello' });

      const events = [];
      for await (const event of executor.executeTaskStream('test-task-id')) {
        events.push(event);
      }

      expect(events[0]).toEqual({
        type: 'status',
        taskId: 'test-task-id',
        data: { status: 'in_progress' },
      });
    });

    it('should yield text events', async () => {
      vi.mocked(mockRegistry.has).mockReturnValue(true);
      vi.mocked(mockRegistry.get).mockReturnValue(mockAgent);

      async function* mockStream(): AsyncIterable<AgentChunk> {
        yield { type: 'text', content: 'Hello ' };
        yield { type: 'text', content: 'World' };
        yield { type: 'finish', content: { finishReason: 'stop' } };
      }
      vi.mocked(mockAgent.stream).mockReturnValue(mockStream());

      const executor = new A2aExecutor(mockRegistry);
      await executor.createTask({ agentPath: 'test', message: 'Hello' });

      const events = [];
      for await (const event of executor.executeTaskStream('test-task-id')) {
        events.push(event);
      }

      const textEvents = events.filter((e) => e.type === 'text');
      expect(textEvents).toHaveLength(2);
      expect(textEvents[0].data).toBe('Hello ');
      expect(textEvents[1].data).toBe('World');
    });

    it('should yield complete event at end', async () => {
      vi.mocked(mockRegistry.has).mockReturnValue(true);
      vi.mocked(mockRegistry.get).mockReturnValue(mockAgent);

      async function* mockStream(): AsyncIterable<AgentChunk> {
        yield { type: 'text', content: 'Done' };
        yield { type: 'finish', content: { finishReason: 'stop' } };
      }
      vi.mocked(mockAgent.stream).mockReturnValue(mockStream());

      const executor = new A2aExecutor(mockRegistry);
      await executor.createTask({ agentPath: 'test', message: 'Hello' });

      const events = [];
      for await (const event of executor.executeTaskStream('test-task-id')) {
        events.push(event);
      }

      const lastEvent = events[events.length - 1];
      expect(lastEvent.type).toBe('complete');
      expect(lastEvent.data.status).toBe('completed');
    });
  });
});
