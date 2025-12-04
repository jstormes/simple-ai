import { z } from 'zod';

// MCP Server Configuration Schema
export const McpServerConfigSchema = z.object({
  id: z.string().min(1),
  transport: z.enum(['stdio', 'sse', 'http']),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  url: z.string().url().optional(),
  headers: z.record(z.string()).optional(),
}).refine(
  (data) => {
    if (data.transport === 'stdio') {
      return !!data.command;
    }
    if (data.transport === 'sse' || data.transport === 'http') {
      return !!data.url;
    }
    return true;
  },
  {
    message: 'stdio transport requires command, sse/http transport requires url',
  }
);

// RAG Configuration Schema
export const RagConfigSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(['pinecone', 'chroma', 'pgvector']),
  index: z.string().min(1),
  namespace: z.string().optional(),
  topK: z.number().positive().default(5),
  minScore: z.number().min(0).max(1).default(0),
  contextTemplate: z.string().optional(),
});

// A2A Capability Schema
export const A2aCapabilitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  tags: z.array(z.string()).optional(),
});

// A2A Configuration Schema
export const A2aConfigSchema = z.object({
  discoverable: z.boolean().default(true),
  capabilities: z.array(A2aCapabilitySchema).default([]),
});

// Agent Configuration Schema
export const AgentConfigSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Path must be lowercase alphanumeric with hyphens'),
  name: z.string().min(1),
  description: z.string(),
  model: z.string().default('gemini-2.0-flash'),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().positive().default(4096),
  systemPrompt: z.string(),
  enableTools: z.boolean().default(true),
  mcp: z.object({
    servers: z.array(McpServerConfigSchema).default([]),
  }).optional(),
  a2a: A2aConfigSchema.optional(),
  rag: RagConfigSchema.optional(),
});

// Inferred Types
export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;
export type RagConfig = z.infer<typeof RagConfigSchema>;
export type A2aCapability = z.infer<typeof A2aCapabilitySchema>;
export type A2aConfig = z.infer<typeof A2aConfigSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

// Runtime Agent Interface
export interface AgentInput {
  message: string;
  conversationId?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface AgentOutput {
  text: string;
  toolCalls?: ToolCallResult[];
  usage?: UsageInfo | undefined;
  finishReason: string;
}

export interface AgentChunk {
  type: 'text' | 'tool-call' | 'tool-result' | 'error' | 'finish';
  content: unknown;
}

export interface ToolCallResult {
  toolName: string;
  args: unknown;
  result: unknown;
}

export interface UsageInfo {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface RuntimeAgent {
  config: AgentConfig;
  tools: Record<string, unknown>;
  mcpClients: Map<string, unknown>;
  initialize(): Promise<void>;
  execute(input: AgentInput): Promise<AgentOutput>;
  stream(input: AgentInput): AsyncIterable<AgentChunk>;
  shutdown(): Promise<void>;
}
