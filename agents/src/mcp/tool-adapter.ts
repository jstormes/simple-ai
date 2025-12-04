import { dynamicTool, type Tool } from 'ai';
import { z } from 'zod';
import type { McpClientManager } from './client-manager.js';
import type { McpToolDefinition } from '../types/mcp.js';
import { Logger } from '../utils/logger.js';

type AnyTool = Tool<unknown, unknown>;

export class McpToolAdapter {
  private mcpManager: McpClientManager;
  private logger: Logger;

  constructor(mcpManager: McpClientManager, logger?: Logger) {
    this.mcpManager = mcpManager;
    this.logger = logger ?? new Logger('McpToolAdapter');
  }

  async getToolsForServer(serverId: string): Promise<Record<string, AnyTool>> {
    const mcpTools = await this.mcpManager.listTools(serverId);
    const tools: Record<string, AnyTool> = {};

    for (const mcpTool of mcpTools) {
      const toolName = `${serverId}_${mcpTool.name}`;
      tools[toolName] = this.convertToAiSdkTool(serverId, mcpTool);
    }

    this.logger.debug('Converted MCP tools to AI SDK format', {
      serverId,
      toolCount: Object.keys(tools).length,
    });

    return tools;
  }

  private convertToAiSdkTool(
    serverId: string,
    mcpTool: McpToolDefinition
  ): AnyTool {
    const inputSchema = this.jsonSchemaToZod(mcpTool.inputSchema);

    return dynamicTool({
      description: mcpTool.description ?? `Tool: ${mcpTool.name}`,
      inputSchema,
      execute: async (args: unknown) => {
        this.logger.debug('Executing MCP tool', {
          serverId,
          toolName: mcpTool.name,
          args,
        });

        try {
          const result = await this.mcpManager.callTool(
            serverId,
            mcpTool.name,
            args as Record<string, unknown>
          );
          return result;
        } catch (error) {
          this.logger.error('MCP tool execution failed', {
            serverId,
            toolName: mcpTool.name,
            error,
          });
          throw error;
        }
      },
    }) as AnyTool;
  }

  private jsonSchemaToZod(schema: Record<string, unknown>): z.ZodType {
    if (!schema || typeof schema !== 'object') {
      return z.object({});
    }

    const type = schema.type as string;
    const properties = schema.properties as Record<string, unknown> | undefined;
    const required = schema.required as string[] | undefined;

    switch (type) {
      case 'object':
        if (!properties) {
          return z.record(z.unknown());
        }

        const shape: Record<string, z.ZodType> = {};
        for (const [key, propSchema] of Object.entries(properties)) {
          let zodType = this.jsonSchemaToZod(propSchema as Record<string, unknown>);
          if (!required?.includes(key)) {
            zodType = zodType.optional();
          }
          shape[key] = zodType;
        }
        return z.object(shape);

      case 'string':
        let stringSchema = z.string();
        if (schema.enum) {
          return z.enum(schema.enum as [string, ...string[]]);
        }
        return stringSchema;

      case 'number':
      case 'integer':
        return z.number();

      case 'boolean':
        return z.boolean();

      case 'array':
        const items = schema.items as Record<string, unknown> | undefined;
        if (items) {
          return z.array(this.jsonSchemaToZod(items));
        }
        return z.array(z.unknown());

      case 'null':
        return z.null();

      default:
        return z.unknown();
    }
  }
}
