export class BaseError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly timestamp: string;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      timestamp: this.timestamp,
    };
  }
}

export class AgentNotFoundError extends BaseError {
  public readonly agentPath: string;

  constructor(agentPath: string) {
    super(`Agent not found: ${agentPath}`, 'AGENT_NOT_FOUND', 404);
    this.agentPath = agentPath;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      agentId: this.agentPath,
    };
  }
}

export class AgentConfigError extends BaseError {
  public readonly configFile?: string | undefined;

  constructor(message: string, configFile?: string, options?: ErrorOptions) {
    super(message, 'AGENT_CONFIG_ERROR', 500);
    this.configFile = configFile;
    if (options?.cause) this.cause = options.cause;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      ...(this.configFile ? { configFile: this.configFile } : {}),
    };
  }
}

export class McpConnectionError extends BaseError {
  public readonly serverId: string;

  constructor(serverId: string, cause?: unknown) {
    super(`Failed to connect to MCP server: ${serverId}`, 'MCP_CONNECTION_ERROR', 503);
    this.serverId = serverId;
    if (cause) this.cause = cause;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      serverId: this.serverId,
    };
  }
}

export class AgentExecutionError extends BaseError {
  public readonly agentId?: string | undefined;

  constructor(message: string, agentId?: string, cause?: unknown) {
    super(message, 'AGENT_EXECUTION_ERROR', 500);
    this.agentId = agentId;
    if (cause) this.cause = cause;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      ...(this.agentId ? { agentId: this.agentId } : {}),
    };
  }
}

export class ValidationError extends BaseError {
  public readonly details: unknown;

  constructor(message: string, details: unknown) {
    super(message, 'VALIDATION_ERROR', 400);
    this.details = details;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      details: this.details,
    };
  }
}

export class A2aTaskError extends BaseError {
  public readonly taskId?: string | undefined;

  constructor(message: string, taskId?: string, cause?: unknown) {
    super(message, 'A2A_TASK_ERROR', 500);
    this.taskId = taskId;
    if (cause) this.cause = cause;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      ...(this.taskId ? { taskId: this.taskId } : {}),
    };
  }
}

export function isBaseError(error: unknown): error is BaseError {
  return error instanceof BaseError;
}
