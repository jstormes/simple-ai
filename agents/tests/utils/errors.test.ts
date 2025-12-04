import { describe, it, expect } from 'vitest';
import {
  BaseError,
  AgentNotFoundError,
  AgentConfigError,
  McpConnectionError,
  AgentExecutionError,
  ValidationError,
  A2aTaskError,
  isBaseError,
} from '../../src/utils/errors.js';

describe('BaseError', () => {
  it('should create error with correct properties', () => {
    const error = new BaseError('Test message', 'TEST_CODE', 500);

    expect(error.message).toBe('Test message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.statusCode).toBe(500);
    expect(error.timestamp).toBeDefined();
    expect(error.name).toBe('BaseError');
    expect(error.stack).toBeDefined();
  });

  it('should serialize to JSON correctly', () => {
    const error = new BaseError('Test message', 'TEST_CODE', 500);
    const json = error.toJSON();

    expect(json).toEqual({
      code: 'TEST_CODE',
      message: 'Test message',
      timestamp: error.timestamp,
    });
  });

  it('should have valid ISO timestamp', () => {
    const error = new BaseError('Test', 'TEST', 500);
    const parsed = new Date(error.timestamp);

    expect(parsed.toISOString()).toBe(error.timestamp);
  });
});

describe('AgentNotFoundError', () => {
  it('should create error with agent path', () => {
    const error = new AgentNotFoundError('my-agent');

    expect(error.message).toBe('Agent not found: my-agent');
    expect(error.code).toBe('AGENT_NOT_FOUND');
    expect(error.statusCode).toBe(404);
    expect(error.agentPath).toBe('my-agent');
    expect(error.name).toBe('AgentNotFoundError');
  });

  it('should include agentId in JSON', () => {
    const error = new AgentNotFoundError('test-agent');
    const json = error.toJSON();

    expect(json.agentId).toBe('test-agent');
    expect(json.code).toBe('AGENT_NOT_FOUND');
    expect(json.message).toBe('Agent not found: test-agent');
  });
});

describe('AgentConfigError', () => {
  it('should create error with message only', () => {
    const error = new AgentConfigError('Invalid config');

    expect(error.message).toBe('Invalid config');
    expect(error.code).toBe('AGENT_CONFIG_ERROR');
    expect(error.statusCode).toBe(500);
    expect(error.configFile).toBeUndefined();
  });

  it('should create error with config file', () => {
    const error = new AgentConfigError('Invalid config', 'agent.json');

    expect(error.configFile).toBe('agent.json');
  });

  it('should support cause chaining', () => {
    const cause = new Error('Root cause');
    const error = new AgentConfigError('Invalid config', 'agent.json', { cause });

    expect(error.cause).toBe(cause);
  });

  it('should include configFile in JSON when present', () => {
    const error = new AgentConfigError('Invalid config', 'agent.json');
    const json = error.toJSON();

    expect(json.configFile).toBe('agent.json');
  });

  it('should exclude configFile from JSON when not present', () => {
    const error = new AgentConfigError('Invalid config');
    const json = error.toJSON();

    expect(json).not.toHaveProperty('configFile');
  });
});

describe('McpConnectionError', () => {
  it('should create error with server ID', () => {
    const error = new McpConnectionError('mcp-server-1');

    expect(error.message).toBe('Failed to connect to MCP server: mcp-server-1');
    expect(error.code).toBe('MCP_CONNECTION_ERROR');
    expect(error.statusCode).toBe(503);
    expect(error.serverId).toBe('mcp-server-1');
  });

  it('should support cause chaining', () => {
    const cause = new Error('Connection refused');
    const error = new McpConnectionError('mcp-server-1', cause);

    expect(error.cause).toBe(cause);
  });

  it('should include serverId in JSON', () => {
    const error = new McpConnectionError('mcp-server-1');
    const json = error.toJSON();

    expect(json.serverId).toBe('mcp-server-1');
  });
});

describe('AgentExecutionError', () => {
  it('should create error with message only', () => {
    const error = new AgentExecutionError('Execution failed');

    expect(error.message).toBe('Execution failed');
    expect(error.code).toBe('AGENT_EXECUTION_ERROR');
    expect(error.statusCode).toBe(500);
    expect(error.agentId).toBeUndefined();
  });

  it('should create error with agent ID', () => {
    const error = new AgentExecutionError('Execution failed', 'agent-1');

    expect(error.agentId).toBe('agent-1');
  });

  it('should support cause chaining', () => {
    const cause = new Error('Model timeout');
    const error = new AgentExecutionError('Execution failed', 'agent-1', cause);

    expect(error.cause).toBe(cause);
  });

  it('should include agentId in JSON when present', () => {
    const error = new AgentExecutionError('Execution failed', 'agent-1');
    const json = error.toJSON();

    expect(json.agentId).toBe('agent-1');
  });

  it('should exclude agentId from JSON when not present', () => {
    const error = new AgentExecutionError('Execution failed');
    const json = error.toJSON();

    expect(json).not.toHaveProperty('agentId');
  });
});

describe('ValidationError', () => {
  it('should create error with details', () => {
    const details = { field: 'email', error: 'Invalid format' };
    const error = new ValidationError('Validation failed', details);

    expect(error.message).toBe('Validation failed');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.details).toEqual(details);
  });

  it('should include details in JSON', () => {
    const details = [{ path: ['name'], message: 'Required' }];
    const error = new ValidationError('Validation failed', details);
    const json = error.toJSON();

    expect(json.details).toEqual(details);
  });
});

describe('A2aTaskError', () => {
  it('should create error with message only', () => {
    const error = new A2aTaskError('Task failed');

    expect(error.message).toBe('Task failed');
    expect(error.code).toBe('A2A_TASK_ERROR');
    expect(error.statusCode).toBe(500);
    expect(error.taskId).toBeUndefined();
  });

  it('should create error with task ID', () => {
    const error = new A2aTaskError('Task failed', 'task-123');

    expect(error.taskId).toBe('task-123');
  });

  it('should support cause chaining', () => {
    const cause = new Error('Agent unavailable');
    const error = new A2aTaskError('Task failed', 'task-123', cause);

    expect(error.cause).toBe(cause);
  });

  it('should include taskId in JSON when present', () => {
    const error = new A2aTaskError('Task failed', 'task-123');
    const json = error.toJSON();

    expect(json.taskId).toBe('task-123');
  });

  it('should exclude taskId from JSON when not present', () => {
    const error = new A2aTaskError('Task failed');
    const json = error.toJSON();

    expect(json).not.toHaveProperty('taskId');
  });
});

describe('isBaseError', () => {
  it('should return true for BaseError', () => {
    const error = new BaseError('Test', 'TEST', 500);
    expect(isBaseError(error)).toBe(true);
  });

  it('should return true for derived errors', () => {
    expect(isBaseError(new AgentNotFoundError('agent'))).toBe(true);
    expect(isBaseError(new AgentConfigError('config'))).toBe(true);
    expect(isBaseError(new McpConnectionError('server'))).toBe(true);
    expect(isBaseError(new AgentExecutionError('exec'))).toBe(true);
    expect(isBaseError(new ValidationError('valid', {}))).toBe(true);
    expect(isBaseError(new A2aTaskError('task'))).toBe(true);
  });

  it('should return false for standard Error', () => {
    expect(isBaseError(new Error('test'))).toBe(false);
  });

  it('should return false for non-errors', () => {
    expect(isBaseError(null)).toBe(false);
    expect(isBaseError(undefined)).toBe(false);
    expect(isBaseError('error')).toBe(false);
    expect(isBaseError({ code: 'ERROR' })).toBe(false);
  });
});
