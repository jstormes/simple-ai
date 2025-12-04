import { generateText, streamText, dynamicTool, stepCountIs, type ToolSet, type Tool } from 'ai';
import { z } from 'zod';
import { google } from '@ai-sdk/google';
import type {
  AgentConfig,
  AgentInput,
  AgentOutput,
  AgentChunk,
  RuntimeAgent,
} from '../types/agent.js';
import { McpClientManager } from '../mcp/client-manager.js';
import { McpToolAdapter } from '../mcp/tool-adapter.js';
import { AgentExecutionError } from '../utils/errors.js';
import { Logger } from '../utils/logger.js';
import { createRetriever, formatContext, type Retriever } from '../rag/index.js';

export class BaseAgent implements RuntimeAgent {
  public config: AgentConfig;
  public tools: ToolSet = {};
  public mcpClients = new Map<string, unknown>();

  private mcpManager: McpClientManager;
  private toolAdapter: McpToolAdapter;
  private logger: Logger;
  private initialized = false;
  private retriever: Retriever | null = null;

  constructor(config: AgentConfig) {
    this.config = config;
    this.logger = new Logger(`Agent:${config.id}`);
    this.mcpManager = new McpClientManager(this.logger.child('MCP'));
    this.toolAdapter = new McpToolAdapter(this.mcpManager, this.logger.child('ToolAdapter'));
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.logger.info('Initializing agent', { id: this.config.id });

    if (this.config.mcp?.servers && this.config.enableTools) {
      for (const serverConfig of this.config.mcp.servers) {
        try {
          const client = await this.mcpManager.connect(serverConfig);
          this.mcpClients.set(serverConfig.id, client);

          const serverTools = await this.toolAdapter.getToolsForServer(serverConfig.id);
          Object.assign(this.tools, serverTools);

          this.logger.info('Loaded MCP tools', {
            serverId: serverConfig.id,
            toolCount: Object.keys(serverTools).length,
          });
        } catch (error) {
          this.logger.error('Failed to initialize MCP server', {
            serverId: serverConfig.id,
            error,
          });
        }
      }
    }

    // Initialize RAG retriever if configured
    if (this.config.rag?.enabled) {
      try {
        this.retriever = createRetriever(this.config.rag);
        this.logger.info('RAG retriever initialized', {
          provider: this.config.rag.provider,
          index: this.config.rag.index,
        });
      } catch (error) {
        this.logger.error('Failed to initialize RAG retriever', { error });
        // Don't fail initialization, just log the error
      }
    }

    this.initialized = true;
    this.logger.info('Agent initialized', {
      id: this.config.id,
      toolCount: Object.keys(this.tools).length,
      ragEnabled: !!this.retriever,
    });
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    if (!this.initialized) {
      await this.initialize();
    }

    this.logger.debug('Executing agent', { input: input.message.slice(0, 100) });

    try {
      const model = google(this.config.model);

      // Build tools including page context tool if available
      const allTools = this.buildToolsWithPageContext(input);
      const hasTools = this.config.enableTools && Object.keys(allTools).length > 0;

      // Get system prompt with RAG context if enabled
      const systemPrompt = await this.buildSystemPromptWithRAG(input.message);

      const result = await generateText({
        model,
        system: systemPrompt,
        prompt: input.message,
        ...(hasTools ? { tools: allTools, maxSteps: 5 } : {}),
        maxOutputTokens: this.config.maxTokens,
        temperature: this.config.temperature,
      });

      const toolCalls = result.toolCalls?.map((tc) => ({
        toolName: tc.toolName,
        args: tc.input,
        result: result.toolResults?.find((tr) => tr.toolCallId === tc.toolCallId)?.output,
      }));

      return {
        text: result.text,
        toolCalls,
        usage: result.usage
          ? {
              promptTokens: result.usage.inputTokens ?? 0,
              completionTokens: result.usage.outputTokens ?? 0,
              totalTokens: result.usage.totalTokens ?? 0,
            }
          : undefined,
        finishReason: result.finishReason,
      };
    } catch (error) {
      this.logger.error('Agent execution failed', { error });
      throw new AgentExecutionError(
        error instanceof Error ? error.message : 'Unknown error',
        this.config.id,
        error
      );
    }
  }

  async *stream(input: AgentInput): AsyncIterable<AgentChunk> {
    if (!this.initialized) {
      await this.initialize();
    }

    this.logger.debug('Streaming agent response', { input: input.message.slice(0, 100) });

    try {
      const model = google(this.config.model);

      // Build tools including page context tool if available
      const allTools = this.buildToolsWithPageContext(input);

      const hasTools = this.config.enableTools && Object.keys(allTools).length > 0;

      // Build system prompt with RAG context (if enabled) and page context instructions
      let systemPrompt = await this.buildSystemPromptWithRAG(input.message);

      // Enhance system prompt if page context tool is available
      const hasPageContext = !!input.metadata?.pageContext;
      if (hasPageContext) {
        systemPrompt = `${systemPrompt}\n\nIMPORTANT: You have access to a getPageContent tool that can retrieve content from the web page the user is currently viewing. When the user asks about orders, data, forms, or anything visible on their screen, USE the getPageContent tool FIRST to see what they're looking at before responding.`;
      }

      const result = streamText({
        model,
        system: systemPrompt,
        prompt: input.message,
        ...(hasTools
          ? {
              tools: allTools,
              maxSteps: 5,
              stopWhen: stepCountIs(5),
            }
          : {}),
        maxOutputTokens: this.config.maxTokens,
        temperature: this.config.temperature,
      });

      for await (const chunk of result.fullStream) {
        switch (chunk.type) {
          case 'text-delta':
            // AI SDK v5 uses 'text-delta' type with 'text' property
            yield { type: 'text', content: (chunk as { text?: string }).text || '' };
            break;
          case 'tool-call':
            // AI SDK v5 uses 'input' instead of 'args'
            yield {
              type: 'tool-call',
              content: { toolName: chunk.toolName, args: (chunk as { input?: unknown }).input },
            };
            break;
          case 'tool-result':
            // AI SDK v5 uses 'output' instead of 'result'
            yield {
              type: 'tool-result',
              content: { toolCallId: chunk.toolCallId, result: (chunk as { output?: unknown }).output },
            };
            break;
          case 'error':
            yield { type: 'error', content: chunk.error };
            break;
          case 'finish':
            // AI SDK v5 uses 'totalUsage' instead of 'usage'
            // Only emit finish when the model is done (not after tool calls)
            if (chunk.finishReason !== 'tool-calls') {
              yield {
                type: 'finish',
                content: {
                  finishReason: chunk.finishReason,
                  usage: (chunk as { totalUsage?: unknown }).totalUsage,
                },
              };
            }
            break;
        }
      }
    } catch (error) {
      this.logger.error('Agent streaming failed', { error });
      yield {
        type: 'error',
        content: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down agent', { id: this.config.id });
    await this.mcpManager.disconnectAll();

    if (this.retriever) {
      await this.retriever.close();
      this.retriever = null;
    }

    this.initialized = false;
    this.logger.info('Agent shutdown complete', { id: this.config.id });
  }

  /**
   * Build system prompt with RAG context if retriever is configured
   */
  private async buildSystemPromptWithRAG(query: string): Promise<string> {
    if (!this.retriever || !this.config.rag?.enabled) {
      return this.config.systemPrompt;
    }

    try {
      const topK = this.config.rag.topK ?? 5;
      this.logger.debug('Retrieving RAG context', { query: query.slice(0, 100), topK });

      const results = await this.retriever.search(query, topK);

      if (results.length === 0) {
        this.logger.debug('No RAG results found');
        return this.config.systemPrompt;
      }

      this.logger.debug('RAG results retrieved', {
        count: results.length,
        scores: results.map((r) => r.score.toFixed(3)),
      });

      const context = formatContext(results, this.config.rag.contextTemplate);
      return `${this.config.systemPrompt}\n\n${context}`;
    } catch (error) {
      this.logger.error('RAG retrieval failed', { error });
      // Fall back to base system prompt on error
      return this.config.systemPrompt;
    }
  }

  /**
   * Build tools object, adding page context tool if page context is available
   */
  private buildToolsWithPageContext(input: AgentInput): ToolSet {
    const pageContext = input.metadata?.pageContext as string | undefined;

    if (!pageContext) {
      return this.tools;
    }

    // Create a tool that returns the current page content
    const getPageContentTool = dynamicTool({
      description:
        'Get the content of the web page the user is currently viewing. Use this tool when the user asks about something on their screen, references page content, asks about orders/data they can see, or needs help with what they are looking at.',
      inputSchema: z.object({
        section: z
          .enum(['all', 'tables', 'forms', 'headings'])
          .optional()
          .describe('Which section of the page to retrieve. Defaults to all.'),
      }),
      execute: async (args: unknown) => {
        const { section } = args as { section?: 'all' | 'tables' | 'forms' | 'headings' };

        if (section === 'tables') {
          // Extract just tables section
          const tableMatch = pageContext.match(/--- Data Tables ---[\s\S]*?(?=---|$)/);
          return tableMatch ? tableMatch[0] : 'No tables found on the page.';
        }
        if (section === 'forms') {
          // Extract just forms section
          const formMatch = pageContext.match(/--- Form Fields ---[\s\S]*?(?=---|$)/);
          return formMatch ? formMatch[0] : 'No forms found on the page.';
        }
        if (section === 'headings') {
          // Extract just headings
          const lines = pageContext.split('\n');
          const headings = lines.filter((line) => line.match(/^#{1,6}\s/));
          return headings.length > 0 ? headings.join('\n') : 'No headings found on the page.';
        }
        // Return all content
        return pageContext;
      },
    }) as Tool<unknown, unknown>;

    // Merge with existing tools
    return {
      ...this.tools,
      getPageContent: getPageContentTool,
    };
  }
}
