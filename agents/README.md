# AI Agents Framework

A TypeScript-based AI agents framework using Vercel AI SDK v5 with A2A (Agent-to-Agent) protocol and MCP (Model Context Protocol) support.

## Features

- **Multi-Agent Service**: Host multiple agents with URL path-based routing
- **Vercel AI SDK v5**: Built on the latest AI SDK with streaming support
- **MCP Integration**: Connect agents to external tools via Model Context Protocol
- **A2A Protocol**: Agent discovery and inter-agent task delegation
- **Structured Logging**: JSON-formatted logs with trace IDs
- **Error Handling**: Consistent error responses with error codes

## Quick Start

### 1. Set Environment Variables

Copy the example environment file and add your API key:

```bash
cp .env.example .env
```

Edit `.env` and set your Google AI API key:

```
GOOGLE_GENERATIVE_AI_API_KEY=your-api-key-here
```

### 2. Start with Docker

```bash
docker compose up agents
```

The service will start on `http://localhost:8001`.

### 3. Test the API

```bash
# List available agents
curl http://localhost:8001/agents

# Chat with an agent
curl -X POST http://localhost:8001/agents/sales/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What products do you offer?"}'

# Stream a response
curl -X POST http://localhost:8001/agents/support/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "How do I reset my password?"}'
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Service info and available endpoints |
| `/agents` | GET | List all available agents |
| `/agents/:path` | GET | Get agent details |
| `/agents/:path/chat` | POST | Chat with agent (non-streaming) |
| `/agents/:path/stream` | POST | Chat with agent (SSE streaming) |
| `/health` | GET | Liveness probe |
| `/health/ready` | GET | Readiness probe with agent status |
| `/health/live` | GET | Simple alive check |
| `/.well-known/agent.json` | GET | A2A agent card (service-level) |
| `/.well-known/agents/:path/agent.json` | GET | A2A agent card (per-agent) |
| `/a2a/tasks` | GET | List A2A tasks |
| `/a2a/tasks` | POST | Create A2A task |
| `/a2a/tasks/:taskId` | GET | Get task status |
| `/a2a/tasks/:taskId/cancel` | POST | Cancel a task |
| `/a2a/tasks/:taskId/stream` | GET | Stream task updates (SSE) |

## Chat Request Format

```json
{
  "message": "Your message here",
  "conversationId": "optional-conversation-id",
  "metadata": {
    "optional": "metadata"
  }
}
```

## Chat Response Format

```json
{
  "success": true,
  "data": {
    "text": "Agent response",
    "toolCalls": [],
    "usage": {
      "promptTokens": 100,
      "completionTokens": 50,
      "totalTokens": 150
    },
    "finishReason": "stop"
  },
  "traceId": "uuid"
}
```

## Error Response Format

```json
{
  "error": {
    "code": "AGENT_NOT_FOUND",
    "message": "Agent not found: unknown-agent",
    "traceId": "uuid",
    "timestamp": "2025-12-03T12:00:00.000Z"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AGENT_NOT_FOUND` | 404 | Requested agent doesn't exist |
| `AGENT_CONFIG_ERROR` | 500 | Invalid agent configuration |
| `MCP_CONNECTION_ERROR` | 503 | Failed to connect to MCP server |
| `AGENT_EXECUTION_ERROR` | 500 | Agent execution failed |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `A2A_TASK_ERROR` | 500 | A2A task operation failed |
| `INTERNAL_ERROR` | 500 | Unexpected error |

## Creating Agents

Agents are defined as JSON files in the `agents/` directory.

### Agent Configuration Schema

```json
{
  "id": "unique-agent-id",
  "path": "url-path",
  "name": "Display Name",
  "description": "Agent description",
  "model": "gemini-2.0-flash",
  "temperature": 0.7,
  "maxTokens": 4096,
  "systemPrompt": "You are a helpful assistant...",
  "enableTools": true,
  "mcp": {
    "servers": [
      {
        "id": "server-id",
        "transport": "stdio",
        "command": "node",
        "args": ["path/to/mcp-server.js"]
      }
    ]
  },
  "a2a": {
    "discoverable": true,
    "capabilities": [
      {
        "id": "capability-id",
        "name": "Capability Name",
        "description": "What this capability does",
        "tags": ["tag1", "tag2"]
      }
    ]
  }
}
```

### Configuration Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | - | Unique agent identifier |
| `path` | string | Yes | - | URL path (lowercase, alphanumeric, hyphens) |
| `name` | string | Yes | - | Display name |
| `description` | string | Yes | - | Agent description |
| `model` | string | No | `gemini-2.0-flash` | Model identifier |
| `temperature` | number | No | `0.7` | Temperature (0-2) |
| `maxTokens` | number | No | `4096` | Max tokens to generate |
| `systemPrompt` | string | Yes | - | System instructions |
| `enableTools` | boolean | No | `true` | Enable tool calling |
| `mcp.servers` | array | No | `[]` | MCP server connections |
| `a2a.discoverable` | boolean | No | `true` | Visible in A2A discovery |
| `a2a.capabilities` | array | No | `[]` | Advertised capabilities |

### MCP Server Configuration

```json
{
  "id": "server-id",
  "transport": "stdio | sse | http",
  "command": "node",
  "args": ["server.js"],
  "url": "http://localhost:3001/mcp",
  "headers": {
    "Authorization": "Bearer token"
  }
}
```

- **stdio**: Use `command` and `args` to spawn a local process
- **sse/http**: Use `url` and optional `headers` for remote servers

## Project Structure

```
agents/
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
├── PLAN.md
├── src/
│   ├── index.ts              # Entry point
│   ├── server.ts             # Express server setup
│   ├── config/
│   │   └── env.ts            # Environment configuration
│   ├── types/
│   │   ├── agent.ts          # Agent types and Zod schemas
│   │   ├── mcp.ts            # MCP types
│   │   ├── a2a.ts            # A2A types
│   │   └── index.ts          # Type exports
│   ├── core/
│   │   ├── registry.ts       # Agent registry
│   │   ├── base-agent.ts     # Base agent class
│   │   └── agent-factory.ts  # Agent factory
│   ├── mcp/
│   │   ├── client-manager.ts # MCP client manager
│   │   └── tool-adapter.ts   # MCP to AI SDK adapter
│   ├── a2a/
│   │   ├── card-generator.ts # A2A card generation
│   │   └── executor.ts       # A2A task executor
│   ├── routes/
│   │   ├── agents.ts         # Agent routes
│   │   ├── a2a.ts            # A2A routes
│   │   ├── health.ts         # Health routes
│   │   └── well-known.ts     # Discovery routes
│   ├── middleware/
│   │   ├── error-handler.ts  # Error handling
│   │   └── request-logger.ts # Request logging
│   └── utils/
│       ├── logger.ts         # Structured logger
│       └── errors.ts         # Custom errors
└── agents/
    ├── sales.json            # Sales agent config
    └── support.json          # Support agent config
```

## Development

### Local Development (without Docker)

```bash
# Install dependencies
npm install

# Start with hot-reload
npm run dev

# Type checking
npm run typecheck

# Build for production
npm run build

# Start production server
npm start
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `8001` | Server port |
| `BASE_URL` | No | `http://localhost:8001` | Public URL |
| `NODE_ENV` | No | `development` | Environment |
| `AGENT_CONFIG_PATH` | No | `./agents` | Path to agent configs |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes | - | Google AI API key |
| `LOG_LEVEL` | No | `info` | Log level (debug, info, warn, error) |

## Logging

Logs are JSON-formatted for easy parsing:

```json
{
  "timestamp": "2025-12-03T12:00:00.000Z",
  "level": "info",
  "context": "[HTTP]",
  "message": "Request completed",
  "data": {
    "traceId": "uuid",
    "method": "POST",
    "path": "/agents/sales/chat",
    "statusCode": 200,
    "duration": "150ms"
  }
}
```

## A2A Protocol

The framework implements Google's Agent-to-Agent protocol for agent discovery and task delegation.

### Agent Card Discovery

```bash
# Get service-level agent card
curl http://localhost:8001/.well-known/agent.json

# Get specific agent card
curl http://localhost:8001/.well-known/agents/sales/agent.json
```

### Creating A2A Tasks

```bash
# Create a task
curl -X POST http://localhost:8001/a2a/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "agentPath": "sales",
    "message": "Generate a quote for 10 widgets"
  }'

# Get task status
curl http://localhost:8001/a2a/tasks/{taskId}

# Stream task updates
curl http://localhost:8001/a2a/tasks/{taskId}/stream
```

## Dynamic Tools

In addition to MCP tools defined in agent configuration, the framework supports **dynamic tools** that are created at runtime based on request metadata. These tools don't appear in agent JSON configs but are injected automatically when certain conditions are met.

### Page Context Tool (`getPageContent`)

When a client (like the AI Chat Widget) sends page content in the request metadata, the agent automatically gains access to a `getPageContent` tool:

**Request with page context:**
```json
{
  "message": "What orders do I see on this page?",
  "metadata": {
    "pageContext": "Page Title: Customer Portal\n\nTables:\n| Order | Status |\n| ORD-123 | Shipped |"
  }
}
```

**What happens:**
1. `BaseAgent.stream()` detects `metadata.pageContext`
2. A `getPageContent` tool is dynamically created using AI SDK's `dynamicTool()`
3. The system prompt is enhanced to tell the AI about the tool
4. The AI can call `getPageContent` when the user asks about page content
5. The tool returns the page content from the metadata

**Implementation in `base-agent.ts`:**
```typescript
if (hasPageContext && input.metadata?.pageContext) {
  const pageContent = input.metadata.pageContext;
  allTools.getPageContent = dynamicTool({
    description: 'Get the content of the current page the user is viewing',
    parameters: z.object({}),
    execute: async () => pageContent,
  });
}
```

This approach keeps agent configs clean while allowing any agent to have page context capability when the client provides it.

### Creating Custom Dynamic Tools

You can extend `BaseAgent` to add your own dynamic tools based on request metadata:

```typescript
class CustomAgent extends BaseAgent {
  protected getDynamicTools(input: ChatInput): ToolSet {
    const tools: ToolSet = {};

    if (input.metadata?.userLocation) {
      tools.getUserLocation = dynamicTool({
        description: 'Get the user\'s current location',
        parameters: z.object({}),
        execute: async () => input.metadata.userLocation,
      });
    }

    return tools;
  }
}
```

## MCP Integration

Agents can connect to MCP servers to access external tools.

### Example: Adding a Weather Tool

1. Create or use an MCP server that provides weather tools
2. Configure the agent:

```json
{
  "id": "weather-agent",
  "path": "weather",
  "name": "Weather Assistant",
  "systemPrompt": "You help users with weather information.",
  "mcp": {
    "servers": [
      {
        "id": "weather-server",
        "transport": "stdio",
        "command": "node",
        "args": ["./mcp-servers/weather/index.js"]
      }
    ]
  }
}
```

The agent will automatically discover and use tools from the MCP server.

## Additional Documentation

- [RAG (Retrieval-Augmented Generation)](./docs/RAG.md) - Configure agents to search vector databases for context

## License

All rights reserved.
