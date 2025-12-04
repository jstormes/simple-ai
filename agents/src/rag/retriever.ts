/**
 * RAG Retriever abstraction
 * Provides a unified interface for different vector database providers
 */

import type { RagConfig } from '../types/agent';
import { Logger } from '../utils/logger';

const logger = new Logger('RAG');

// Response types for vector DB APIs
interface EmbeddingResponse {
  embedding: { values: number[] };
}

interface PineconeIndexResponse {
  host: string;
}

interface PineconeMatch {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

interface PineconeQueryResponse {
  matches?: PineconeMatch[];
}

interface ChromaQueryResponse {
  ids?: string[][];
  documents?: string[][];
  distances?: number[][];
  metadatas?: Record<string, unknown>[][];
}

interface PgVectorSearchResponse {
  results?: RetrievalResult[];
}

export interface RetrievalResult {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface Retriever {
  search(query: string, topK: number): Promise<RetrievalResult[]>;
  close(): Promise<void>;
}

/**
 * Base retriever with embedding support
 */
abstract class BaseRetriever implements Retriever {
  protected config: RagConfig;

  constructor(config: RagConfig) {
    this.config = config;
  }

  abstract search(query: string, topK: number): Promise<RetrievalResult[]>;
  abstract close(): Promise<void>;

  /**
   * Generate embedding for a query using Google's embedding model
   */
  protected async embedQuery(query: string): Promise<number[]> {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is required for RAG embeddings');
    }

    const model = process.env.RAG_EMBEDDING_MODEL || 'text-embedding-004';

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${model}`,
          content: { parts: [{ text: query }] },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Embedding API error: ${error}`);
    }

    const data = (await response.json()) as EmbeddingResponse;
    return data.embedding.values;
  }
}

/**
 * Pinecone retriever
 */
class PineconeRetriever extends BaseRetriever {
  private apiKey: string;
  private host: string | null = null;

  constructor(config: RagConfig) {
    super(config);
    this.apiKey = process.env.PINECONE_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('PINECONE_API_KEY environment variable is required');
    }
  }

  private async getHost(): Promise<string> {
    if (this.host) return this.host;

    // Get index host from Pinecone API
    const response = await fetch(
      `https://api.pinecone.io/indexes/${this.config.index}`,
      {
        headers: {
          'Api-Key': this.apiKey,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get Pinecone index info: ${error}`);
    }

    const data = (await response.json()) as PineconeIndexResponse;
    this.host = data.host;
    return this.host;
  }

  async search(query: string, topK: number): Promise<RetrievalResult[]> {
    const embedding = await this.embedQuery(query);
    const host = await this.getHost();

    const body: Record<string, unknown> = {
      vector: embedding,
      topK,
      includeMetadata: true,
    };

    if (this.config.namespace) {
      body.namespace = this.config.namespace;
    }

    const response = await fetch(`https://${host}/query`, {
      method: 'POST',
      headers: {
        'Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Pinecone query error: ${error}`);
    }

    const data = (await response.json()) as PineconeQueryResponse;

    return (data.matches || [])
      .filter((match) => match.score >= (this.config.minScore ?? 0))
      .map((match): RetrievalResult => ({
        id: match.id,
        content: (match.metadata?.content as string) || (match.metadata?.text as string) || '',
        score: match.score,
        ...(match.metadata ? { metadata: match.metadata } : {}),
      }));
  }

  async close(): Promise<void> {
    // No persistent connection to close
  }
}

/**
 * Chroma retriever
 */
class ChromaRetriever extends BaseRetriever {
  private baseUrl: string;
  private apiKey: string | undefined;

  constructor(config: RagConfig) {
    super(config);
    this.baseUrl = process.env.CHROMA_URL || 'http://localhost:8000';
    this.apiKey = process.env.CHROMA_API_KEY;
  }

  async search(query: string, topK: number): Promise<RetrievalResult[]> {
    const embedding = await this.embedQuery(query);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(
      `${this.baseUrl}/api/v1/collections/${this.config.index}/query`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query_embeddings: [embedding],
          n_results: topK,
          include: ['documents', 'metadatas', 'distances'],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Chroma query error: ${error}`);
    }

    const data = (await response.json()) as ChromaQueryResponse;

    // Chroma returns arrays of arrays
    const ids = data.ids?.[0] || [];
    const documents = data.documents?.[0] || [];
    const distances = data.distances?.[0] || [];
    const metadatas = data.metadatas?.[0] || [];

    // Convert distances to similarity scores (Chroma uses L2 distance by default)
    // Lower distance = higher similarity
    const results: RetrievalResult[] = [];
    const minScore = this.config.minScore ?? 0;
    for (let i = 0; i < ids.length; i++) {
      // Convert L2 distance to similarity score (approximate)
      const score = 1 / (1 + distances[i]);
      if (score >= minScore) {
        results.push({
          id: ids[i],
          content: documents[i] || '',
          score,
          metadata: metadatas[i],
        });
      }
    }

    return results;
  }

  async close(): Promise<void> {
    // No persistent connection to close
  }
}

/**
 * pgvector retriever
 */
class PgVectorRetriever extends BaseRetriever {
  private connectionString: string;

  constructor(config: RagConfig) {
    super(config);
    this.connectionString = process.env.PGVECTOR_CONNECTION_STRING || '';
    if (!this.connectionString) {
      throw new Error('PGVECTOR_CONNECTION_STRING environment variable is required');
    }
  }

  async search(query: string, topK: number): Promise<RetrievalResult[]> {
    // Note: This is a simplified implementation using fetch to a REST API
    // In production, you'd want to use a proper PostgreSQL client like 'pg'

    const embedding = await this.embedQuery(query);

    // This assumes you have a REST API wrapper around pgvector
    // Alternatively, install 'pg' package and use direct SQL queries
    const apiUrl = process.env.PGVECTOR_API_URL;

    if (apiUrl) {
      const response = await fetch(`${apiUrl}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: this.config.index,
          embedding,
          topK,
          minScore: this.config.minScore,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`pgvector query error: ${error}`);
      }

      const data = (await response.json()) as PgVectorSearchResponse;
      return data.results || [];
    }

    // Fallback: log warning and return empty results
    logger.warn('pgvector requires PGVECTOR_API_URL or direct pg client integration');
    return [];
  }

  async close(): Promise<void> {
    // Close pg client if using direct connection
  }
}

/**
 * Create a retriever based on provider configuration
 */
export function createRetriever(config: RagConfig): Retriever {
  switch (config.provider) {
    case 'pinecone':
      return new PineconeRetriever(config);
    case 'chroma':
      return new ChromaRetriever(config);
    case 'pgvector':
      return new PgVectorRetriever(config);
    default:
      throw new Error(`Unknown RAG provider: ${config.provider}`);
  }
}

/**
 * Format retrieved results into context string
 */
export function formatContext(results: RetrievalResult[], template?: string): string {
  if (results.length === 0) {
    return '';
  }

  const contextContent = results
    .map((r) => r.content)
    .join('\n\n---\n\n');

  if (template) {
    return template.replace('{{context}}', contextContent);
  }

  return `## Relevant Context:\n\n${contextContent}`;
}
