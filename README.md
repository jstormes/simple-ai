# QuickAI

Add AI chat capabilities to any web application quickly and easily.

QuickAI provides two main components that work together to bring AI-powered chat to your web apps:

## Components

### [AI Chat Widget](./ai-chat/)

A lightweight, embeddable chat widget that can be added to any web page with just a few lines of code.

**Features:**
- SSE streaming with real-time responses
- Markdown rendering with syntax highlighting
- Session persistence across page reloads
- Page context awareness - AI can see and understand page content
- Shadow DOM isolation - no CSS conflicts with host pages
- Fully accessible (ARIA, keyboard navigation)

**Implementation:**
```html
<script>
window.ChatWidgetConfig = {
  agentEndpoint: 'http://localhost:8001/agents/support',
  headerTitle: 'AI Assistant',
  includePageContext: true
};
</script>
<script src="chat-widget.min.js"></script>
```

### [AI Agents Framework](./agents/)

A TypeScript backend for hosting AI agents with tool support, MCP integration, and A2A protocol.

**Features:**
- Multi-agent service with URL path-based routing
- Vercel AI SDK v5 with streaming support
- MCP (Model Context Protocol) for external tools
- A2A (Agent-to-Agent) protocol for agent discovery
- RAG (Retrieval-Augmented Generation) with vector database support
- Dynamic tools injected at runtime based on client context

**Implementation:**
```bash
# Set your API key
export GOOGLE_GENERATIVE_AI_API_KEY=your-key

# Start with Docker
docker compose up agents
```

## Architecture

```
┌─────────────────────┐         ┌─────────────────────┐
│   Your Web App      │         │   Agents Service    │
│                     │         │                     │
│  ┌───────────────┐  │  SSE    │  ┌───────────────┐  │
│  │ Chat Widget   │──┼─────────┼─▶│ Support Agent │  │
│  └───────────────┘  │         │  └───────────────┘  │
│         │           │         │  ┌───────────────┐  │
│         ▼           │         │  │ Sales Agent   │  │
│  [Page Context]     │         │  └───────────────┘  │
│                     │         │         │           │
└─────────────────────┘         │         ▼           │
                                │  ┌───────────────┐  │
                                │  │ MCP Tools     │  │
                                │  └───────────────┘  │
                                └─────────────────────┘
```

## Use Cases

- **Customer Support** - Add AI chat to help users with questions
- **Legacy App Retrofit** - Drop AI assistance into existing web apps without code changes
- **Internal Tools** - Add AI helpers to admin dashboards and portals
- **Documentation** - Let users ask questions about page content

## Quick Start Demo

### Prerequisites

- Docker and Docker Compose
- Google AI API key (for Gemini models)

### 1. Clone and configure

```bash
git clone <repo-url>
cd quickai

# Configure environment
cp agents/.env.example agents/.env
# Edit agents/.env and add your GOOGLE_GENERATIVE_AI_API_KEY
```

### 2. Start the services

```bash
docker compose up -d
```

This starts:
- **Agents service** on `http://localhost:8001`
- First run may take a few minutes while Docker builds the containers
- Demo pages available in `ai-chat/demo/`

View logs to monitor startup progress:
```bash
docker compose logs -f
```

### 3. Open the demo pages

Open the demo files directly in your browser:
- `ai-chat/demo/index.html` - Basic chat demo
- `ai-chat/demo/page-context-demo.html` - Page context tool demo
- `ai-chat/demo/legacy-app.html` - Legacy app integration demo

Click the floating chat bubble icon in the lower right corner to open the chat panel.

### 4. Test the API

You can test the agents API directly:

```bash
curl -X POST http://localhost:8001/agents/support/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello!"}]}'
```

### 5. Stop the services

```bash
docker compose down
```

## Development

### Rebuild the ai-chat in Docker

To get a command line for Claude Code inside Docker:

```bash
docker exec -it quickai-ai-chat-1 bash
```

### Building the widget

```bash
cd ai-chat
npm install
npm run build
```

### Running the agents service locally

```bash
cd agents
npm install
npm run dev
```

## Documentation

- [AI Chat Widget README](./ai-chat/README.md) - Widget configuration and API
- [AI Agents README](./agents/README.md) - Agent configuration and endpoints
- [RAG Guide](./agents/docs/RAG.md) - Retrieval-Augmented Generation setup
- [CSS Isolation](./ai-chat/docs/CSS-ISOLATION.md) - How Shadow DOM isolation works
- [Security Considerations](./ai-chat/docs/SECURITY.md) - Security guide for page context feature

## Next Steps

Once you have the basic setup running, here are ways to extend QuickAI for your needs:

### 1. Customize Your Agents

Create new agents tailored to your domain by adding JSON config files to `agents/agents/`:

```json
{
  "id": "product-expert",
  "path": "products",
  "name": "Product Expert",
  "description": "Specialist in product information and recommendations",
  "model": "gemini-2.0-flash",
  "systemPrompt": "You are a product expert for Acme Corp. You help customers find the right products based on their needs. Be knowledgeable, helpful, and always recommend products from our catalog.",
  "enableTools": true
}
```

Update your widget to point to the new agent:
```javascript
window.ChatWidgetConfig = {
  agentEndpoint: 'http://localhost:8001/agents/products'
};
```

### 2. Build an Orchestrating Agent Architecture

For complex applications, create a multi-agent system with a front-end orchestrator that delegates to specialist agents:

```
┌─────────────────────────────────────────────────────────┐
│                    Orchestrator Agent                   │
│  "Routes requests to the right specialist agent"        │
└─────────────────┬───────────────┬───────────────┬───────┘
                  │               │               │
                  ▼               ▼               ▼
         ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
         │ Sales Agent   │ │ Support Agent │ │ Billing Agent │
         │ Product info, │ │ Troubleshoot, │ │ Invoices,     │
         │ pricing, demos│ │ tickets, FAQs │ │ payments      │
         └───────────────┘ └───────────────┘ └───────────────┘
```

**Orchestrator agent example (`agents/agents/orchestrator.json`):**
```json
{
  "id": "orchestrator",
  "path": "main",
  "name": "AI Assistant",
  "systemPrompt": "You are the main AI assistant. Analyze user requests and delegate to specialist agents:\n- Sales questions → use sales agent\n- Technical issues → use support agent\n- Billing inquiries → use billing agent\n\nSummarize responses for the user.",
  "enableTools": true,
  "a2a": {
    "discoverable": false,
    "capabilities": []
  }
}
```

The orchestrator can use A2A protocol to discover and delegate to other agents. See the [A2A documentation](./agents/README.md#a2a-protocol) for task creation APIs.

### 3. Write Custom MCP Services

Connect your agents to your own data and systems by creating MCP (Model Context Protocol) servers:

**Example: Customer Database MCP Server**

```typescript
// mcp-servers/customer-db/index.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({
  name: 'customer-db',
  version: '1.0.0',
});

// Define tools your agents can use
server.tool(
  'lookupCustomer',
  'Look up a customer by email or ID',
  {
    type: 'object',
    properties: {
      email: { type: 'string', description: 'Customer email' },
      customerId: { type: 'string', description: 'Customer ID' },
    },
  },
  async ({ email, customerId }) => {
    // Query your database
    const customer = await db.customers.findOne({
      $or: [{ email }, { id: customerId }],
    });
    return { content: [{ type: 'text', text: JSON.stringify(customer) }] };
  }
);

server.tool(
  'getOrderHistory',
  'Get order history for a customer',
  {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer ID' },
      limit: { type: 'number', description: 'Max orders to return' },
    },
    required: ['customerId'],
  },
  async ({ customerId, limit = 10 }) => {
    const orders = await db.orders.find({ customerId }).limit(limit);
    return { content: [{ type: 'text', text: JSON.stringify(orders) }] };
  }
);

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);
```

**Connect to your agent:**
```json
{
  "id": "support-agent",
  "path": "support",
  "name": "Customer Support",
  "systemPrompt": "You help customers with their accounts and orders. Use the customer database tools to look up their information.",
  "enableTools": true,
  "mcp": {
    "servers": [
      {
        "id": "customer-db",
        "transport": "stdio",
        "command": "node",
        "args": ["./mcp-servers/customer-db/index.js"]
      }
    ]
  }
}
```

**Ideas for MCP servers:**
- **CRM Integration** - Look up contacts, deals, and activities
- **Inventory System** - Check stock levels, product details
- **Ticketing System** - Create, update, and search support tickets
- **Knowledge Base** - Search internal documentation and FAQs
- **Calendar/Scheduling** - Book appointments, check availability
- **Analytics** - Query metrics and generate reports

### 4. Add RAG (Retrieval-Augmented Generation)

Enable agents to search your documentation using vector databases:

```json
{
  "id": "knowledge-agent",
  "path": "knowledge",
  "name": "Knowledge Base",
  "systemPrompt": "Answer questions based on the provided context from company documentation.",
  "rag": {
    "enabled": true,
    "provider": "pinecone",
    "index": "company-docs",
    "topK": 5,
    "minScore": 0.7
  }
}
```

Supported providers: **Pinecone**, **Chroma**, **pgvector**

RAG automatically retrieves relevant documents before each response - no tool calls needed. Use this with the orchestrator pattern: the orchestrator routes documentation questions to a RAG-enabled knowledge agent.

See the full [RAG documentation](./agents/docs/RAG.md) for setup instructions.

### 5. Production Deployment Checklist

Before going to production:

- [ ] Set up proper API authentication (`authToken` in widget config)
- [ ] Configure CORS on the agents service
- [ ] Review [Security Considerations](./ai-chat/docs/SECURITY.md) for page context
- [ ] Set up monitoring and logging
- [ ] Configure rate limiting
- [ ] Use HTTPS for all endpoints
- [ ] Test with real user scenarios
- [ ] Set up error alerting

## License

All rights reserved.