import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { McpServerConfig } from './agent.js';

export interface McpClientConnection {
  id: string;
  config: McpServerConfig;
  client: Client;
  connected: boolean;
}

export interface McpToolDefinition {
  name: string;
  description?: string | undefined;
  inputSchema: Record<string, unknown>;
}

export interface McpToolResult {
  content: Array<{
    type: string;
    text?: string;
    data?: unknown;
  }>;
  isError?: boolean;
}

export interface McpToolsMap {
  [toolName: string]: {
    description: string;
    inputSchema: Record<string, unknown>;
    execute: (args: Record<string, unknown>) => Promise<unknown>;
  };
}
