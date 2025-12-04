# RAG (Retrieval-Augmented Generation)

This document explains how to enable RAG for agents, allowing them to search a vector database and include relevant context before generating responses.

## Overview

RAG is configured per-agent via the `rag` section in agent JSON configs. Only agents with RAG enabled incur the retrieval overhead - other agents work exactly as before.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Orchestrator Agent                        │
│                    (no RAG, routes requests)                 │
└──────────────┬────────────────┬────────────────┬────────────┘
               │                │                │
               ▼                ▼                ▼
    ┌──────────────────┐ ┌─────────────┐ ┌─────────────────┐
    │ Knowledge Agent  │ │ Sales Agent │ │ Support Agent   │
    │ (RAG enabled)    │ │ (no RAG)    │ │ (no RAG)        │
    │                  │ │             │ │                 │
    │ Vector DB search │ │             │ │                 │
    │ before every msg │ │             │ │                 │
    └──────────────────┘ └─────────────┘ └─────────────────┘
```

This architecture allows:
- **Orchestrator** to route requests without retrieval overhead
- **Knowledge Agent** to always have relevant documentation context
- **Other agents** to operate normally without RAG cost

## Configuration

Add a `rag` section to your agent's JSON config:

```json
{
  "id": "knowledge-agent",
  "path": "knowledge",
  "name": "Knowledge Base Agent",
  "description": "Answers questions using company documentation",
  "model": "gemini-2.0-flash",
  "systemPrompt": "You answer questions based on the provided context. If the context doesn't contain relevant information, say you don't know rather than making up an answer.",
  "enableTools": false,
  "rag": {
    "enabled": true,
    "provider": "pinecone",
    "index": "company-docs",
    "namespace": "production",
    "topK": 5,
    "minScore": 0.7
  }
}
```

### RAG Configuration Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `enabled` | boolean | Yes | - | Enable RAG for this agent |
| `provider` | string | Yes | - | Vector DB provider: `pinecone`, `chroma`, `pgvector` |
| `index` | string | Yes | - | Index/collection name |
| `namespace` | string | No | `undefined` | Namespace within index (Pinecone) |
| `topK` | number | No | `5` | Number of results to retrieve |
| `minScore` | number | No | `0.0` | Minimum similarity score (0-1) |
| `contextTemplate` | string | No | See below | Template for injecting context |

### Context Template

By default, retrieved context is injected as:

```
## Relevant Context:

[Document 1 content]

---

[Document 2 content]

---

[Document 3 content]
```

Customize with `contextTemplate`:

```json
{
  "rag": {
    "enabled": true,
    "provider": "pinecone",
    "index": "docs",
    "contextTemplate": "Use the following documentation to answer the user's question:\n\n{{context}}\n\nIf the documentation doesn't cover the topic, say so."
  }
}
```

## Supported Providers

### Pinecone

```json
{
  "rag": {
    "enabled": true,
    "provider": "pinecone",
    "index": "my-index",
    "namespace": "production"
  }
}
```

**Environment variables:**
```bash
PINECONE_API_KEY=your-api-key
PINECONE_ENVIRONMENT=us-east-1-aws  # Optional, for pod-based indexes
```

### Chroma

```json
{
  "rag": {
    "enabled": true,
    "provider": "chroma",
    "index": "my-collection"
  }
}
```

**Environment variables:**
```bash
CHROMA_URL=http://localhost:8000
CHROMA_API_KEY=optional-api-key  # If authentication enabled
```

### pgvector (PostgreSQL)

```json
{
  "rag": {
    "enabled": true,
    "provider": "pgvector",
    "index": "documents"
  }
}
```

**Environment variables:**
```bash
PGVECTOR_CONNECTION_STRING=postgresql://user:pass@localhost:5432/vectors
```

## How It Works

When an agent with RAG enabled receives a message:

1. **Embed the query** - User's message is converted to a vector using the embedding model
2. **Search vector DB** - Similar documents are retrieved based on cosine similarity
3. **Filter by score** - Results below `minScore` are excluded
4. **Inject context** - Retrieved content is added to the system prompt
5. **Generate response** - LLM responds with the augmented context

```
User Message: "What's your refund policy?"
        │
        ▼
┌───────────────────┐
│ Embed Query       │ → [0.1, -0.3, 0.8, ...]
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Vector DB Search  │ → Top 5 similar documents
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Filter by Score   │ → 3 docs above 0.7 threshold
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Inject into       │ → System prompt + context
│ System Prompt     │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ LLM Generation    │ → "Our refund policy allows..."
└───────────────────┘
```

## Embedding Model

By default, RAG uses Google's `text-embedding-004` model for embeddings. This is configured in environment:

```bash
RAG_EMBEDDING_MODEL=text-embedding-004
```

Ensure your documents were embedded with the same model for accurate similarity matching.

## Orchestrator Pattern

For complex applications, use an orchestrator agent that routes to specialists:

**agents/orchestrator.json:**
```json
{
  "id": "orchestrator",
  "path": "main",
  "name": "AI Assistant",
  "systemPrompt": "You are the main assistant. Analyze requests and delegate:\n- Documentation/policy questions → knowledge agent\n- Product/pricing questions → sales agent\n- Technical problems → support agent\n\nUse A2A tasks to delegate, then summarize the response.",
  "enableTools": true,
  "a2a": {
    "discoverable": false
  }
}
```

**agents/knowledge.json:**
```json
{
  "id": "knowledge-agent",
  "path": "knowledge",
  "name": "Knowledge Base",
  "systemPrompt": "Answer based on the provided context. Be accurate and cite sources when possible.",
  "enableTools": false,
  "rag": {
    "enabled": true,
    "provider": "pinecone",
    "index": "company-docs",
    "topK": 5,
    "minScore": 0.7
  },
  "a2a": {
    "discoverable": true,
    "capabilities": [
      {
        "id": "documentation",
        "name": "Documentation Search",
        "description": "Search and answer questions from company documentation",
        "tags": ["docs", "knowledge", "faq", "policy"]
      }
    ]
  }
}
```

The orchestrator:
1. Receives user question
2. Determines it needs documentation
3. Creates A2A task to knowledge agent
4. Knowledge agent does RAG + generates answer
5. Orchestrator receives response and relays to user

## Populating the Vector Database

RAG requires your documents to be embedded and stored in the vector database. This is done outside the agents framework.

### Example: Indexing with Pinecone

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const genai = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
const embeddingModel = genai.getGenerativeModel({ model: 'text-embedding-004' });

async function indexDocuments(documents: { id: string; content: string; metadata?: object }[]) {
  const index = pinecone.Index('company-docs');

  for (const doc of documents) {
    // Generate embedding
    const result = await embeddingModel.embedContent(doc.content);
    const embedding = result.embedding.values;

    // Upsert to Pinecone
    await index.upsert([
      {
        id: doc.id,
        values: embedding,
        metadata: {
          content: doc.content,
          ...doc.metadata,
        },
      },
    ]);
  }
}

// Index your documents
await indexDocuments([
  { id: 'refund-policy', content: 'Our refund policy allows returns within 30 days...' },
  { id: 'shipping-info', content: 'We ship worldwide. Standard shipping takes 5-7 days...' },
  // ... more documents
]);
```

## Performance Considerations

### Token Usage

RAG increases token usage because context is injected into every prompt. To optimize:

- Use lower `topK` values (3-5 is usually sufficient)
- Set appropriate `minScore` to filter irrelevant results
- Keep indexed documents concise and focused
- Use the orchestrator pattern so only relevant agents do RAG

### Latency

RAG adds latency for embedding and vector search:

- **Embedding**: ~100-200ms
- **Vector search**: ~50-100ms (depends on provider)

Total overhead is typically 150-300ms per request.

### Cost

Consider costs for:
- Embedding API calls (per query)
- Vector database hosting/queries
- Increased LLM tokens (context injection)

## Troubleshooting

### No results returned

- Check `minScore` isn't too high
- Verify documents are indexed with the same embedding model
- Ensure index/namespace names match

### Irrelevant results

- Increase `minScore` threshold
- Improve document chunking (smaller, focused chunks)
- Review document content quality

### Slow responses

- Reduce `topK`
- Use a vector DB with faster response times
- Consider caching frequent queries

## Security Considerations

- Store API keys in environment variables, never in agent configs
- Use namespaces to isolate data between tenants/environments
- Review indexed content for sensitive information
- Consider access controls on the vector database
