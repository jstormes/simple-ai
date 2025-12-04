/**
 * Session management with localStorage persistence
 */

import type { ChatSession, Message, ChatWidgetConfig } from '../types';
import { generateId } from './dom';

export class SessionService {
  private config: ChatWidgetConfig;
  private session: ChatSession | null = null;

  constructor(config: ChatWidgetConfig) {
    this.config = config;
  }

  /**
   * Initialize or restore session
   */
  initialize(): ChatSession {
    if (this.config.persistSession) {
      const stored = this.loadFromStorage();
      if (stored) {
        this.session = stored;
        return stored;
      }
    }

    this.session = this.createNew();
    this.save();
    return this.session;
  }

  /**
   * Get current session
   */
  getSession(): ChatSession {
    if (!this.session) {
      return this.initialize();
    }
    return this.session;
  }

  /**
   * Get conversation ID for API calls
   */
  getConversationId(): string {
    return this.getSession().conversationId;
  }

  /**
   * Get all messages
   */
  getMessages(): Message[] {
    return this.getSession().messages;
  }

  /**
   * Add a new message
   */
  addMessage(message: Message): void {
    if (!this.session) {
      this.initialize();
    }

    this.session!.messages.push(message);
    this.session!.updatedAt = Date.now();
    this.save();
  }

  /**
   * Update an existing message
   */
  updateMessage(id: string, updates: Partial<Message>): void {
    if (!this.session) return;

    const index = this.session.messages.findIndex((m) => m.id === id);
    if (index !== -1) {
      this.session.messages[index] = {
        ...this.session.messages[index],
        ...updates,
      };
      this.session.updatedAt = Date.now();
      this.save();
    }
  }

  /**
   * Get a message by ID
   */
  getMessage(id: string): Message | undefined {
    return this.session?.messages.find((m) => m.id === id);
  }

  /**
   * Clear all messages and start fresh
   */
  clear(): void {
    this.session = this.createNew();
    this.save();
  }

  /**
   * Create a new session
   */
  private createNew(): ChatSession {
    return {
      id: generateId(),
      conversationId: generateId(),
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * Save session to localStorage
   */
  private save(): void {
    if (!this.config.persistSession || !this.session) return;

    try {
      localStorage.setItem(this.config.sessionStorageKey, JSON.stringify(this.session));
    } catch (e) {
      console.warn('[ChatWidget] Failed to save session:', e);
    }
  }

  /**
   * Load session from localStorage
   */
  private loadFromStorage(): ChatSession | null {
    try {
      const data = localStorage.getItem(this.config.sessionStorageKey);
      if (data) {
        const session = JSON.parse(data) as ChatSession;

        // Validate session structure
        if (this.isValidSession(session)) {
          return session;
        }
      }
    } catch (e) {
      console.warn('[ChatWidget] Failed to load session:', e);
    }
    return null;
  }

  /**
   * Validate session structure
   */
  private isValidSession(obj: unknown): obj is ChatSession {
    if (!obj || typeof obj !== 'object') return false;

    const session = obj as Record<string, unknown>;

    return (
      typeof session.id === 'string' &&
      typeof session.conversationId === 'string' &&
      Array.isArray(session.messages) &&
      typeof session.createdAt === 'number' &&
      typeof session.updatedAt === 'number'
    );
  }

  /**
   * Create a new user message
   */
  createUserMessage(content: string): Message {
    return {
      id: generateId(),
      role: 'user',
      content,
      timestamp: Date.now(),
      status: 'complete',
    };
  }

  /**
   * Create a new assistant message placeholder
   */
  createAssistantMessage(): Message {
    return {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'streaming',
    };
  }
}
