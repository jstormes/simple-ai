export interface AgentCard {
  name: string;
  description: string;
  protocolVersion: string;
  version: string;
  url: string;
  skills: AgentSkill[];
  securitySchemes?: SecurityScheme[];
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags?: string[] | undefined;
}

export interface SecurityScheme {
  type: 'apiKey' | 'oauth2' | 'openIdConnect';
  name?: string;
  in?: 'header' | 'query';
}

export type A2aTaskStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'input_required';

export interface A2aTask {
  taskId: string;
  contextId?: string | undefined;
  status: A2aTaskStatus;
  agentPath: string;
  message: string;
  result?: unknown;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface A2aTaskCreateRequest {
  agentPath: string;
  message: string;
  contextId?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface A2aTaskResponse {
  taskId: string;
  status: A2aTaskStatus;
  result?: unknown;
  error?: string;
}

export interface A2aStreamEvent {
  type: 'status' | 'text' | 'artifact' | 'error' | 'complete';
  taskId: string;
  data: unknown;
}
