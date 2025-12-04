# AI Chat Widget

A lightweight, embeddable AI chat widget with SSE streaming support, markdown rendering, and session persistence.

## Features

- **SSE Streaming**: Real-time streaming responses with progressive markdown rendering
- **Push Content Layout**: Panel pushes page content aside (configurable to overlay)
- **Markdown Support**: Full GFM markdown with syntax highlighting for code blocks
- **Session Persistence**: Conversations persist across page reloads
- **Accessibility**: ARIA labels, keyboard navigation, screen reader support
- **Multi-Language**: Full Unicode support including RTL languages
- **Lightweight**: ~72KB uncompressed bundle

## Quick Start

### 1. Add the widget to your page

```html
<!-- Configuration -->
<script>
window.ChatWidgetConfig = {
  agentEndpoint: 'https://api.example.com/agents/support',
  headerTitle: 'Chat with Us',
  primaryColor: '#0066cc'
};
</script>

<!-- Widget script -->
<script src="https://your-cdn.com/chat-widget.min.js"></script>
```

The widget will automatically initialize and display the chat button.

### 2. Alternative: Manual initialization

```html
<script src="https://your-cdn.com/chat-widget.js"></script>
<script>
const widget = new ChatWidget({
  agentEndpoint: 'https://api.example.com/agents/support',
  headerTitle: 'AI Support'
});
widget.init();
</script>
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `agentEndpoint` | `string` | *required* | Full URL to your agent endpoint |
| `position` | `string` | `'bottom-right'` | `'bottom-right'` or `'bottom-left'` |
| `avatarImage` | `string` | `null` | URL to custom avatar image |
| `avatarSize` | `number` | `60` | Avatar diameter in pixels (30-120) |
| `primaryColor` | `string` | `'#0066cc'` | Theme color (hex) |
| `chatWidth` | `number` | `400` | Panel width in pixels (280-800) |
| `chatHeight` | `number\|'full'` | `600` | Panel height or `'full'` for viewport |
| `headerTitle` | `string` | `'Chat with Us'` | Panel header title |
| `welcomeMessage` | `string` | `'Hello!...'` | Initial welcome message |
| `placeholder` | `string` | `'Type your message...'` | Input placeholder |
| `openOnLoad` | `boolean` | `false` | Auto-open on page load |
| `persistSession` | `boolean` | `true` | Save to localStorage |
| `pushContent` | `boolean` | `true` | Push content vs overlay |
| `enableMarkdown` | `boolean` | `true` | Render markdown |
| `syntaxHighlighting` | `boolean` | `true` | Highlight code |
| `syntaxTheme` | `string` | `'github-dark'` | Code theme |
| `authToken` | `string` | `null` | Auth token |
| `authHeader` | `string` | `'Authorization'` | Auth header name |
| `includePageContext` | `boolean` | `false` | Send page content to agent |
| `pageContextSelector` | `string` | `null` | CSS selector to limit context scope |

### Callbacks

```javascript
window.ChatWidgetConfig = {
  // ... other options
  onOpen: () => console.log('Opened'),
  onClose: () => console.log('Closed'),
  onMessageSent: (message) => console.log('Sent:', message),
  onMessageReceived: (message) => console.log('Received:', message),
  onError: (error) => console.error('Error:', error)
};
```

## Public API

Control the widget programmatically:

```javascript
// Open the chat panel
window.ChatWidget.open();

// Close the chat panel
window.ChatWidget.close();

// Toggle open/closed
window.ChatWidget.toggle();

// Send a message
window.ChatWidget.sendMessage('Hello!');

// Clear conversation history
window.ChatWidget.clearHistory();

// Remove widget from page
window.ChatWidget.destroy();
```

## Page Context Awareness

The widget can send the current page content to the AI agent, allowing users to ask questions about what they see on screen. This is perfect for retrofitting AI assistants onto legacy web applications.

### How It Works

When `includePageContext` is enabled:

1. **Widget extracts page content** - The widget reads the visible page content including text, headings, tables, and form fields
2. **Content is sent as metadata** - Page content is included in the `metadata.pageContext` field with each message
3. **Agent receives a `getPageContent` tool** - The backend dynamically creates a tool the AI can call when needed
4. **AI decides when to use it** - The AI only retrieves page content when the user asks something requiring it

This approach is efficient because the full page content isn't in every prompt - only when the AI determines it's needed.

### Configuration

```javascript
window.ChatWidgetConfig = {
  agentEndpoint: 'https://api.example.com/agents/support',
  includePageContext: true,
  pageContextSelector: null,  // null = entire page, or '.main-content' to limit scope
};
```

### The `getPageContent` Tool

When page context is available, the agent automatically gets access to this tool. The tool is **dynamically injected** at runtime by the agent framework - it doesn't need to be configured in the agent's JSON config file.

**How it works (agent-side):**

1. Widget sends page content in `metadata.pageContext` with each message
2. `BaseAgent.stream()` in the agents framework detects the page context
3. A `getPageContent` tool is created dynamically using AI SDK's `dynamicTool()`
4. The AI's system prompt is enhanced to inform it about the tool
5. The AI calls the tool only when the user asks about page content

This means **any agent** can support page context without configuration changes - the capability is enabled by the client sending the metadata.

**Examples of what users can ask:**

- "What orders do I see on this page?" → AI calls `getPageContent` to read table data
- "Help me fill out this form" → AI calls `getPageContent` to see form fields
- "What is this page about?" → AI calls `getPageContent` for page overview
- "What's the weather today?" → AI responds directly (no tool call needed)

### What Gets Extracted

The page context extractor captures:

- **Page title and URL**
- **Headings** (H1-H6) with hierarchy preserved
- **Text content** from paragraphs, divs, and spans
- **Data tables** converted to markdown format
- **Form fields** with labels, types, and current values (passwords are hidden)
- **Links** with their text

Content from the chat widget itself is automatically excluded.

### Legacy App Integration Example

```html
<!-- Your existing legacy app -->
<div class="app-content">
  <h1>Customer Portal</h1>
  <table class="orders">
    <tr><th>Order</th><th>Status</th></tr>
    <tr><td>ORD-123</td><td>Shipped</td></tr>
  </table>
</div>

<!-- Just add the widget -->
<script>
window.ChatWidgetConfig = {
  agentEndpoint: 'http://localhost:8001/agents/support',
  includePageContext: true,
  pageContextSelector: '.app-content'  // Only read from main content area
};
</script>
<script src="chat-widget.min.js"></script>
```

Now users can ask: *"What's the status of order ORD-123?"* and the AI will check the page and respond: *"Order ORD-123 has been shipped."*

## API Integration

The widget expects your agent endpoint to support SSE streaming.

### Request Format

```http
POST /agents/:path/stream
Content-Type: application/json

{
  "message": "User's message",
  "conversationId": "unique-id",
  "metadata": {}
}
```

### SSE Response Format

```
data: {"type": "start"}

data: {"type": "text", "content": "Hello"}

data: {"type": "text", "content": " there!"}

data: {"type": "tool-call", "content": {"toolCallId": "123", "toolName": "search", "args": {}}}

data: {"type": "tool-result", "content": {"toolCallId": "123", "result": "..."}}

data: {"type": "finish"}
```

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
cd ai-chat
npm install
```

### Commands

```bash
# Development with watch mode
npm run dev

# Build for production
npm run build

# Type checking
npm run typecheck

# Run tests
npm test
```

### Project Structure

```
ai-chat/
├── src/
│   ├── index.ts           # Entry point
│   ├── config.ts          # Configuration
│   ├── types.ts           # Type definitions
│   ├── components/
│   │   ├── avatar.ts      # Avatar button
│   │   ├── panel.ts       # Chat panel
│   │   ├── message.ts     # Message rendering
│   │   └── input.ts       # Input area
│   ├── services/
│   │   ├── api.ts         # SSE streaming
│   │   ├── markdown.ts    # Markdown rendering
│   │   ├── session.ts     # Session storage
│   │   ├── dom.ts         # DOM utilities
│   │   └── page-context.ts # Page content extraction
│   └── styles/
│       └── variables.ts   # CSS styles
├── dist/
│   ├── chat-widget.js     # Development build
│   └── chat-widget.min.js # Production build
├── demo/
│   ├── index.html         # Demo page
│   ├── legacy-app.html    # Legacy app integration demo
│   └── page-context-demo.html  # Page context tool demo
└── package.json
```

## Browser Support

- Chrome (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Edge (last 2 versions)

## Documentation

- [CSS Isolation](./docs/CSS-ISOLATION.md) - How Shadow DOM provides CSS encapsulation
- [Security Considerations](./docs/SECURITY.md) - Security guide for page context feature

## License

All rights reserved.
