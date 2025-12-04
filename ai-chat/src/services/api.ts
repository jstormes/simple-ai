/**
 * API service for agent communication with SSE streaming support
 */

import type { ChatWidgetConfig, SSEEvent, ChatRequest } from '../types';

export class ApiService {
  private config: ChatWidgetConfig;
  private abortController: AbortController | null = null;

  constructor(config: ChatWidgetConfig) {
    this.config = config;
  }

  /**
   * Stream a message to the agent and receive SSE events
   */
  async streamMessage(
    message: string,
    conversationId: string | undefined,
    onChunk: (event: SSEEvent) => void,
    onComplete: () => void,
    onError: (error: Error) => void,
    pageContext?: string | null
  ): Promise<void> {
    this.abortController = new AbortController();

    // Build the streaming endpoint URL
    const url = this.buildStreamUrl();
    const headers = this.buildHeaders();
    const body: ChatRequest = {
      message,
      conversationId,
      metadata: pageContext ? { pageContext } : {},
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // Process any remaining buffer content
          if (buffer.trim()) {
            this.processSSELines(buffer, onChunk);
          }
          break;
        }

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Split on newlines and process complete lines
        const lines = buffer.split('\n');
        // Keep the last (potentially incomplete) line in the buffer
        buffer = lines.pop() || '';

        // Process complete lines
        const completeData = lines.join('\n');
        this.processSSELines(completeData, onChunk);
      }

      onComplete();
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // Request was aborted, don't call onError
        return;
      }
      onError(error as Error);
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Process SSE lines and emit events
   */
  private processSSELines(data: string, onChunk: (event: SSEEvent) => void): void {
    const lines = data.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith(':')) {
        continue;
      }

      // Parse SSE data line
      if (trimmedLine.startsWith('data: ')) {
        const jsonStr = trimmedLine.slice(6);

        if (jsonStr === '[DONE]') {
          // OpenAI-style completion marker
          continue;
        }

        try {
          const event = JSON.parse(jsonStr) as SSEEvent;
          onChunk(event);
        } catch (e) {
          console.warn('[ChatWidget] Failed to parse SSE event:', jsonStr, e);
        }
      }
    }
  }

  /**
   * Abort the current streaming request
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Check if a request is currently in progress
   */
  isStreaming(): boolean {
    return this.abortController !== null;
  }

  /**
   * Build the streaming endpoint URL
   */
  private buildStreamUrl(): string {
    const baseUrl = this.config.agentEndpoint;

    // If the endpoint already ends with /stream, use as-is
    if (baseUrl.endsWith('/stream')) {
      return baseUrl;
    }

    // Otherwise, append /stream
    return baseUrl.endsWith('/') ? `${baseUrl}stream` : `${baseUrl}/stream`;
  }

  /**
   * Build request headers
   */
  private buildHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    };

    // Add authentication if configured
    if (this.config.authToken) {
      if (this.config.authHeader === 'Authorization') {
        // Bearer token format
        headers['Authorization'] = `Bearer ${this.config.authToken}`;
      } else {
        // Custom header
        headers[this.config.authHeader] = this.config.authToken;
      }
    }

    return headers;
  }

  /**
   * Send a non-streaming message (fallback)
   */
  async sendMessage(message: string, conversationId?: string): Promise<SSEEvent[]> {
    const url = this.config.agentEndpoint.replace(/\/stream$/, '/chat');
    const headers = this.buildHeaders() as Record<string, string>;
    headers['Accept'] = 'application/json';

    const body: ChatRequest = {
      message,
      conversationId,
      metadata: {},
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
    }

    const result = await response.json();

    // Convert non-streaming response to SSE event format
    const events: SSEEvent[] = [
      { type: 'start' },
      { type: 'text', content: result.data?.text || result.text || '' },
      { type: 'finish' },
    ];

    return events;
  }
}
