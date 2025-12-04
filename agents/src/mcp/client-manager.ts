import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { McpServerConfig } from '../types/agent.js';
import type { McpClientConnection, McpToolDefinition } from '../types/mcp.js';
import { McpConnectionError } from '../utils/errors.js';
import { Logger } from '../utils/logger.js';

export class McpClientManager {
  private connections = new Map<string, McpClientConnection>();
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? new Logger('McpClientManager');
  }

  async connect(config: McpServerConfig): Promise<Client> {
    this.logger.info('Connecting to MCP server', { id: config.id, transport: config.transport });

    try {
      const transport = this.createTransport(config);
      const client = new Client(
        { name: 'agents-framework', version: '1.0.0' },
        { capabilities: {} }
      );

      await client.connect(transport);

      this.connections.set(config.id, {
        id: config.id,
        config,
        client,
        connected: true,
      });

      this.logger.info('Connected to MCP server', { id: config.id });
      return client;
    } catch (error) {
      this.logger.error('Failed to connect to MCP server', {
        id: config.id,
        error,
      });
      throw new McpConnectionError(config.id, error);
    }
  }

  private createTransport(config: McpServerConfig): StdioClientTransport | SSEClientTransport {
    switch (config.transport) {
      case 'stdio':
        if (!config.command) {
          throw new Error(`MCP server ${config.id}: stdio transport requires command`);
        }
        return new StdioClientTransport({
          command: config.command,
          args: config.args ?? [],
        });

      case 'sse':
      case 'http':
        if (!config.url) {
          throw new Error(`MCP server ${config.id}: ${config.transport} transport requires url`);
        }
        return new SSEClientTransport(new URL(config.url));

      default:
        throw new Error(`Unknown transport type: ${config.transport}`);
    }
  }

  async listTools(serverId: string): Promise<McpToolDefinition[]> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`MCP server not connected: ${serverId}`);
    }

    const result = await connection.client.listTools();
    return result.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as Record<string, unknown>,
    }));
  }

  async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`MCP server not connected: ${serverId}`);
    }

    this.logger.debug('Calling MCP tool', { serverId, toolName, args });

    const result = await connection.client.callTool({ name: toolName, arguments: args });

    if (result.isError) {
      this.logger.error('MCP tool call failed', { serverId, toolName, result });
      throw new Error(`Tool ${toolName} returned error`);
    }

    return result.content;
  }

  async disconnect(id: string): Promise<void> {
    const connection = this.connections.get(id);
    if (connection) {
      try {
        await connection.client.close();
        this.logger.info('Disconnected from MCP server', { id });
      } catch (error) {
        this.logger.warn('Error disconnecting from MCP server', { id, error });
      }
      this.connections.delete(id);
    }
  }

  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.connections.keys()).map((id) =>
      this.disconnect(id)
    );
    await Promise.all(disconnectPromises);
  }

  getConnection(id: string): McpClientConnection | undefined {
    return this.connections.get(id);
  }

  isConnected(id: string): boolean {
    return this.connections.has(id) && this.connections.get(id)!.connected;
  }

  getConnectedServerIds(): string[] {
    return Array.from(this.connections.keys());
  }
}
